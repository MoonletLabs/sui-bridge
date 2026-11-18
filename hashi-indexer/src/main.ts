import { closeSync, mkdirSync, openSync, utimesSync } from 'fs'
import path from 'path'
import { config } from './config'
import { connect, withLock, type Sql } from './db'
import { runEvents } from './events'
import { log } from './log'
import { collectDbStats, recordGraphql, recordJob, recordStart } from './metrics'
import { migrate } from './migrate'
import { startMetricsServer } from './server'
import { runSnapshot } from './snapshot'
import { setGraphqlObserver } from 'src/utils/sui-graphql'

let stopping = false
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * The healthcheck looks at the age of one file per job, touched when that job succeeds. Both must
 * be fresh: a job that keeps failing is not hidden by the other one succeeding.
 */
const heartbeat = (job: string) => {
    const now = new Date()
    try {
        mkdirSync(config.heartbeatDir, { recursive: true })
        const file = path.join(config.heartbeatDir, job)
        closeSync(openSync(file, 'a'))
        utimesSync(file, now, now)
    } catch {
        // A missing heartbeat only makes the healthcheck fail, which is the right signal
    }
}

async function recordRun(sql: Sql, name: string, error: string | null) {
    await sql`
        insert into hashi_sync_state (network, name, cursor, updated_at, last_error)
        values (${config.network}, ${`job:${name}`}, ${error ? null : new Date().toISOString()}, now(), ${error})
        on conflict (network, name) do update set
            cursor = coalesce(excluded.cursor, hashi_sync_state.cursor),
            updated_at = now(), last_error = excluded.last_error`
}

async function runJob(sql: Sql, name: string, job: () => Promise<unknown>) {
    const started = Date.now()
    try {
        const result = await withLock(sql, `hashi-indexer:${config.network}:${name}`, job)
        if (result === null) {
            recordJob(name, 'skipped', (Date.now() - started) / 1000)
            log('info', 'job skipped, another run holds the lock', { job: name })
            return
        }
        heartbeat(name)
        recordJob(name, 'ok', (Date.now() - started) / 1000)
        await recordRun(sql, name, null)
        log('info', 'job ok', { job: name, ms: Date.now() - started, result })
    } catch (error) {
        recordJob(name, 'error', (Date.now() - started) / 1000)
        log('error', 'job failed', { job: name, error: String(error) })
        await recordRun(sql, name, String(error)).catch(() => undefined)
    }
    // After every run, whatever its outcome (throttled inside): the database figures
    // and a failing job should both stay visible
    collectDbStats(sql, config.network).catch(() => undefined)
}

async function loop(sql: Sql, name: string, everySeconds: number, job: () => Promise<unknown>) {
    while (!stopping) {
        await runJob(sql, name, job)
        // Sleep in short steps so a shutdown signal is honoured quickly
        for (let waited = 0; waited < everySeconds * 1000 && !stopping; waited += 1000) {
            await sleep(1000)
        }
    }
}

async function main() {
    const sql = connect(config.database)
    recordStart(process.env.HASHI_INDEXER_VERSION || 'dev')
    setGraphqlObserver(recordGraphql)
    startMetricsServer(config.metricsPort)
    log('info', 'starting', {
        version: process.env.HASHI_INDEXER_VERSION || 'dev',
        network: config.network,
        snapshotSeconds: config.snapshotSeconds,
        eventSeconds: config.eventSeconds,
        backfillDays: config.backfillDays,
    })

    // The database container may still be starting
    for (let attempt = 1; ; attempt += 1) {
        try {
            await migrate(sql)
            break
        } catch (error) {
            if (attempt >= 20) throw error
            log('warn', 'database not ready, retrying', { attempt, error: String(error) })
            await sleep(3000)
        }
    }

    const shutdown = () => {
        log('info', 'stopping')
        stopping = true
    }
    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)

    await Promise.all([
        loop(sql, 'snapshot', config.snapshotSeconds, () => runSnapshot(sql, config.network)),
        loop(sql, 'events', config.eventSeconds, () => runEvents(sql, config.network)),
    ])
    await sql.end({ timeout: 5 })
}

main().catch(error => {
    log('error', 'fatal', { error: String(error) })
    process.exit(1)
})
