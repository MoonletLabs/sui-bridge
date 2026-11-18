// Docker healthcheck: healthy only while EVERY job has succeeded recently. Each job touches its own
// file in HEARTBEAT_DIR; one job succeeding cannot hide the other one failing.
const fs = require('fs')
const path = require('path')

const dir = process.env.HEARTBEAT_DIR || '/tmp/hashi-indexer-heartbeat'
const jobs = [
    { name: 'snapshot', every: Number(process.env.SNAPSHOT_SECONDS || 600) },
    { name: 'events', every: Number(process.env.EVENT_SECONDS || 60) },
]

const stale = jobs.filter(({ name, every }) => {
    // Three missed runs plus five minutes of slack for a slow run
    const maxAgeMs = (every * 3 + 300) * 1000
    try {
        return Date.now() - fs.statSync(path.join(dir, name)).mtimeMs >= maxAgeMs
    } catch {
        return true
    }
})

if (stale.length) {
    console.error('stale or missing heartbeat: ' + stale.map(j => j.name).join(', '))
    process.exit(1)
}
