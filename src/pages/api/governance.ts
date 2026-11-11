import { withCache } from 'src/utils/api-cache'
import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import {
    describeGovernanceAction,
    GOVERNANCE_ACTION_LABELS,
    GovernanceEvent,
    GovChain,
} from 'src/utils/governance'
import { base58Encode } from 'src/utils/helper'
import db from './database'
import { parseIntParam, sendError, sendReply } from './utils'

export type RouteLimit = {
    from: GovChain
    to: GovChain
    limit_usd: number
    updated_ms: number
    /** USD moved on this route in the last 24h (current token prices) */
    usage_24h_usd: number
    transfers_24h: number
    /** usage / limit, 0-1+ */
    utilization: number | null
}

export type GovernanceResponse = {
    events: GovernanceEvent[]
    total: number
    actions: { action: string; label: string; count: number }[]
    limits: RouteLimit[]
}

/** The table is small (tens of rows) - cap defensively anyway */
const MAX_ROWS = 1000

async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const sql = db[networkConfig.network]
        const ids = networkConfig.config.networkId

        const limit = parseIntParam(req.query.limit, 25, 100) || 25
        const offset = parseIntParam(req.query.offset, 0)
        const actionFilter = req.query.action?.toString() || ''

        const sinceMs = Date.now() - 24 * 3600 * 1000

        const [rows, usageRows] = await Promise.all([
            sql`
                SELECT id, action, data_source, nonce, timestamp_ms, data,
                       encode(txn_digest, 'hex') AS txn_digest
                FROM public.governance_actions
                ORDER BY timestamp_ms DESC
                LIMIT ${MAX_ROWS}
            `,
            sql`
                SELECT
                    t.chain_id,
                    COUNT(*) AS transfers,
                    COALESCE(SUM((t.amount::NUMERIC / NULLIF(p.denominator, 0)) * p.price::NUMERIC), 0) AS usd
                FROM public.token_transfer_data t
                JOIN public.prices p ON p.token_id = t.token_id
                WHERE t.is_finalized = true AND t.timestamp_ms >= ${sinceMs}
                GROUP BY t.chain_id
            `,
        ])

        // The indexer records some events twice (same transaction seen at two
        // checkpoints); keep the earliest of each identical record.
        const seen = new Set<string>()
        const all: GovernanceEvent[] = []
        for (const row of [...(rows as any[])].reverse()) {
            const key = `${row.data_source}|${row.action}|${row.txn_digest}|${JSON.stringify(row.data)}`
            if (seen.has(key)) continue
            seen.add(key)

            const source: GovChain = row.data_source === 'ETH' ? 'ETH' : 'SUI'
            const described = describeGovernanceAction(row.action, row.data, {
                chainIds: ids,
                coins: networkConfig.config.coins,
            })
            all.push({
                id: Number(row.id),
                action: row.action,
                source,
                timestamp_ms: Number(row.timestamp_ms),
                nonce: row.nonce === null ? null : Number(row.nonce),
                tx_digest: source === 'SUI' ? base58Encode(row.txn_digest) : `0x${row.txn_digest}`,
                ...described,
            })
        }
        all.reverse() // newest first

        // Current limit per route = most recent update seen on either chain
        const latest = new Map<string, GovernanceEvent>()
        for (const e of [...all].reverse()) {
            if (e.action === 'UpdateBridgeLimit' && e.route && e.limit_usd !== undefined) {
                latest.set(`${e.route.from}-${e.route.to}`, e)
            }
        }
        const usage = new Map<GovChain, { usd: number; count: number }>()
        for (const r of usageRows as any[]) {
            const chain: GovChain = Number(r.chain_id) === ids.SUI ? 'SUI' : 'ETH'
            usage.set(chain, { usd: Number(r.usd) || 0, count: Number(r.transfers) || 0 })
        }
        const limits: RouteLimit[] = Array.from(latest.values()).map(e => {
            const u = usage.get(e.route!.from) || { usd: 0, count: 0 }
            return {
                from: e.route!.from,
                to: e.route!.to,
                limit_usd: e.limit_usd!,
                updated_ms: e.timestamp_ms,
                usage_24h_usd: u.usd,
                transfers_24h: u.count,
                utilization: e.limit_usd! > 0 ? u.usd / e.limit_usd! : null,
            }
        })

        const counts = new Map<string, number>()
        all.forEach(e => counts.set(e.action, (counts.get(e.action) || 0) + 1))
        const actions = Array.from(counts.entries())
            .map(([action, count]) => ({
                action,
                label: GOVERNANCE_ACTION_LABELS[action] || action,
                count,
            }))
            .sort((a, b) => b.count - a.count)

        const filtered = actionFilter ? all.filter(e => e.action === actionFilter) : all

        const response: GovernanceResponse = {
            events: filtered.slice(offset, offset + limit),
            total: filtered.length,
            actions,
            limits,
        }
        sendReply(res, response)
    } catch (error) {
        console.error('Governance API error:', error)
        sendError(res, { code: 500, message: 'Failed to load governance data' })
    }
}

export default withCache(handler, 60)
