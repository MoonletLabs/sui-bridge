/**
 * Prometheus metrics, in the text exposition format, without a client library (a few counters,
 * gauges and histograms are all this needs). Served by server.ts on METRICS_PORT.
 *
 * Naming: everything starts with `hashi_indexer_`. There is no `network` label on purpose: the
 * Moonlet agent adds `network` (and `hostname`, `blockchain`, ...) to every metric it collects, and
 * its labels win over the metric's own.
 */
import { monitorEventLoopDelay } from 'perf_hooks'
import type { HashiOverview } from 'src/utils/hashi-chain'
import type { Sql } from './db'

type Labels = Record<string, string>

const PREFIX = 'hashi_indexer_'

const escapeLabel = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')

const labelKey = (labels: Labels) =>
    Object.keys(labels)
        .sort()
        .map(k => `${k}="${escapeLabel(labels[k])}"`)
        .join(',')

const braces = (key: string) => (key ? `{${key}}` : '')

const number = (value: number) => (Number.isFinite(value) ? String(value) : null)

type Metric = { render: () => string[] }
const registry: Metric[] = []

const header = (name: string, help: string, type: string) => [
    `# HELP ${PREFIX}${name} ${help}`,
    `# TYPE ${PREFIX}${name} ${type}`,
]

function gauge(name: string, help: string, type: 'gauge' | 'counter' = 'gauge') {
    const series = new Map<string, number>()
    registry.push({
        render: () => {
            const lines = header(name, help, type)
            series.forEach((value, key) => {
                const v = number(value)
                if (v !== null) lines.push(`${PREFIX}${name}${braces(key)} ${v}`)
            })
            return series.size ? lines : []
        },
    })
    return {
        set: (value: number, labels: Labels = {}) => void series.set(labelKey(labels), value),
    }
}

function counter(name: string, help: string) {
    const series = new Map<string, number>()
    registry.push({
        render: () => {
            const lines = header(name, help, 'counter')
            series.forEach((value, key) => lines.push(`${PREFIX}${name}${braces(key)} ${value}`))
            return series.size ? lines : []
        },
    })
    return {
        inc: (labels: Labels = {}, by = 1) => {
            const key = labelKey(labels)
            series.set(key, (series.get(key) ?? 0) + by)
        },
    }
}

function histogram(name: string, help: string, buckets: number[]) {
    type Series = { counts: number[]; sum: number; count: number }
    const series = new Map<string, Series>()
    registry.push({
        render: () => {
            const lines = header(name, help, 'histogram')
            series.forEach((s, key) => {
                const sep = key ? `${key},` : ''
                let cumulative = 0
                buckets.forEach((le, i) => {
                    cumulative += s.counts[i]
                    lines.push(`${PREFIX}${name}_bucket{${sep}le="${le}"} ${cumulative}`)
                })
                lines.push(`${PREFIX}${name}_bucket{${sep}le="+Inf"} ${s.count}`)
                lines.push(`${PREFIX}${name}_sum${braces(key)} ${s.sum}`)
                lines.push(`${PREFIX}${name}_count${braces(key)} ${s.count}`)
            })
            return series.size ? lines : []
        },
    })
    return {
        observe: (value: number, labels: Labels = {}) => {
            const key = labelKey(labels)
            let s = series.get(key)
            if (!s) {
                s = { counts: buckets.map(() => 0), sum: 0, count: 0 }
                series.set(key, s)
            }
            const i = buckets.findIndex(le => value <= le)
            if (i >= 0) s.counts[i] += 1
            s.sum += value
            s.count += 1
        },
    }
}

// ----------------------------------------------------------------------
// The indexer itself

const info = gauge('info', 'Indexer build: always 1, the version is the label')
const startTime = gauge('start_time_seconds', 'When the indexer process started (unix seconds)')

const jobRuns = counter('job_runs_total', 'Job runs by outcome (ok, error, skipped)')
const jobDuration = histogram(
    'job_duration_seconds',
    'How long a job run took',
    [0.5, 1, 2, 5, 10, 30, 60, 120, 300],
)
const jobLastSuccess = gauge(
    'job_last_success_timestamp_seconds',
    'When the job last succeeded (unix seconds)',
)
const jobLastOk = gauge('job_last_run_ok', '1 if the last run of the job succeeded, 0 if it failed')

// Both outcomes exist from the start: a counter that first appears at 1 hides that first failure
// from rate() and increase()
const JOBS = ['snapshot', 'events']
const OUTCOMES = ['ok', 'error', 'skipped'] as const
JOBS.forEach(job => OUTCOMES.forEach(result => jobRuns.inc({ job, result }, 0)))

const eventsStored = counter('events_stored_total', 'Events read from Sui and stored, by type')
const eventsCaughtUp = gauge(
    'events_caught_up',
    '1 if reading new events of this type reached the end of the chain, 0 if a run stopped at its page limit',
)
const backfillDone = gauge('backfill_done', '1 once the history window of this type is stored')

const graphqlRequests = counter('graphql_requests_total', 'Requests to Sui GraphQL by outcome')
const graphqlDuration = histogram(
    'graphql_request_duration_seconds',
    'Latency of requests to Sui GraphQL',
    [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 15],
)

graphqlRequests.inc({ result: 'ok' }, 0)
graphqlRequests.inc({ result: 'error' }, 0)

// Hashi's on-chain state, as of the last snapshot
const chain = {
    supply: gauge('supply_sats', 'hBTC supply (satoshis)'),
    reserve: gauge('reserve_sats', 'BTC held by the committee (satoshis)'),
    backing: gauge('backing_ratio', 'Reserve divided by supply: 1 means fully backed'),
    utxos: gauge('utxos', 'Unspent UTXOs in the reserve'),
    pendingDeposits: gauge('pending_deposits', 'Deposit requests waiting'),
    pendingWithdrawals: gauge('pending_withdrawals', 'Withdrawal requests waiting'),
    processedDeposits: gauge('processed_deposits', 'Deposits completed so far'),
    processedWithdrawals: gauge('processed_withdrawals', 'Withdrawals completed so far'),
    epoch: gauge('epoch', 'Hashi epoch'),
    paused: gauge('paused', '1 if Hashi is paused'),
    members: gauge('registered_members', 'Operators registered with Hashi'),
}

// The database
const dbUp = gauge('db_up', '1 if the last database check worked')
const dbSize = gauge('db_size_bytes', 'Size of the Hashi database')
const dbTableBytes = gauge('db_table_bytes', 'Size of a table with its indexes')
const dbTableRows = gauge('db_table_rows', 'Rows in a table, as Postgres counts them (approximate)')
const eventsInDb = gauge('events_in_db', 'Events stored, by type')
const newestEvent = gauge(
    'newest_event_timestamp_seconds',
    'Timestamp of the newest stored event of this type (a quiet type can be old: see events_caught_up)',
)

// The process
const processGauges = {
    rss: gauge('process_resident_memory_bytes', 'Resident memory'),
    heap: gauge('process_heap_used_bytes', 'Heap in use'),
    cpu: gauge(
        'process_cpu_seconds_total',
        'CPU time used by the process (user + system)',
        'counter',
    ),
    loop: gauge('process_event_loop_delay_seconds_p99', 'Event loop delay, 99th percentile'),
}
const loopDelay = monitorEventLoopDelay({ resolution: 20 })
loopDelay.enable()

// ----------------------------------------------------------------------
// Recording helpers

export function recordStart(version: string) {
    info.set(1, { version })
    startTime.set(Math.floor(Date.now() / 1000))
}

export function recordJob(job: string, result: 'ok' | 'error' | 'skipped', seconds: number) {
    jobRuns.inc({ job, result })
    if (result === 'skipped') return
    jobDuration.observe(seconds, { job })
    jobLastOk.set(result === 'ok' ? 1 : 0, { job })
    if (result === 'ok') jobLastSuccess.set(Math.floor(Date.now() / 1000), { job })
}

export function recordEventType(
    type: string,
    stored: number,
    caughtUp: boolean | null,
    backfillIsDone: boolean,
) {
    // Always, even by 0: the series must exist from the first run for rate() and increase() to work
    eventsStored.inc({ type }, stored)
    if (caughtUp !== null) eventsCaughtUp.set(caughtUp ? 1 : 0, { type })
    backfillDone.set(backfillIsDone ? 1 : 0, { type })
}

export function recordGraphql({ ok, ms }: { ok: boolean; ms: number }) {
    graphqlRequests.inc({ result: ok ? 'ok' : 'error' })
    graphqlDuration.observe(ms / 1000)
}

export function recordState(o: HashiOverview) {
    chain.supply.set(o.supplySats)
    chain.reserve.set(o.poolSats)
    if (o.backingRatio != null) chain.backing.set(o.backingRatio)
    chain.utxos.set(o.poolUtxoCount)
    chain.pendingDeposits.set(o.pendingDeposits)
    chain.pendingWithdrawals.set(o.pendingWithdrawals)
    chain.processedDeposits.set(o.processedDeposits)
    chain.processedWithdrawals.set(o.processedWithdrawals)
    chain.epoch.set(o.epoch)
    chain.paused.set(o.config.paused ? 1 : 0)
    chain.members.set(o.registeredMembers)
}

// Counting rows is not free on a large table, and a scrape must never wait for the database:
// the figures are refreshed in the background, at most once a minute
const DB_STATS_EVERY_MS = 60_000
let lastDbStats = 0

export async function collectDbStats(sql: Sql, network: string) {
    if (Date.now() - lastDbStats < DB_STATS_EVERY_MS) return
    lastDbStats = Date.now()
    try {
        const [size] = await sql`select pg_database_size(current_database())::float8 as bytes`
        // n_live_tup is kept up to date as rows are written. pg_class.reltuples is not: it stays at -1
        // until a table is first vacuumed or analyzed, which showed every small table as empty
        const tables = await sql`
            select relname as name, pg_total_relation_size(relid)::float8 as bytes,
                n_live_tup::float8 as rows
            from pg_stat_user_tables
            where schemaname = 'public'`
        const events = await sql`
            select event_type, count(*)::float8 as n,
                extract(epoch from max(ts))::float8 as newest
            from hashi_events where network = ${network} group by 1`
        dbSize.set(size.bytes)
        tables.forEach(t => {
            dbTableBytes.set(t.bytes, { table: t.name })
            dbTableRows.set(t.rows, { table: t.name })
        })
        events.forEach(e => {
            eventsInDb.set(e.n, { type: e.event_type })
            newestEvent.set(e.newest, { type: e.event_type })
        })
        dbUp.set(1)
    } catch {
        dbUp.set(0)
        // Try again on the next run, not a minute from now
        lastDbStats = 0
    }
}

export function renderMetrics(): string {
    const mem = process.memoryUsage()
    const cpu = process.cpuUsage()
    processGauges.rss.set(mem.rss)
    processGauges.heap.set(mem.heapUsed)
    processGauges.cpu.set((cpu.user + cpu.system) / 1e6)
    processGauges.loop.set(loopDelay.percentile(99) / 1e9)
    return `${registry.flatMap(m => m.render()).join('\n')}\n`
}
