// Docker healthcheck: healthy while some job has succeeded recently
const fs = require('fs')
const file = process.env.HEARTBEAT_FILE || '/tmp/hashi-indexer.heartbeat'
const maxAgeMs = Number(process.env.HEALTH_MAX_AGE_SECONDS || 900) * 1000
try {
    process.exit(Date.now() - fs.statSync(file).mtimeMs < maxAgeMs ? 0 : 1)
} catch {
    process.exit(1)
}
