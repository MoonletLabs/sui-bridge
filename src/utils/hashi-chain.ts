import { getHashiConfig, HashiNetworkConfig } from 'src/config/hashi'
import { readTable, suiGraphql } from 'src/utils/sui-graphql'

// Reads Hashi's on-chain state through Sui GraphQL. Hashi keeps its queues, UTXO pool and
// committee on-chain, so the current numbers and a fair amount of history (processed
// deposits and withdrawals, the committee of each recent epoch) need no indexer.

// ----------------------------------------------------------------------
// Raw shapes (only the fields we read)

type Json = Record<string, any>

type TableRef = { id: string; size: string }

type BitcoinState = {
    deposit_queue: { requests: TableRef; processed: TableRef }
    withdrawal_queue: {
        requests: TableRef
        processed: TableRef
        withdrawal_txns: TableRef
        confirmed_txns: TableRef
    }
    utxo_pool: { utxo_records: TableRef; spent_utxos: TableRef }
    user_requests: TableRef
}

type HashiObject = {
    committee_set: {
        members: TableRef
        committees: TableRef
        epoch: string
        pending_epoch_change?: unknown
    }
    config: { config: { contents: { key: string; value: Json }[] } }
    treasury: { objects: TableRef }
    proposals: { active: TableRef; executed: TableRef }
    presig_allocator: { num_consumed: string }
}

const HASHI_QUERY = `
query ($id: SuiAddress!, $coin: String!) {
    object(address: $id) {
        asMoveObject { contents { json } }
        dynamicFields(first: 10) {
            nodes {
                name { type { repr } }
                value { ... on MoveValue { type { repr } json } }
            }
        }
    }
    coinMetadata(coinType: $coin) { decimals symbol supply }
}`

type HashiQueryResponse = {
    object: {
        asMoveObject: { contents: { json: HashiObject } }
        dynamicFields: {
            nodes: {
                name: { type: { repr: string } }
                value: { type: { repr: string }; json: any }
            }[]
        }
    } | null
    coinMetadata: { decimals: number; symbol: string; supply: string } | null
}

export type HashiConfigValues = {
    paused: boolean
    reconfigHold: boolean
    depositMinimumSats: number
    withdrawalMinimumSats: number
    depositDelayMs: number
    confirmationsRequired: number
    cancellationCooldownMs: number
    guardianUrl: string | null
    emergencyPauseBps: number
    emergencyUnpauseBps: number
}

const configValue = (entries: { key: string; value: Json }[], key: string) => {
    const entry = entries.find(e => e.key === key)
    return entry ? entry.value.pos0 : undefined
}

const parseConfig = (entries: { key: string; value: Json }[]): HashiConfigValues => ({
    paused: Boolean(configValue(entries, 'paused')),
    reconfigHold: Boolean(configValue(entries, 'reconfig_hold')),
    depositMinimumSats: Number(configValue(entries, 'bitcoin_deposit_minimum') ?? 0),
    withdrawalMinimumSats: Number(configValue(entries, 'bitcoin_withdrawal_minimum') ?? 0),
    depositDelayMs: Number(configValue(entries, 'bitcoin_deposit_time_delay_ms') ?? 0),
    confirmationsRequired: Number(configValue(entries, 'bitcoin_confirmation_threshold') ?? 0),
    cancellationCooldownMs: Number(
        configValue(entries, 'withdrawal_cancellation_cooldown_ms') ?? 0,
    ),
    guardianUrl: (configValue(entries, 'guardian_url') as string | undefined) ?? null,
    emergencyPauseBps: Number(
        configValue(entries, 'governance_emergency_pause_threshold_bps') ?? 0,
    ),
    emergencyUnpauseBps: Number(
        configValue(entries, 'governance_emergency_unpause_threshold_bps') ?? 0,
    ),
})

// ----------------------------------------------------------------------
// Overview

export type HashiOverview = {
    network: string
    packageId: string
    hashiObjectId: string
    epoch: number
    config: HashiConfigValues
    registeredMembers: number
    supplySats: number
    /** BTC held by the committee (sum of the unspent UTXO pool) */
    poolSats: number
    poolUtxoCount: number
    /** pool / supply: 1 means fully backed */
    backingRatio: number | null
    pendingDeposits: number
    pendingWithdrawals: number
    /** False when the withdrawal queue was too large to tell confirmed-but-unarchived apart */
    withdrawalCountsExact: boolean
    processedDeposits: number
    processedWithdrawals: number
    spentUtxos: number
    fetchedAt: string
}

async function readHashiState(cfg: HashiNetworkConfig) {
    const data = await suiGraphql<HashiQueryResponse>(cfg.graphql, HASHI_QUERY, {
        id: cfg.hashiObjectId,
        coin: `${cfg.packageId}::btc::BTC`,
    })
    const obj = data.object
    if (!obj) throw new Error('Hashi object not found')
    const hashi = obj.asMoveObject.contents.json
    const bitcoinNode = obj.dynamicFields.nodes.find(n =>
        n.name.type.repr.endsWith('::bitcoin_state::BitcoinStateKey'),
    )
    if (!bitcoinNode) throw new Error('Hashi Bitcoin state not found')
    return {
        hashi,
        bitcoin: bitcoinNode.value.json as BitcoinState,
        supplySats: Number(data.coinMetadata?.supply ?? 0),
    }
}

export async function getHashiOverview(network: string): Promise<HashiOverview> {
    const cfg = getHashiConfig(network)
    const { hashi, bitcoin, supplySats } = await readHashiState(cfg)

    // The pool is small (a dozen UTXOs), so summing it directly is cheap
    const utxos = await readTable<{ utxo: { amount: string }; spent_by: unknown }>(
        cfg.graphql,
        bitcoin.utxo_pool.utxo_records.id,
        { size: Number(bitcoin.utxo_pool.utxo_records.size) },
    )
    const unspent = utxos.filter(u => u.value && u.value.spent_by == null)
    const poolSats = unspent.reduce((sum, u) => sum + Number(u.value.utxo.amount), 0)

    // A confirmed withdrawal stays in `requests` until it is archived into `processed`, so
    // the table sizes alone would count it as in progress. Tell them apart by the batch.
    const wq = bitcoin.withdrawal_queue
    let pendingWithdrawals = Number(wq.requests.size)
    let processedWithdrawals = Number(wq.processed.size)
    let withdrawalCountsExact = true
    if (pendingWithdrawals <= MAX_TABLE_ROWS && Number(wq.withdrawal_txns.size) <= MAX_TABLE_ROWS) {
        const [requests, batches] = await Promise.all([
            readTable<{ withdrawal_txn_id: string | null }>(cfg.graphql, wq.requests.id, {
                pageSize: 40,
                size: pendingWithdrawals,
            }),
            readTable<{ id: string; confirmed_timestamp_ms: string | null }>(
                cfg.graphql,
                wq.withdrawal_txns.id,
                { pageSize: 20, size: Number(wq.withdrawal_txns.size) },
            ),
        ])
        const confirmedBatches = new Set(
            batches.filter(b => b.value?.confirmed_timestamp_ms).map(b => b.value.id),
        )
        const unarchived = requests.filter(
            r => r.value?.withdrawal_txn_id && confirmedBatches.has(r.value.withdrawal_txn_id),
        ).length
        pendingWithdrawals -= unarchived
        processedWithdrawals += unarchived
    } else {
        withdrawalCountsExact = false
    }

    return {
        network: network === 'testnet' ? 'testnet' : 'mainnet',
        packageId: cfg.packageId,
        hashiObjectId: cfg.hashiObjectId,
        epoch: Number(hashi.committee_set.epoch),
        config: parseConfig(hashi.config.config.contents),
        registeredMembers: Number(hashi.committee_set.members.size),
        supplySats,
        poolSats,
        poolUtxoCount: unspent.length,
        backingRatio: supplySats > 0 ? poolSats / supplySats : null,
        pendingDeposits: Number(bitcoin.deposit_queue.requests.size),
        pendingWithdrawals,
        withdrawalCountsExact,
        processedDeposits: Number(bitcoin.deposit_queue.processed.size),
        processedWithdrawals,
        spentUtxos: Number(bitcoin.utxo_pool.spent_utxos.size),
        fetchedAt: new Date().toISOString(),
    }
}

// ----------------------------------------------------------------------
// Activity (deposits and withdrawals)

type DepositJson = {
    id: string
    sender: string
    created_timestamp_ms: string
    utxo: {
        id: { txid: string; vout: number }
        amount: string
        /** Absent when the deposit has no recipient: it adds reserves without minting */
        derivation_path?: string | null
    }
    approved_timestamp_ms: string | null
    confirmed_timestamp_ms: string | null
}

type WithdrawalJson = {
    id: string
    sender: string
    btc_amount: string
    created_timestamp_ms: string
    approved_timestamp_ms: string | null
    withdrawal_txn_id: string | null
}

type WithdrawalTxnJson = {
    id: string
    txid: string
    created_timestamp_ms: string
    signed_timestamp_ms: string | null
    confirmed_timestamp_ms: string | null
}

export type DepositStatus = 'requested' | 'pending' | 'approved' | 'confirmed'
export type WithdrawalStatus = 'requested' | 'pending' | 'approved' | 'signed' | 'confirmed'

export type HashiDeposit = {
    id: string
    sender: string
    amountSats: number
    /** False for a reserve-only deposit (no recipient): it adds BTC but mints no hBTC */
    mints: boolean
    btcTxid: string
    status: DepositStatus
    createdMs: number
    approvedMs: number | null
    confirmedMs: number | null
}

export type HashiWithdrawal = {
    id: string
    sender: string
    amountSats: number
    btcTxid: string | null
    status: WithdrawalStatus
    createdMs: number
    approvedMs: number | null
    /** When the batch was created: hBTC is burned then, not when Bitcoin confirms */
    burnedMs: number | null
    confirmedMs: number | null
}

const msOrNull = (v: string | null | undefined) => (v == null ? null : Number(v))

/**
 * Reading every processed request is only sensible while the tables are small (mainnet has
 * about a hundred). Beyond this, a partial read would give wrong totals, so we say so instead.
 */
const MAX_TABLE_ROWS = 1000

export async function getHashiRequests(network: string) {
    const cfg = getHashiConfig(network)
    const { bitcoin } = await readHashiState(cfg)
    const q = bitcoin.withdrawal_queue

    const tooLarge = [
        bitcoin.deposit_queue.processed,
        bitcoin.deposit_queue.requests,
        q.processed,
        q.requests,
    ].some(table => Number(table.size) > MAX_TABLE_ROWS)
    if (tooLarge) {
        return { deposits: [] as HashiDeposit[], withdrawals: [] as HashiWithdrawal[], tooLarge }
    }

    const read = <T>(table: TableRef) =>
        readTable<T>(cfg.graphql, table.id, { pageSize: 40, size: Number(table.size) })
    const [depPending, depProcessed, wdPending, wdProcessed, txnsOpen, txnsDone] =
        await Promise.all([
            read<DepositJson>(bitcoin.deposit_queue.requests),
            read<DepositJson>(bitcoin.deposit_queue.processed),
            read<WithdrawalJson>(q.requests),
            read<WithdrawalJson>(q.processed),
            read<WithdrawalTxnJson>(q.withdrawal_txns),
            read<WithdrawalTxnJson>(q.confirmed_txns),
        ])

    const toDeposit = (d: DepositJson): HashiDeposit => {
        const confirmedMs = msOrNull(d.confirmed_timestamp_ms)
        const approvedMs = msOrNull(d.approved_timestamp_ms)
        return {
            id: d.id,
            sender: d.sender,
            amountSats: Number(d.utxo.amount),
            mints: d.utxo.derivation_path != null,
            btcTxid: d.utxo.id.txid,
            status: confirmedMs ? 'confirmed' : approvedMs ? 'approved' : 'pending',
            createdMs: Number(d.created_timestamp_ms),
            approvedMs,
            confirmedMs,
        }
    }

    const txns = new Map<string, WithdrawalTxnJson>()
    ;[...txnsOpen, ...txnsDone].forEach(t => t.value && txns.set(t.value.id, t.value))

    const toWithdrawal = (w: WithdrawalJson): HashiWithdrawal => {
        const txn = w.withdrawal_txn_id ? txns.get(w.withdrawal_txn_id) : undefined
        const confirmedMs = msOrNull(txn?.confirmed_timestamp_ms)
        let status: WithdrawalStatus = 'pending'
        if (confirmedMs) status = 'confirmed'
        else if (txn?.signed_timestamp_ms) status = 'signed'
        else if (w.approved_timestamp_ms) status = 'approved'
        return {
            id: w.id,
            sender: w.sender,
            amountSats: Number(w.btc_amount),
            btcTxid: txn?.txid ?? null,
            status,
            createdMs: Number(w.created_timestamp_ms),
            approvedMs: msOrNull(w.approved_timestamp_ms),
            burnedMs: txn ? Number(txn.created_timestamp_ms) : null,
            confirmedMs,
        }
    }

    const deposits = [...depPending, ...depProcessed]
        .filter(e => e.value)
        .map(e => toDeposit(e.value))
        .sort((a, b) => b.createdMs - a.createdMs)
    const withdrawals = [...wdPending, ...wdProcessed]
        .filter(e => e.value)
        .map(e => toWithdrawal(e.value))
        .sort((a, b) => b.createdMs - a.createdMs)

    return { deposits, withdrawals, tooLarge: false }
}

/**
 * For networks too busy to read every request (testnet has over a million), read the most
 * recent request events instead. Events come newest first, so this gives an honest window of
 * the latest activity rather than an arbitrary slice of the tables.
 */
const EVENTS_QUERY = `
query ($type: String!, $before: String) {
    events(last: 50, before: $before, filter: { type: $type }) {
        pageInfo { hasPreviousPage startCursor }
        nodes { timestamp contents { json } }
    }
}`

type EventsResponse = {
    events: {
        pageInfo: { hasPreviousPage: boolean; startCursor: string | null }
        nodes: { timestamp: string; contents: { json: Json } }[]
    }
}

async function readRecentEvents(cfg: HashiNetworkConfig, typeName: string, max: number) {
    const out: { timestamp: string; json: Json }[] = []
    let before: string | null = null
    while (out.length < max) {
        const data: EventsResponse = await suiGraphql<EventsResponse>(cfg.graphql, EVENTS_QUERY, {
            type: `${cfg.packageId}::${typeName}`,
            before,
        })
        data.events.nodes.forEach(n => out.push({ timestamp: n.timestamp, json: n.contents.json }))
        if (!data.events.pageInfo.hasPreviousPage) break
        before = data.events.pageInfo.startCursor
    }
    return out
}

const RECENT_EVENTS_PER_KIND = 1500

export async function getHashiRecentRequests(network: string) {
    const cfg = getHashiConfig(network)
    const [depositEvents, withdrawalEvents] = await Promise.all([
        readRecentEvents(cfg, 'deposit::DepositRequested', RECENT_EVENTS_PER_KIND),
        readRecentEvents(cfg, 'withdrawal_queue::WithdrawalRequested', RECENT_EVENTS_PER_KIND),
    ])

    const deposits: HashiDeposit[] = depositEvents.map(e => ({
        id: e.json.request_id,
        sender: e.json.requester_address,
        amountSats: Number(e.json.amount),
        mints: e.json.derivation_path != null,
        btcTxid: e.json.utxo_id?.txid ?? '',
        status: 'requested',
        createdMs: Number(e.json.timestamp_ms) || Date.parse(e.timestamp),
        approvedMs: null,
        confirmedMs: null,
    }))
    const withdrawals: HashiWithdrawal[] = withdrawalEvents.map(e => ({
        id: e.json.request_id,
        sender: e.json.requester_address,
        amountSats: Number(e.json.btc_amount),
        btcTxid: null,
        status: 'requested',
        createdMs: Number(e.json.timestamp_ms) || Date.parse(e.timestamp),
        approvedMs: null,
        burnedMs: null,
        confirmedMs: null,
    }))

    // Both kinds must cover the same period, or the counts could not be compared: cut each
    // to the later of the two oldest timestamps (a kind that hit the cap reaches back less far)
    const oldest = (list: { createdMs: number }[]) =>
        list.length ? Math.min(...list.map(r => r.createdMs)) : 0
    // With no events at all, start the window now (an hour back) instead of at the epoch
    const fromMs = Math.max(oldest(deposits), oldest(withdrawals)) || Date.now() - 60 * 60_000
    return {
        deposits: deposits.filter(d => d.createdMs >= fromMs),
        withdrawals: withdrawals.filter(w => w.createdMs >= fromMs),
        fromMs,
        toMs: Date.now(),
    }
}

// ----------------------------------------------------------------------
// Committee

type MemberInfoJson = {
    validator_address: string
    operator_address: string
    endpoint_url: string
    ignored: boolean
    resigned: boolean
}

type CommitteeJson = {
    epoch: string
    members: { validator_address: string; weight: string }[]
}

const VALIDATORS_QUERY = `
query ($after: String) {
    epoch {
        validatorSet {
            activeValidators(first: 50, after: $after) {
                pageInfo { hasNextPage endCursor }
                nodes { contents { json } }
            }
        }
    }
}`

type ValidatorsResponse = {
    epoch: {
        validatorSet: {
            activeValidators: {
                pageInfo: { hasNextPage: boolean; endCursor: string | null }
                nodes: {
                    contents: {
                        json: { metadata: { sui_address: string; name: string; image_url: string } }
                    }
                }[]
            }
        }
    }
}

async function readValidatorNames(cfg: HashiNetworkConfig) {
    const names = new Map<string, { name: string; imageUrl: string | null }>()
    try {
        let after: string | null = null
        // GraphQL caps a page at 50 and the validator set is ~125
        for (let page = 0; page < 6; page += 1) {
            const data: ValidatorsResponse = await suiGraphql<ValidatorsResponse>(
                cfg.graphql,
                VALIDATORS_QUERY,
                { after },
            )
            const validators = data.epoch.validatorSet.activeValidators
            validators.nodes.forEach(n => {
                const m = n.contents.json.metadata
                names.set(m.sui_address, { name: m.name, imageUrl: m.image_url || null })
            })
            if (!validators.pageInfo.hasNextPage) break
            after = validators.pageInfo.endCursor
        }
    } catch {
        // Names are decoration: fall back to addresses
    }
    return names
}

export type HashiMember = {
    validator: string
    name: string | null
    imageUrl: string | null
    operator: string
    endpoint: string
    weight: number
    weightPct: number
    inCommittee: boolean
}

export type HashiEpochStat = {
    epoch: number
    members: number
    totalWeight: number
    top1Pct: number
    top5Pct: number
    top10Pct: number
    /** Fewest members whose combined weight is enough to stop a quorum from forming */
    blockingMembers: number
    /** Fewest members whose combined weight reaches the quorum threshold */
    quorumMembers: number
}

/** Hashi's committee quorum, in basis points of total weight */
const QUORUM_BPS = 6667

const epochStat = (c: CommitteeJson): HashiEpochStat => {
    const weights = c.members.map(m => Number(m.weight)).sort((a, b) => b - a)
    const total = weights.reduce((a, b) => a + b, 0)
    const topPct = (n: number) =>
        total ? (weights.slice(0, n).reduce((a, b) => a + b, 0) / total) * 100 : 0
    // Hashi's certificate threshold is an integer weight, ceil(total * 6667 / 10000). A
    // group can block a quorum once the weight left over cannot reach it.
    const quorumWeight = Math.ceil((total * QUORUM_BPS) / 10_000)
    const blockingWeight = total - quorumWeight + 1
    const membersFor = (needed: number) => {
        let acc = 0
        for (let i = 0; i < weights.length; i += 1) {
            acc += weights[i]
            if (acc >= needed) return i + 1
        }
        return weights.length
    }
    return {
        epoch: Number(c.epoch),
        members: weights.length,
        totalWeight: total,
        top1Pct: topPct(1),
        top5Pct: topPct(5),
        top10Pct: topPct(10),
        blockingMembers: membersFor(blockingWeight),
        quorumMembers: membersFor(quorumWeight),
    }
}

export async function getHashiCommittee(network: string) {
    const cfg = getHashiConfig(network)
    const { hashi } = await readHashiState(cfg)
    const set = hashi.committee_set

    const [members, committees, names] = await Promise.all([
        readTable<MemberInfoJson>(cfg.graphql, set.members.id, {
            pageSize: 40,
            size: Number(set.members.size),
        }),
        // Committees are large (one entry per member with its keys): few per page
        readTable<CommitteeJson>(cfg.graphql, set.committees.id, {
            pageSize: 10,
            size: Number(set.committees.size),
        }),
        readValidatorNames(cfg),
    ])

    const history = committees
        .map(c => c.value)
        .filter(c => c && Array.isArray(c.members))
        .sort((a, b) => Number(a.epoch) - Number(b.epoch))
    const current = history.find(c => Number(c.epoch) === Number(set.epoch)) ?? history.at(-1)
    const weightByValidator = new Map<string, number>()
    current?.members.forEach(m => weightByValidator.set(m.validator_address, Number(m.weight)))
    const totalWeight = Array.from(weightByValidator.values()).reduce((a, b) => a + b, 0)

    const list: HashiMember[] = members
        .map(e => e.value)
        .filter(Boolean)
        .map(m => {
            const weight = weightByValidator.get(m.validator_address) ?? 0
            const meta = names.get(m.validator_address)
            return {
                validator: m.validator_address,
                name: meta?.name ?? null,
                imageUrl: meta?.imageUrl ?? null,
                operator: m.operator_address,
                endpoint: m.endpoint_url,
                weight,
                weightPct: totalWeight ? (weight / totalWeight) * 100 : 0,
                inCommittee: weightByValidator.has(m.validator_address),
            }
        })
        .sort((a, b) => b.weight - a.weight)

    return {
        epoch: Number(set.epoch),
        totalWeight,
        members: list,
        // The next committee is stored when reconfiguration starts, before the epoch advances
        stats: history.filter(c => Number(c.epoch) <= Number(set.epoch)).map(epochStat),
    }
}

// ----------------------------------------------------------------------
// Governance

const PROPOSAL_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

type ProposalJson = {
    id: string
    creator: string
    votes: string[]
    quorum_threshold_bps: string
    created_timestamp_ms: string
    executed_timestamp_ms: string | null
    metadata?: { contents: { key: string; value: string }[] }
    data?: { entries?: { contents: { key: string; value: Json }[] } }
}

export type HashiProposalStatus = 'active' | 'executed' | 'expired'

export type HashiProposal = {
    id: string
    type: string
    status: HashiProposalStatus
    description: string | null
    creator: string
    creatorName: string | null
    votes: number
    /** Share of the current committee's weight held by the voters */
    voteWeightPct: number
    quorumBps: number
    createdMs: number
    executedMs: number | null
    expiresMs: number
    /** Config keys the proposal changes, when it is a config proposal */
    changes: { key: string; value: string }[]
}

export type HashiVoter = {
    validator: string
    name: string | null
    votes: number
    weightPct: number
}

export type HashiGovernance = {
    network: string
    counts: { active: number; executed: number; expired: number }
    proposals: HashiProposal[]
    /** Per operator: proposals supported out of all proposals seen */
    participation: HashiVoter[]
    totalProposals: number
}

const proposalType = (repr: string | undefined) => {
    // ...::proposal::Proposal<0x…::update_config::UpdateConfig> -> UpdateConfig
    const inner = repr?.match(/<(.+)>$/)?.[1] ?? ''
    return inner.split('::').pop() || 'Unknown'
}

const COMMITTEE_TTL_MS = 10 * 60 * 1000
const committeeCache = new Map<
    string,
    { at: number; value: ReturnType<typeof getHashiCommittee> }
>()

// The committee read is the heaviest call; governance and the committee view share it
const cachedCommittee = (network: string) => {
    const hit = committeeCache.get(network)
    if (hit && Date.now() - hit.at < COMMITTEE_TTL_MS) return hit.value
    const value = getHashiCommittee(network)
    committeeCache.set(network, { at: Date.now(), value })
    value.catch(() => committeeCache.delete(network))
    return value
}

export async function getHashiGovernance(network: string): Promise<HashiGovernance> {
    const cfg = getHashiConfig(network)
    const { hashi } = await readHashiState(cfg)
    const { active, executed } = hashi.proposals

    const read = (table: TableRef) =>
        readTable<ProposalJson>(cfg.graphql, table.id, { pageSize: 10, size: Number(table.size) })
    const [activeRows, executedRows, committee] = await Promise.all([
        read(active),
        read(executed),
        cachedCommittee(network),
    ])

    const memberByValidator = new Map(committee.members.map(m => [m.validator, m]))
    const now = Date.now()

    const toProposal = (
        row: { value: ProposalJson; type?: string },
        done: boolean,
    ): HashiProposal => {
        const p = row.value
        const createdMs = Number(p.created_timestamp_ms)
        const executedMs = p.executed_timestamp_ms ? Number(p.executed_timestamp_ms) : null
        const expiresMs = createdMs + PROPOSAL_LIFETIME_MS
        const creator = memberByValidator.get(p.creator)
        const weightPct = p.votes.reduce(
            (sum, v) => sum + (memberByValidator.get(v)?.weightPct ?? 0),
            0,
        )
        const description =
            p.metadata?.contents.find(entry => entry.key === 'description')?.value ?? null
        const changes = (p.data?.entries?.contents ?? []).map(entry => ({
            key: entry.key,
            value: String(entry.value?.pos0 ?? ''),
        }))
        let status: HashiProposalStatus = 'active'
        if (done || executedMs) status = 'executed'
        else if (expiresMs < now) status = 'expired'
        return {
            id: p.id,
            type: proposalType(row.type),
            status,
            description,
            creator: p.creator,
            creatorName: creator?.name ?? null,
            votes: p.votes.length,
            voteWeightPct: weightPct,
            quorumBps: Number(p.quorum_threshold_bps),
            createdMs,
            executedMs,
            expiresMs,
            changes,
        }
    }

    const rows = [
        ...activeRows.filter(r => r.value).map(r => ({ row: r, done: false })),
        ...executedRows.filter(r => r.value).map(r => ({ row: r, done: true })),
    ]
    const proposals = rows
        .map(({ row, done }) => toProposal(row as { value: ProposalJson; type?: string }, done))
        .sort((a, b) => b.createdMs - a.createdMs)

    // Participation: how often each operator backed a proposal
    const voteCount = new Map<string, number>()
    rows.forEach(({ row }) =>
        (row.value as ProposalJson).votes.forEach(v =>
            voteCount.set(v, (voteCount.get(v) ?? 0) + 1),
        ),
    )
    const participation: HashiVoter[] = committee.members
        .filter(m => m.inCommittee)
        .map(m => ({
            validator: m.validator,
            name: m.name,
            votes: voteCount.get(m.validator) ?? 0,
            weightPct: m.weightPct,
        }))
        .sort((a, b) => b.votes - a.votes || b.weightPct - a.weightPct)

    return {
        network: network === 'testnet' ? 'testnet' : 'mainnet',
        counts: {
            active: proposals.filter(p => p.status === 'active').length,
            executed: proposals.filter(p => p.status === 'executed').length,
            expired: proposals.filter(p => p.status === 'expired').length,
        },
        proposals,
        participation,
        totalProposals: proposals.length,
    }
}

// ----------------------------------------------------------------------
// Operations: withdrawal batches, miner fees, chain progress

type BatchJson = WithdrawalTxnJson & {
    request_ids: string[]
    inputs: { amount: string }[]
    withdrawal_outputs: { amount: string }[]
    change_outputs: { amount: string }[]
}

export type HashiBatch = {
    id: string
    btcTxid: string
    status: 'pending' | 'signed' | 'confirmed'
    withdrawals: number
    /** BTC paid out to users */
    outputSats: number
    /** Miner fee: inputs minus every output */
    feeSats: number
    inputs: number
    createdMs: number
    signedMs: number | null
    confirmedMs: number | null
}

export type HashiBatchDay = {
    day_ms: number
    batches: number
    withdrawals: number
    fee_sats: number
    btc_sats: number
}

export type HashiEpochRow = {
    epoch: number
    members: number
    totalWeight: number
    memberChange: number
}

export type HashiOperations = {
    network: string
    /** Too many batches to read in full: only the network section is filled */
    tooLarge: boolean
    batches: {
        confirmed: number
        pending: number
        signed: number
        totalFeeSats: number
        avgFeeSats: number
        avgWithdrawalsPerBatch: number
        avgBtcSatsPerBatch: number
        medianConfirmMs: number | null
        daily: HashiBatchDay[]
        recent: HashiBatch[]
    } | null
    presigsConsumed: number
    chain: {
        suiCheckpoint: number
        checkpointAtMs: number
        suiEpoch: number
        epochStartMs: number
    }
    epochs: HashiEpochRow[]
}

const CHAIN_QUERY = `{ checkpoint { sequenceNumber timestamp } epoch { epochId startTimestamp } }`

type ChainResponse = {
    checkpoint: { sequenceNumber: number; timestamp: string }
    epoch: { epochId: number; startTimestamp: string }
}

const sumAmounts = (items: { amount: string }[] | undefined) =>
    (items ?? []).reduce((total, item) => total + Number(item.amount), 0)

const median = (values: number[]) => {
    if (!values.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)]
}

const batchFromJson = (j: BatchJson): HashiBatch => {
    const inputSats = sumAmounts(j.inputs)
    const outputSats = sumAmounts(j.withdrawal_outputs)
    const changeSats = sumAmounts(j.change_outputs)
    const confirmedMs = msOrNull(j.confirmed_timestamp_ms)
    const signedMs = msOrNull(j.signed_timestamp_ms)
    return {
        id: j.id,
        btcTxid: j.txid,
        status: confirmedMs ? 'confirmed' : signedMs ? 'signed' : 'pending',
        withdrawals: j.request_ids.length,
        outputSats,
        feeSats: Math.max(0, inputSats - outputSats - changeSats),
        inputs: j.inputs.length,
        createdMs: Number(j.created_timestamp_ms),
        signedMs,
        confirmedMs,
    }
}

/** Every withdrawal batch (open and archived), newest first. Empty on networks too large to read. */
export async function getHashiBatches(
    network: string,
): Promise<{ batches: HashiBatch[]; tooLarge: boolean }> {
    const cfg = getHashiConfig(network)
    const { bitcoin } = await readHashiState(cfg)
    const q = bitcoin.withdrawal_queue
    if ([q.withdrawal_txns, q.confirmed_txns].some(t => Number(t.size) > MAX_TABLE_ROWS)) {
        return { batches: [], tooLarge: true }
    }
    const read = (table: TableRef) =>
        readTable<BatchJson>(cfg.graphql, table.id, { pageSize: 20, size: Number(table.size) })
    const [open, done] = await Promise.all([read(q.withdrawal_txns), read(q.confirmed_txns)])
    const batches = [...open, ...done]
        .filter(e => e.value)
        .map(e => batchFromJson(e.value))
        .sort((a, b) => b.createdMs - a.createdMs)
    return { batches, tooLarge: false }
}

export async function getHashiOperations(network: string): Promise<HashiOperations> {
    const cfg = getHashiConfig(network)
    const { hashi, bitcoin } = await readHashiState(cfg)
    const q = bitcoin.withdrawal_queue

    const tooLarge = [q.withdrawal_txns, q.confirmed_txns].some(
        t => Number(t.size) > MAX_TABLE_ROWS,
    )

    const [chain, committee, open, done] = await Promise.all([
        suiGraphql<ChainResponse>(cfg.graphql, CHAIN_QUERY),
        cachedCommittee(network),
        tooLarge
            ? []
            : readTable<BatchJson>(cfg.graphql, q.withdrawal_txns.id, {
                  pageSize: 20,
                  size: Number(q.withdrawal_txns.size),
              }),
        tooLarge
            ? []
            : readTable<BatchJson>(cfg.graphql, q.confirmed_txns.id, {
                  pageSize: 20,
                  size: Number(q.confirmed_txns.size),
              }),
    ])

    let batches: HashiOperations['batches'] = null
    if (!tooLarge) {
        const toBatch = batchFromJson
        const all = [...open, ...done]
            .filter(e => e.value)
            .map(e => toBatch(e.value))
            .sort((a, b) => b.createdMs - a.createdMs)
        const confirmed = all.filter(b => b.status === 'confirmed')

        const byDay = new Map<number, HashiBatchDay>()
        confirmed.forEach(b => {
            const day = Math.floor((b.confirmedMs as number) / 86_400_000) * 86_400_000
            const d = byDay.get(day) ?? {
                day_ms: day,
                batches: 0,
                withdrawals: 0,
                fee_sats: 0,
                btc_sats: 0,
            }
            d.batches += 1
            d.withdrawals += b.withdrawals
            d.fee_sats += b.feeSats
            d.btc_sats += b.outputSats
            byDay.set(day, d)
        })
        const days = Array.from(byDay.keys()).sort((a, b) => a - b)
        const daily: HashiBatchDay[] = []
        if (days.length) {
            for (let t = days[0]; t <= days[days.length - 1]; t += 86_400_000) {
                daily.push(
                    byDay.get(t) ?? {
                        day_ms: t,
                        batches: 0,
                        withdrawals: 0,
                        fee_sats: 0,
                        btc_sats: 0,
                    },
                )
            }
        }

        const totalFee = confirmed.reduce((a, b) => a + b.feeSats, 0)
        const n = confirmed.length
        batches = {
            confirmed: n,
            pending: all.filter(b => b.status === 'pending').length,
            signed: all.filter(b => b.status === 'signed').length,
            totalFeeSats: totalFee,
            avgFeeSats: n ? totalFee / n : 0,
            avgWithdrawalsPerBatch: n ? confirmed.reduce((a, b) => a + b.withdrawals, 0) / n : 0,
            avgBtcSatsPerBatch: n ? confirmed.reduce((a, b) => a + b.outputSats, 0) / n : 0,
            medianConfirmMs: median(confirmed.map(b => (b.confirmedMs as number) - b.createdMs)),
            daily,
            recent: all.slice(0, 15),
        }
    }

    const epochs: HashiEpochRow[] = committee.stats.map((stat, i, list) => ({
        epoch: stat.epoch,
        members: stat.members,
        totalWeight: stat.totalWeight,
        memberChange: i === 0 ? 0 : stat.members - list[i - 1].members,
    }))

    return {
        network: network === 'testnet' ? 'testnet' : 'mainnet',
        tooLarge,
        batches,
        presigsConsumed: Number(hashi.presig_allocator?.num_consumed ?? 0),
        chain: {
            suiCheckpoint: Number(chain.checkpoint.sequenceNumber),
            checkpointAtMs: Date.parse(chain.checkpoint.timestamp),
            suiEpoch: Number(chain.epoch.epochId),
            epochStartMs: Date.parse(chain.epoch.startTimestamp),
        },
        epochs,
    }
}

// ----------------------------------------------------------------------
// Health

export type HashiCheckStatus = 'healthy' | 'watch' | 'info' | 'unavailable'

export type HashiHealthCheck = {
    key: string
    group: 'Protocol state' | 'Bridge progression' | 'Request outcomes'
    label: string
    status: HashiCheckStatus
    summary: string
    detail: string
}

export type HashiHealth = {
    network: string
    status: 'healthy' | 'watch'
    watchCount: number
    checkedAt: string
    checks: HashiHealthCheck[]
}

const MIN = 60_000
const HOUR = 60 * MIN

// Same rules HashiView applies: a queue only turns to "watch" when several requests from
// several different people are overdue, so one stuck request does not raise an alarm
const WATCH_MIN_REQUESTS = 5
const WATCH_MIN_REQUESTERS = 3

const THRESHOLDS = {
    requestedDepositMs: 6 * HOUR,
    approvedDepositMs: 2 * HOUR + 10 * MIN,
    requestedWithdrawalMs: 2 * HOUR,
    approvedWithdrawalMs: 2 * HOUR,
}

const ageText = (ms: number) => {
    const minutes = Math.round(ms / MIN)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
}

type Waiting = { sender: string; sinceMs: number }

/** A queue check: overdue means waiting longer than `thresholdMs` */
function queueCheck(
    base: Pick<HashiHealthCheck, 'key' | 'group' | 'label'>,
    waiting: Waiting[],
    thresholdMs: number,
    noun: string,
    emptyText: string,
    now: number,
): HashiHealthCheck {
    if (!waiting.length) {
        return { ...base, status: 'healthy', summary: emptyText, detail: `Nothing is waiting.` }
    }
    const overdue = waiting.filter(w => now - w.sinceMs > thresholdMs)
    const requesters = new Set(overdue.map(w => w.sender)).size
    const oldest = Math.max(...waiting.map(w => now - w.sinceMs))
    const watch = overdue.length >= WATCH_MIN_REQUESTS && requesters >= WATCH_MIN_REQUESTERS
    return {
        ...base,
        status: watch ? 'watch' : 'healthy',
        summary: watch
            ? `${overdue.length} ${noun} are overdue`
            : `${waiting.length} ${noun} waiting, none unusually delayed`,
        detail: `Oldest has waited ${ageText(oldest)}. Timing threshold ${ageText(thresholdMs)}. Watch needs at least ${WATCH_MIN_REQUESTS} overdue requests from ${WATCH_MIN_REQUESTERS} different users (now ${overdue.length} from ${requesters}).`,
    }
}

const TX_QUERY = `
query ($fn: String!, $before: String) {
    transactions(last: 50, before: $before, filter: { function: $fn }) {
        pageInfo { hasPreviousPage startCursor }
        nodes { sender { address } effects { status timestamp } }
    }
}`

type TxResponse = {
    transactions: {
        pageInfo: { hasPreviousPage: boolean; startCursor: string | null }
        nodes: {
            sender: { address: string } | null
            effects: { status: string; timestamp: string }
        }[]
    }
}

type RequestTx = { sender: string; failed: boolean; atMs: number }

/** Request transactions (successful or not) in the last `sinceMs`, newest pages first */
async function readRequestTransactions(
    cfg: HashiNetworkConfig,
    fn: string,
    sinceMs: number,
    maxPages = 6,
) {
    const out: RequestTx[] = []
    let before: string | null = null
    let capped = false
    for (let page = 0; page < maxPages; page += 1) {
        const data: TxResponse = await suiGraphql<TxResponse>(cfg.graphql, TX_QUERY, {
            fn: `${cfg.packageId}::${fn}`,
            before,
        })
        const nodes = data.transactions.nodes
        nodes.forEach(n =>
            out.push({
                sender: n.sender?.address ?? '',
                failed: n.effects.status !== 'SUCCESS',
                atMs: Date.parse(n.effects.timestamp),
            }),
        )
        const oldest = nodes.length ? Date.parse(nodes[0].effects.timestamp) : 0
        if (!data.transactions.pageInfo.hasPreviousPage || oldest < sinceMs) break
        if (page === maxPages - 1) capped = true
        before = data.transactions.pageInfo.startCursor
    }
    return { txs: out.filter(t => t.atMs >= sinceMs), capped }
}

function outcomeCheck(
    base: Pick<HashiHealthCheck, 'key' | 'group' | 'label'>,
    result: { txs: RequestTx[]; capped: boolean },
    now: number,
    noun: string,
): HashiHealthCheck {
    const { txs, capped } = result
    if (!txs.length) {
        return {
            ...base,
            status: 'healthy',
            summary: `No ${noun} request transactions in the last 24 hours`,
            detail: 'Nothing to judge: no one submitted one in the last day.',
        }
    }
    const failed = txs.filter(t => t.failed)
    const lastHour = txs.filter(t => now - t.atMs <= HOUR)
    const failedHour = lastHour.filter(t => t.failed)
    const senders = new Set(failedHour.map(t => t.sender)).size
    const rate = lastHour.length ? failedHour.length / lastHour.length : 0
    const watch = failedHour.length >= 20 && rate >= 0.5 && senders >= 5
    return {
        ...base,
        status: watch ? 'watch' : 'healthy',
        summary: `${failed.length} of ${txs.length} ${noun} request transactions failed ${capped ? 'among the most recent' : 'in the last 24 hours'}`,
        detail: `Last hour: ${failedHour.length} of ${lastHour.length} failed (${(rate * 100).toFixed(1)}%) across ${senders} different senders. Watch needs at least 20 failures, a 50% failure rate and 5 senders in that hour. Individual failures can be invalid user requests.${capped ? ' Only the most recent transactions were read on this busy network.' : ''}`,
    }
}

export async function getHashiHealth(network: string): Promise<HashiHealth> {
    const cfg = getHashiConfig(network)
    const now = Date.now()
    const [{ hashi, bitcoin }, chain, requests, depositTxs, withdrawalTxs] = await Promise.all([
        readHashiState(cfg),
        suiGraphql<ChainResponse>(cfg.graphql, CHAIN_QUERY),
        getHashiRequests(network),
        readRequestTransactions(cfg, 'deposit::deposit', now - 24 * HOUR),
        readRequestTransactions(cfg, 'withdraw::request_withdrawal', now - 24 * HOUR),
    ])
    const config = parseConfig(hashi.config.config.contents)
    const checks: HashiHealthCheck[] = []

    // --- Protocol state
    checks.push({
        key: 'pause',
        group: 'Protocol state',
        label: 'Protocol pause',
        status: config.paused ? 'watch' : 'healthy',
        summary: config.paused ? 'Hashi is paused' : 'Hashi is not paused',
        detail: 'Read from the on-chain pause flag.',
    })

    const hashiEpoch = Number(hashi.committee_set.epoch)
    const suiEpoch = Number(chain.epoch.epochId)
    const epochAgeMs = now - Date.parse(chain.epoch.startTimestamp)
    const pending = hashi.committee_set.pending_epoch_change != null
    const lagging = hashiEpoch < suiEpoch
    const stuck = (lagging || pending) && epochAgeMs > 2 * HOUR
    checks.push({
        key: 'reconfiguration',
        group: 'Protocol state',
        label: 'Reconfiguration',
        status: stuck ? 'watch' : 'healthy',
        summary: pending
            ? 'A reconfiguration is in progress'
            : lagging
              ? `Hashi is at epoch ${hashiEpoch}, Sui at ${suiEpoch}`
              : 'No reconfiguration is pending',
        detail: `Hashi and Sui are at epochs ${hashiEpoch} and ${suiEpoch}. The committee hands over at each Sui epoch change; it only counts as a problem when it has not finished two hours into the new epoch (this epoch is ${ageText(epochAgeMs)} old).${config.reconfigHold ? ' A reconfiguration hold is set.' : ''}`,
    })

    // Two checks are left out until the indexer runs scheduled probes: the share of committee
    // weight whose endpoint answers, and the Guardian service's availability and capacity. A
    // dashboard request should not contact every operator, so they are not shown as "not checked".

    // --- Bridge progression
    if (requests.tooLarge) {
        const note = 'This network has too many requests to read from Sui in full.'
        ;[
            ['requested-deposits', 'Requested deposits'],
            ['approved-deposits', 'Approved deposits'],
            ['requested-withdrawals', 'Requested withdrawals'],
            ['approved-withdrawals', 'Approved withdrawals'],
        ].forEach(([key, label]) =>
            checks.push({
                key,
                group: 'Bridge progression',
                label,
                status: 'unavailable',
                summary: 'Not available on this network',
                detail: note,
            }),
        )
    } else {
        const { deposits, withdrawals } = requests
        const reqDep = deposits.filter(d => d.status === 'pending')
        const appDep = deposits.filter(d => d.status === 'approved')
        const reqWd = withdrawals.filter(w => w.status === 'pending')
        const appWd = withdrawals.filter(w => w.status === 'approved' || w.status === 'signed')
        checks.push(
            queueCheck(
                {
                    key: 'requested-deposits',
                    group: 'Bridge progression',
                    label: 'Requested deposits',
                },
                reqDep.map(d => ({ sender: d.sender, sinceMs: d.createdMs })),
                THRESHOLDS.requestedDepositMs,
                'deposit requests',
                'No deposit requests are waiting for approval',
                now,
            ),
            queueCheck(
                {
                    key: 'approved-deposits',
                    group: 'Bridge progression',
                    label: 'Approved deposits',
                },
                appDep.map(d => ({ sender: d.sender, sinceMs: d.approvedMs ?? d.createdMs })),
                THRESHOLDS.approvedDepositMs,
                'approved deposits',
                'No approved deposits are waiting to be minted',
                now,
            ),
            queueCheck(
                {
                    key: 'requested-withdrawals',
                    group: 'Bridge progression',
                    label: 'Requested withdrawals',
                },
                reqWd.map(w => ({ sender: w.sender, sinceMs: w.createdMs })),
                THRESHOLDS.requestedWithdrawalMs,
                'withdrawal requests',
                'No withdrawal requests are waiting for approval',
                now,
            ),
            queueCheck(
                {
                    key: 'approved-withdrawals',
                    group: 'Bridge progression',
                    label: 'Approved withdrawals',
                },
                appWd.map(w => ({ sender: w.sender, sinceMs: w.approvedMs ?? w.createdMs })),
                THRESHOLDS.approvedWithdrawalMs,
                'approved withdrawals',
                'No approved withdrawals are waiting for Bitcoin',
                now,
            ),
        )
    }

    // Confirmed batches wait in `withdrawal_txns` until archived into `confirmed_txns`
    const openBatches = bitcoin.withdrawal_queue.withdrawal_txns
    const archivedCount = Number(bitcoin.withdrawal_queue.confirmed_txns.size)
    if (Number(openBatches.size) > MAX_TABLE_ROWS) {
        checks.push({
            key: 'archival',
            group: 'Bridge progression',
            label: 'Confirmed withdrawal archival',
            status: 'unavailable',
            summary: 'Not available on this network',
            detail: 'Too many batches to read from Sui in full.',
        })
    } else {
        const open = await readTable<{ confirmed_timestamp_ms: string | null }>(
            cfg.graphql,
            openBatches.id,
            { pageSize: 20, size: Number(openBatches.size) },
        )
        const awaiting = open
            .map(e => msOrNull(e.value?.confirmed_timestamp_ms))
            .filter((ms): ms is number => ms != null)
        const oldestWait = awaiting.length ? now - Math.min(...awaiting) : 0
        checks.push({
            key: 'archival',
            group: 'Bridge progression',
            label: 'Confirmed withdrawal archival',
            status: 'info',
            summary: awaiting.length
                ? `${awaiting.length} confirmed transactions await archival (oldest ${ageText(oldestWait)})`
                : 'No confirmed transactions await archival',
            detail: `${archivedCount} batches are already archived. Bitcoin payments are confirmed before archival; archival is internal on-chain clean-up, so the backlog is informational and never raises an alert.`,
        })
    }

    // --- Request outcomes
    checks.push(
        outcomeCheck(
            {
                key: 'deposit-outcomes',
                group: 'Request outcomes',
                label: 'Deposit request transactions',
            },
            depositTxs,
            now,
            'deposit',
        ),
        outcomeCheck(
            {
                key: 'withdrawal-outcomes',
                group: 'Request outcomes',
                label: 'Withdrawal request transactions',
            },
            withdrawalTxs,
            now,
            'withdrawal',
        ),
    )

    const watchCount = checks.filter(c => c.status === 'watch').length
    return {
        network: network === 'testnet' ? 'testnet' : 'mainnet',
        status: watchCount ? 'watch' : 'healthy',
        watchCount,
        checkedAt: new Date().toISOString(),
        checks,
    }
}
