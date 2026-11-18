import type { HashiDeposit, HashiWithdrawal } from 'src/utils/hashi-chain'
import { getHashiDb } from 'src/utils/hashi-db'

const DAY_MS = 86_400_000
const MAX_DAYS = 30

// The store is trusted only while the indexer keeps writing to it: its events job records the time of its
// last success, and a store older than this falls back to reading the chain (an indexer that stopped
// would otherwise leave Activity showing old requests and empty recent days)
const MAX_STORE_AGE_MS = 15 * 60_000

type DepositRow = {
    id: string
    sender: string
    account: string
    amount: number
    mints: boolean
    txid: string
    created_ms: number
}

type WithdrawalRow = {
    id: string
    sender: string
    amount: number
    created_ms: number
}

/**
 * Every request seen in the indexer's event store, with the steps it went through, for a
 * network too large to read from the chain (testnet's tables hold over a million rows). The store
 * keeps the events, so each request is rebuilt from its own events: requested, approved,
 * confirmed (deposits), and requested, approved, put in a batch (burned), confirmed (withdrawals).
 *
 * Only requests whose "requested" event is stored are included, so a request made before the
 * store started never shows up as half a request. The first, partial day is dropped for the same
 * reason. Expired deposits and cancelled withdrawals are left out: the chain deletes them too.
 *
 * Returns null when no store is configured or it cannot be read, so the caller can fall back to
 * reading the chain.
 */
export async function getHashiRequestsFromDb(
    network: string,
): Promise<{ deposits: HashiDeposit[]; withdrawals: HashiWithdrawal[]; fromMs: number } | null> {
    const sql = getHashiDb(network)
    if (!sql) return null

    try {
        const [run] = await sql`
            select cursor from hashi_sync_state
            where network = ${network} and name = 'job:events'`
        const lastSuccess = Date.parse(run?.cursor ?? '')
        if (!Number.isFinite(lastSuccess) || Date.now() - lastSuccess > MAX_STORE_AGE_MS)
            return null

        const [first] = await sql`
            select (extract(epoch from min(ts)) * 1000)::float8 as ms
            from hashi_events
            where network = ${network} and event_type = 'deposit::DepositRequested'`
        const oldest = first?.ms as number | null
        if (!oldest) return null

        // Start at the first full UTC day after the oldest stored event (never more than
        // MAX_DAYS back), unless the store holds under two days: then use all of it. The
        // MAX_DAYS limit is rounded up to a UTC midnight too: the day filters below (and the
        // daily buckets built from them) assume the window starts on a day boundary
        const now = Date.now()
        const young = now - oldest < 2 * DAY_MS
        const nextDay = Math.ceil(oldest / DAY_MS) * DAY_MS
        const rollingStart = Math.ceil((now - MAX_DAYS * DAY_MS) / DAY_MS) * DAY_MS
        const fromMs = Math.max(young ? oldest : nextDay, rollingStart)
        const from = new Date(fromMs)
        // Where the completed-request figures start: requests are read from `fromMs`, but a withdrawal
        // takes about a day to confirm, so the first day's confirmations mostly belong to requests made
        // before it and are left out (below). A store that young has nothing to spare: keep everything
        const trimMs = young ? fromMs : fromMs + DAY_MS

        // Several small queries joined here, not one big join: the reader role has a short
        // statement timeout, and each of these takes well under a second
        const [depReq, depAppr, depConf, depExpired, wdReq, wdAppr, wdPicked, wdConf, wdCancelled] =
            await Promise.all([
                sql<DepositRow[]>`
                    select
                        payload->>'request_id' as id,
                        payload->>'requester_address' as sender,
                        case when jsonb_typeof(payload->'derivation_path') = 'string'
                            then payload->>'derivation_path'
                            else payload->>'requester_address' end as account,
                        (payload->>'amount')::float8 as amount,
                        (jsonb_typeof(payload->'derivation_path') = 'string') as mints,
                        coalesce(payload->'utxo_id'->>'txid', '') as txid,
                        coalesce((payload->>'timestamp_ms')::float8, extract(epoch from ts) * 1000) as created_ms
                    from hashi_events
                    where network = ${network} and event_type = 'deposit::DepositRequested' and ts >= ${from}`,
                sql<{ id: string; ms: number }[]>`
                    select payload->>'request_id' as id,
                        min(coalesce((payload->>'approval_timestamp_ms')::float8, extract(epoch from ts) * 1000)) as ms
                    from hashi_events
                    where network = ${network} and event_type = 'deposit::DepositApproved' and ts >= ${from}
                    group by 1`,
                sql<{ id: string; ms: number }[]>`
                    select payload->>'request_id' as id, min(extract(epoch from ts) * 1000)::float8 as ms
                    from hashi_events
                    where network = ${network} and event_type = 'deposit::DepositConfirmed' and ts >= ${from}
                    group by 1`,
                sql<{ id: string }[]>`
                    select payload->>'request_id' as id from hashi_events
                    where network = ${network} and event_type = 'deposit::ExpiredDepositDeleted' and ts >= ${from}`,
                sql<WithdrawalRow[]>`
                    select
                        payload->>'request_id' as id,
                        payload->>'requester_address' as sender,
                        (payload->>'btc_amount')::float8 as amount,
                        coalesce((payload->>'timestamp_ms')::float8, extract(epoch from ts) * 1000) as created_ms
                    from hashi_events
                    where network = ${network} and event_type = 'withdrawal_queue::WithdrawalRequested' and ts >= ${from}`,
                sql<{ id: string; ms: number }[]>`
                    select payload->>'request_id' as id, min(extract(epoch from ts) * 1000)::float8 as ms
                    from hashi_events
                    where network = ${network} and event_type = 'withdrawal_queue::WithdrawalApproved' and ts >= ${from}
                    group by 1`,
                // A batch lists the requests it carries: one event per batch, one row per request
                sql<{ id: string; ms: number; txid: string }[]>`
                    select rid as id,
                        min(coalesce((e.payload->>'timestamp_ms')::float8, extract(epoch from e.ts) * 1000)) as ms,
                        min(e.payload->>'txid') as txid
                    from hashi_events e
                    cross join lateral jsonb_array_elements_text(e.payload->'request_ids') as rid
                    where e.network = ${network} and e.event_type = 'withdrawal_queue::WithdrawalPickedForProcessing'
                        and e.ts >= ${from}
                    group by rid`,
                sql<{ id: string; ms: number; txid: string }[]>`
                    select rid as id, min(extract(epoch from e.ts) * 1000)::float8 as ms,
                        min(e.payload->>'txid') as txid
                    from hashi_events e
                    cross join lateral jsonb_array_elements_text(e.payload->'request_ids') as rid
                    where e.network = ${network} and e.event_type = 'withdrawal_queue::WithdrawalConfirmed'
                        and e.ts >= ${from}
                    group by rid`,
                sql<{ id: string }[]>`
                    select payload->>'request_id' as id from hashi_events
                    where network = ${network} and event_type = 'withdrawal_queue::WithdrawalCancelled' and ts >= ${from}`,
            ])

        const msById = (rows: { id: string; ms: number }[]) =>
            new Map(rows.map(r => [r.id, Number(r.ms)]))
        const approvedDeposit = msById(depAppr)
        const confirmedDeposit = msById(depConf)
        const expired = new Set(depExpired.map(r => r.id))
        const approvedWithdrawal = msById(wdAppr)
        const picked = new Map(wdPicked.map(r => [r.id, r]))
        const confirmedWithdrawal = new Map(wdConf.map(r => [r.id, r]))
        const cancelled = new Set(wdCancelled.map(r => r.id))

        const depositRows = depReq
            .filter(d => !expired.has(d.id))
            .map(d => ({
                ...d,
                approved_ms: approvedDeposit.get(d.id) ?? null,
                confirmed_ms: confirmedDeposit.get(d.id) ?? null,
            }))
        const withdrawalRows = wdReq
            .filter(w => !cancelled.has(w.id))
            .map(w => ({
                ...w,
                approved_ms: approvedWithdrawal.get(w.id) ?? null,
                burned_ms: picked.get(w.id)?.ms ?? null,
                txid: confirmedWithdrawal.get(w.id)?.txid ?? picked.get(w.id)?.txid ?? null,
                confirmed_ms: confirmedWithdrawal.get(w.id)?.ms ?? null,
            }))

        const deposits: HashiDeposit[] = depositRows
            .map(d => {
                const confirmedMs = d.confirmed_ms == null ? null : Number(d.confirmed_ms)
                const approvedMs = d.approved_ms == null ? null : Number(d.approved_ms)
                return {
                    id: d.id,
                    sender: d.sender,
                    account: d.account,
                    amountSats: Number(d.amount),
                    mints: d.mints,
                    btcTxid: d.txid,
                    status: confirmedMs ? 'confirmed' : approvedMs ? 'approved' : 'pending',
                    createdMs: Number(d.created_ms),
                    approvedMs,
                    confirmedMs,
                } as HashiDeposit
            })
            // Same cut as for withdrawals below, so the series starts on one complete day
            .filter(d => !d.confirmedMs || d.confirmedMs >= trimMs)
            .sort((a, b) => b.createdMs - a.createdMs)

        const withdrawals: HashiWithdrawal[] = withdrawalRows
            .map(w => {
                const confirmedMs = w.confirmed_ms == null ? null : Number(w.confirmed_ms)
                const approvedMs = w.approved_ms == null ? null : Number(w.approved_ms)
                return {
                    id: w.id,
                    sender: w.sender,
                    account: w.sender,
                    amountSats: Number(w.amount),
                    btcTxid: w.txid,
                    // The store has no "signed" event: a request in a batch that is not yet
                    // confirmed is shown as approved
                    status: confirmedMs
                        ? 'confirmed'
                        : approvedMs || w.burned_ms
                          ? 'approved'
                          : 'pending',
                    createdMs: Number(w.created_ms),
                    approvedMs,
                    burnedMs: w.burned_ms == null ? null : Number(w.burned_ms),
                    confirmedMs,
                } as HashiWithdrawal
            })
            // A withdrawal takes about a day to confirm, so the first day's confirmations (and
            // burns) mostly belong to requests made before the window: they would show a day
            // far quieter than it was. Leave that day out
            .filter(w => !w.confirmedMs || w.confirmedMs >= trimMs)
            .map(w => (w.burnedMs && w.burnedMs < trimMs ? { ...w, burnedMs: null } : w))
            .sort((a, b) => b.createdMs - a.createdMs)

        // `fromMs` is where the figures start counting (what Activity reports as its coverage)
        return { deposits, withdrawals, fromMs: trimMs }
    } catch (error) {
        console.error('hashi requests from the store failed:', error)
        return null
    }
}
