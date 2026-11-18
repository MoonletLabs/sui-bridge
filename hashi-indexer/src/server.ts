import { createServer } from 'http'
import { log } from './log'
import { renderMetrics } from './metrics'

/**
 * Serves /metrics for the Moonlet agent (it finds listening ports on the host and reads /metrics
 * from them). Listens on all interfaces inside the container; docker-compose publishes the port on
 * the host's loopback only, so only the agent on the same machine can reach it.
 * A failure to listen is logged and never stops the indexer: monitoring must not break indexing.
 */
export function startMetricsServer(port: number) {
    if (!port) {
        log('info', 'metrics disabled (METRICS_PORT=0)')
        return
    }
    const server = createServer((req, res) => {
        if (req.method === 'GET' && req.url?.split('?')[0] === '/metrics') {
            try {
                res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' })
                res.end(renderMetrics())
            } catch (error) {
                res.writeHead(500).end(String(error))
            }
            return
        }
        res.writeHead(404).end('not found')
    })
    server.on('error', error => log('warn', 'metrics server error', { error: String(error) }))
    server.listen(port, '0.0.0.0', () => log('info', 'metrics listening', { port }))
}
