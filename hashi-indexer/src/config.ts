const int = (name: string, fallback: number) => {
    const raw = process.env[name]
    if (raw === undefined || raw === '') return fallback
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) throw new Error(`${name} must be a non-negative number`)
    return n
}

const network = process.env.NETWORK === 'testnet' ? 'testnet' : 'mainnet'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

export const config = {
    network,
    databaseUrl,
    /** How often the state snapshot (supply, reserve, queues, committee, requests) runs */
    snapshotSeconds: int('SNAPSHOT_SECONDS', 600),
    /** How often new Hashi events are pulled */
    eventSeconds: int('EVENT_SECONDS', 60),
    /**
     * First run only: how far back to read events. 0 reads everything, which suits mainnet.
     * A busy network (testnet has millions of requests) needs a limit.
     */
    backfillDays: int('BACKFILL_DAYS', network === 'testnet' ? 3 : 0),
    /** Event pages (50 events each) read per type per run, so a long backfill resumes next run */
    maxPagesPerRun: int('EVENTS_MAX_PAGES_PER_RUN', 100),
    heartbeatFile: process.env.HEARTBEAT_FILE || '/tmp/hashi-indexer.heartbeat',
}
