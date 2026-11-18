import { getHashiConfig } from 'src/config/hashi'
import { suiGraphql } from 'src/utils/sui-graphql'
import { config } from './config'
import { inChunks, type Sql } from './db'
import { log } from './log'

// The request lifecycle. Each type is read independently, with its own cursors.
const EVENT_TYPES = [
    'deposit::DepositRequested',
    'deposit::DepositApproved',
    'deposit::DepositConfirmed',
    'withdrawal_queue::WithdrawalRequested',
    'withdrawal_queue::WithdrawalApproved',
    'withdrawal_queue::WithdrawalPickedForProcessing',
    'withdrawal_queue::WithdrawalConfirmed',
]

const NODE = `sequenceNumber timestamp transaction { digest } contents { json }`

const FORWARD = `
query ($type: String!, $after: String) {
    events(first: 50, after: $after, filter: { type: $type }) {
        pageInfo { hasNextPage endCursor }
        nodes { ${NODE} }
    }
}`

const BACKWARD = `
query ($type: String!, $before: String) {
    events(last: 50, before: $before, filter: { type: $type }) {
        pageInfo { hasPreviousPage startCursor endCursor }
        nodes { ${NODE} }
    }
}`

type EventNode = {
    sequenceNumber: number
    timestamp: string
    transaction: { digest: string } | null
    contents: { json: unknown }
}

type Page = {
    events: {
        pageInfo: {
            hasNextPage?: boolean
            hasPreviousPage?: boolean
            startCursor?: string | null
            endCursor: string | null
        }
        nodes: EventNode[]
    }
}

// Two cursors per type, both in hashi_sync_state:
//  - `events:<type>`   where forward reading continues (new events)
//  - `backfill:<type>` where the backward read of the BACKFILL_DAYS window continues, or 'done'
const FORWARD_NAME = (type: string) => `events:${type}`
const BACKFILL_NAME = (type: string) => `backfill:${type}`
const BACKFILL_DONE = 'done'

async function getCursor(sql: Sql, network: string, name: string): Promise<string | null> {
    const [row] = await sql`
        select cursor from hashi_sync_state where network = ${network} and name = ${name}`
    return row?.cursor ?? null
}

async function saveCursor(sql: Sql, network: string, name: string, cursor: string | null) {
    await sql`
        insert into hashi_sync_state (network, name, cursor, updated_at)
        values (${network}, ${name}, ${cursor}, now())
        on conflict (network, name) do update set cursor = excluded.cursor, updated_at = now()`
}

async function saveEvents(sql: Sql, network: string, type: string, nodes: EventNode[]) {
    const rows = nodes
        .filter(n => n.transaction)
        .map(n => ({
            network,
            event_type: type,
            tx_digest: (n.transaction as { digest: string }).digest,
            event_seq: n.sequenceNumber,
            ts: n.timestamp,
            // postgres.js encodes objects for jsonb itself: a pre-stringified value would be
            // stored as a JSON string instead of an object
            payload: sql.json(n.contents.json as Parameters<typeof sql.json>[0]),
        }))
    await inChunks(
        rows,
        200,
        chunk => sql`insert into hashi_events ${sql(chunk)} on conflict do nothing`,
    )
    return rows.length
}

/** New events: continue forward from `start` (null reads from the very beginning) */
async function forward(
    sql: Sql,
    network: string,
    type: string,
    fullType: string,
    start: string | null,
) {
    const cfg = getHashiConfig(network)
    let cursor = start
    let stored = 0
    for (let page = 0; page < config.maxPagesPerRun; page += 1) {
        const data: Page = await suiGraphql<Page>(cfg.graphql, FORWARD, {
            type: fullType,
            after: cursor,
        })
        const { nodes, pageInfo } = data.events
        stored += await saveEvents(sql, network, type, nodes)
        if (pageInfo.endCursor) cursor = pageInfo.endCursor
        // Persist after every page so a long read resumes where it stopped
        await saveCursor(sql, network, FORWARD_NAME(type), cursor)
        if (!pageInfo.hasNextPage) break
    }
    return stored
}

/**
 * The BACKFILL_DAYS window, read backward from the newest event. The first call (`resume` null)
 * also sets the forward cursor at the newest event, so new events are picked up from there.
 * Each run reads at most maxPagesPerRun pages and saves where it stopped; the backfill is marked
 * done only once it reaches the cutoff or the start of history, so a window larger than one run
 * is finished over the following runs instead of being cut off.
 */
async function backfill(
    sql: Sql,
    network: string,
    type: string,
    fullType: string,
    resume: string | null,
) {
    const cfg = getHashiConfig(network)
    const cutoff = Date.now() - config.backfillDays * 86_400_000
    let before = resume
    let stored = 0
    for (let page = 0; page < config.maxPagesPerRun; page += 1) {
        const data: Page = await suiGraphql<Page>(cfg.graphql, BACKWARD, {
            type: fullType,
            before,
        })
        const { nodes, pageInfo } = data.events
        if (resume === null && page === 0) {
            if (!pageInfo.endCursor) return 0 // no events yet: start over next run
            await saveCursor(sql, network, FORWARD_NAME(type), pageInfo.endCursor)
        }
        const recent = nodes.filter(n => Date.parse(n.timestamp) >= cutoff)
        stored += await saveEvents(sql, network, type, recent)
        if (recent.length < nodes.length || !pageInfo.hasPreviousPage) {
            await saveCursor(sql, network, BACKFILL_NAME(type), BACKFILL_DONE)
            return stored
        }
        before = pageInfo.startCursor ?? null
        await saveCursor(sql, network, BACKFILL_NAME(type), before)
    }
    log('info', 'backfill continues next run', { type, stored })
    return stored
}

export async function runEvents(sql: Sql, network: string) {
    const cfg = getHashiConfig(network)
    const stored: Record<string, number> = {}
    const failures: string[] = []

    for (const type of EVENT_TYPES) {
        const fullType = `${cfg.packageId}::${type}`
        try {
            const fwd = await getCursor(sql, network, FORWARD_NAME(type))
            let count = 0
            if (!fwd) {
                // First run for this type
                count +=
                    config.backfillDays > 0
                        ? await backfill(sql, network, type, fullType, null)
                        : await forward(sql, network, type, fullType, null)
            } else {
                count += await forward(sql, network, type, fullType, fwd)
                // A backfill left unfinished by an earlier run carries on
                const bf = await getCursor(sql, network, BACKFILL_NAME(type))
                if (config.backfillDays > 0 && bf && bf !== BACKFILL_DONE) {
                    count += await backfill(sql, network, type, fullType, bf)
                }
            }
            stored[type] = count
        } catch (error) {
            // One failing type must not stop the others...
            failures.push(`${type}: ${String(error)}`)
            log('warn', 'event type failed', { type, error: String(error) })
        }
    }

    // ...but the run is not a success: the job status and the healthcheck must show it
    if (failures.length) {
        throw new Error(
            `${failures.length} of ${EVENT_TYPES.length} event types failed: ${failures[0]}`,
        )
    }
    return stored
}
