import { withCache } from 'src/utils/api-cache'
import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig, TimePeriod } from 'src/config/helper'
import { calculateStartDate } from 'src/utils/format-chart-data'
import db from '../database'
import { sendError, sendReply } from '../utils'

export type LatencyDirection = 'ETH → SUI' | 'SUI → ETH'

export type LatencyStats = {
    direction: LatencyDirection
    deposits: number
    approved: number
    claimed: number
    /** Deposit -> committee approval, in minutes (the bridge's own latency) */
    approval_p50: number | null
    approval_p90: number | null
    approval_p95: number | null
    /** Deposit -> claim, in minutes (includes any wait for the user to claim) */
    claim_p50: number | null
    claim_p90: number | null
    claim_p95: number | null
}

export type LatencySeriesPoint = {
    date: string
    direction: LatencyDirection
    approval_p50: number | null
    approval_p95: number | null
    transfers: number
}

export type LatencyResponse = {
    period: string
    stats: LatencyStats[]
    series: LatencySeriesPoint[]
}

const num = (v: any): number | null => (v === null || v === undefined ? null : Number(v))

/**
 * Transfer latency, derived from the three lifecycle records every transfer has
 * in `token_transfer`: Deposited -> Approved -> Claimed.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const sql = db[networkConfig.network]
        const timePeriod = (req.query.period as TimePeriod) || 'Last Month'
        const startMs = calculateStartDate(timePeriod).valueOf()
        const suiId = networkConfig.config.networkId.SUI

        const [statRows, seriesRows] = await Promise.all([
            sql`
                WITH d AS (
                    SELECT chain_id, nonce, timestamp_ms FROM public.token_transfer
                    WHERE status = 'Deposited' AND timestamp_ms >= ${startMs}
                ),
                a AS (
                    SELECT chain_id, nonce, timestamp_ms FROM public.token_transfer
                    WHERE status = 'Approved' AND timestamp_ms >= ${startMs}
                ),
                c AS (
                    SELECT chain_id, nonce, timestamp_ms FROM public.token_transfer
                    WHERE status = 'Claimed' AND timestamp_ms >= ${startMs}
                )
                SELECT
                    d.chain_id,
                    COUNT(*) AS deposits,
                    COUNT(a.nonce) AS approved,
                    COUNT(c.nonce) AS claimed,
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY (a.timestamp_ms - d.timestamp_ms) / 60000.0) AS approval_p50,
                    percentile_cont(0.9) WITHIN GROUP (ORDER BY (a.timestamp_ms - d.timestamp_ms) / 60000.0) AS approval_p90,
                    percentile_cont(0.95) WITHIN GROUP (ORDER BY (a.timestamp_ms - d.timestamp_ms) / 60000.0) AS approval_p95,
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY (c.timestamp_ms - d.timestamp_ms) / 60000.0) AS claim_p50,
                    percentile_cont(0.9) WITHIN GROUP (ORDER BY (c.timestamp_ms - d.timestamp_ms) / 60000.0) AS claim_p90,
                    percentile_cont(0.95) WITHIN GROUP (ORDER BY (c.timestamp_ms - d.timestamp_ms) / 60000.0) AS claim_p95
                FROM d
                LEFT JOIN a ON a.chain_id = d.chain_id AND a.nonce = d.nonce
                LEFT JOIN c ON c.chain_id = d.chain_id AND c.nonce = d.nonce
                GROUP BY d.chain_id
            `,
            sql`
                WITH d AS (
                    SELECT chain_id, nonce, timestamp_ms FROM public.token_transfer
                    WHERE status = 'Deposited' AND timestamp_ms >= ${startMs}
                ),
                a AS (
                    SELECT chain_id, nonce, timestamp_ms FROM public.token_transfer
                    WHERE status = 'Approved' AND timestamp_ms >= ${startMs}
                )
                SELECT
                    to_char(to_timestamp(d.timestamp_ms / 1000), 'YYYY-MM-DD') AS date,
                    d.chain_id,
                    COUNT(*) AS transfers,
                    percentile_cont(0.5) WITHIN GROUP (ORDER BY (a.timestamp_ms - d.timestamp_ms) / 60000.0) AS approval_p50,
                    percentile_cont(0.95) WITHIN GROUP (ORDER BY (a.timestamp_ms - d.timestamp_ms) / 60000.0) AS approval_p95
                FROM d
                JOIN a ON a.chain_id = d.chain_id AND a.nonce = d.nonce
                GROUP BY 1, 2
                ORDER BY 1, 2
            `,
        ])

        // A deposit made on Sui is bridged to Ethereum, and vice versa
        const direction = (chainId: any): LatencyDirection =>
            Number(chainId) === suiId ? 'SUI → ETH' : 'ETH → SUI'

        const response: LatencyResponse = {
            period: timePeriod,
            stats: (statRows as any[]).map(r => ({
                direction: direction(r.chain_id),
                deposits: Number(r.deposits),
                approved: Number(r.approved),
                claimed: Number(r.claimed),
                approval_p50: num(r.approval_p50),
                approval_p90: num(r.approval_p90),
                approval_p95: num(r.approval_p95),
                claim_p50: num(r.claim_p50),
                claim_p90: num(r.claim_p90),
                claim_p95: num(r.claim_p95),
            })),
            series: (seriesRows as any[]).map(r => ({
                date: r.date,
                direction: direction(r.chain_id),
                transfers: Number(r.transfers),
                approval_p50: num(r.approval_p50),
                approval_p95: num(r.approval_p95),
            })),
        }

        sendReply(res, response)
    } catch (error) {
        console.error('Bridge latency API error:', error)
        sendError(res, { code: 500, message: 'Failed to load bridge latency' })
    }
}

export default withCache(handler, 60)
