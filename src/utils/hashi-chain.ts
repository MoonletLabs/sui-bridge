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
    }
    config: { config: { contents: { key: string; value: Json }[] } }
    treasury: { objects: TableRef }
    proposals: { active: TableRef; executed: TableRef }
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
    )
    const unspent = utxos.filter(u => u.value && u.value.spent_by == null)
    const poolSats = unspent.reduce((sum, u) => sum + Number(u.value.utxo.amount), 0)

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
        pendingWithdrawals: Number(bitcoin.withdrawal_queue.requests.size),
        processedDeposits: Number(bitcoin.deposit_queue.processed.size),
        processedWithdrawals: Number(bitcoin.withdrawal_queue.processed.size),
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
    utxo: { id: { txid: string; vout: number }; amount: string }
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

export type DepositStatus = 'pending' | 'approved' | 'confirmed'
export type WithdrawalStatus = 'pending' | 'approved' | 'signed' | 'confirmed'

export type HashiDeposit = {
    id: string
    sender: string
    amountSats: number
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

    const read = <T>(table: TableRef) => readTable<T>(cfg.graphql, table.id, { pageSize: 40 })
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
    /** Fewest members whose combined weight exceeds one third (can block a quorum) */
    blockingMembers: number
    /** Fewest members whose combined weight reaches the 2/3 quorum */
    quorumMembers: number
}

const epochStat = (c: CommitteeJson): HashiEpochStat => {
    const weights = c.members.map(m => Number(m.weight)).sort((a, b) => b - a)
    const total = weights.reduce((a, b) => a + b, 0)
    const topPct = (n: number) =>
        total ? (weights.slice(0, n).reduce((a, b) => a + b, 0) / total) * 100 : 0
    const countFor = (share: number, inclusive: boolean) => {
        let acc = 0
        for (let i = 0; i < weights.length; i += 1) {
            acc += weights[i]
            if (inclusive ? acc >= total * share : acc > total * share) return i + 1
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
        blockingMembers: countFor(1 / 3, false),
        quorumMembers: countFor(2 / 3, true),
    }
}

export async function getHashiCommittee(network: string) {
    const cfg = getHashiConfig(network)
    const { hashi } = await readHashiState(cfg)
    const set = hashi.committee_set

    const [members, committees, names] = await Promise.all([
        readTable<MemberInfoJson>(cfg.graphql, set.members.id, { pageSize: 40 }),
        // Committees are large (one entry per member with its keys): few per page
        readTable<CommitteeJson>(cfg.graphql, set.committees.id, { pageSize: 10 }),
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
        stats: history.map(epochStat),
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
        readTable<ProposalJson>(cfg.graphql, table.id, { pageSize: 10 })
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
