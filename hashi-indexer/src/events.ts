import { getHashiConfig } from 'src/config/hashi'
import { suiGraphql } from 'src/utils/sui-graphql'
import { config } from './config'
import { inChunks, type Sql } from './db'
import { log } from './log'

// The request lifecycle. Each type is read independently, with its own cursor.
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

const cursorName = (type: string) => `events:${type}`

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

async function saveCursor(sql: Sql, network: string, type: string, cursor: string | null) {
    await sql`
        insert into hashi_sync_state (network, name, cursor, updated_at)
        values (${network}, ${cursorName(type)}, ${cursor}, now())
        on conflict (network, name) do update set cursor = excluded.cursor, updated_at = now()`
}

/**
 * First run on a network with a backfill limit: walk back from the newest event until the
 * cutoff, then continue forward from the newest cursor.
 */
async function backfillRecent(sql: Sql, network: string, type: string, fullType: string) {
    const cfg = getHashiConfig(network)
    const cutoff = Date.now() - config.backfillDays * 86_400_000
    let before: string | null = null
    let newest: string | null = null
    let stored = 0
    for (let page = 0; page < config.maxPagesPerRun; page += 1) {
        const data: Page = await suiGraphql<Page>(cfg.graphql, BACKWARD, {
            type: fullType,
            before,
        })
        const { nodes, pageInfo } = data.events
        if (page === 0) newest = pageInfo.endCursor
        const recent = nodes.filter(n => Date.parse(n.timestamp) >= cutoff)
        stored += await saveEvents(sql, network, type, recent)
        const reachedCutoff = recent.length < nodes.length
        if (reachedCutoff || !pageInfo.hasPreviousPage) break
        before = pageInfo.startCursor ?? null
        if (page === config.maxPagesPerRun - 1) {
            // Older events inside the window are left out: the cap protects the endpoint
            log('warn', 'backfill stopped at the page cap', { type, stored })
        }
    }
    await saveCursor(sql, network, type, newest)
    return stored
}

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
        // Persist after every page so a long backfill resumes where it stopped
        await saveCursor(sql, network, type, cursor)
        if (!pageInfo.hasNextPage) break
    }
    return stored
}

export async function runEvents(sql: Sql, network: string) {
    const cfg = getHashiConfig(network)
    const stored: Record<string, number> = {}
    for (const type of EVENT_TYPES) {
        const fullType = `${cfg.packageId}::${type}`
        const [state] = await sql`
            select cursor from hashi_sync_state
            where network = ${network} and name = ${cursorName(type)}`
        const cursor: string | null = state?.cursor ?? null
        try {
            stored[type] =
                !cursor && config.backfillDays > 0
                    ? await backfillRecent(sql, network, type, fullType)
                    : await forward(sql, network, type, fullType, cursor)
        } catch (error) {
            // One failing type must not stop the others
            log('warn', 'event type failed', { type, error: String(error) })
        }
    }
    return stored
}
