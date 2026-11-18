const int = (name: string, fallback: number) => {
    const raw = process.env[name]
    if (raw === undefined || raw === '') return fallback
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a non-negative number`)
    return n
}

const network = process.env.NETWORK === 'testnet' ? 'testnet' : 'mainnet'

export type Database =
    | { url: string }
    | { host: string; port: number; database: string; user: string; password: string }

/**
 * Either DATABASE_URL, or the connection fields separately (DB_HOST, DB_PORT, DB_NAME, DB_USER,
 * DB_PASSWORD). The compose file uses the fields: a password with characters such as / # ? or @
 * would need percent-encoding inside a URL, but works as it is when passed on its own.
 */
const database = (): Database => {
    if (process.env.DATABASE_URL) return { url: process.env.DATABASE_URL }
    const host = process.env.DB_HOST
    const name = process.env.DB_NAME
    const user = process.env.DB_USER
    if (!host || !name || !user) {
        throw new Error('Set DATABASE_URL, or DB_HOST, DB_PORT, DB_NAME, DB_USER and DB_PASSWORD')
    }
    return {
        host,
        port: int('DB_PORT', 5433),
        database: name,
        user,
        password: process.env.DB_PASSWORD ?? '',
    }
}

export const config = {
    network,
    database: database(),
    /** How often the state snapshot (supply, reserve, queues, committee, requests) runs */
    snapshotSeconds: int('SNAPSHOT_SECONDS', 600),
    /** How often new Hashi events are pulled */
    eventSeconds: int('EVENT_SECONDS', 60),
    /**
     * First run only: how far back to read events. 0 reads everything, which suits mainnet.
     * A busy network (testnet has millions of requests) needs a limit.
     */
    backfillDays: int('BACKFILL_DAYS', network === 'testnet' ? 7 : 0),
    /** Event pages (50 events each) read per type per run, so a long backfill resumes next run */
    maxPagesPerRun: int('EVENTS_MAX_PAGES_PER_RUN', 100),
    heartbeatFile: process.env.HEARTBEAT_FILE || '/tmp/hashi-indexer.heartbeat',
}
