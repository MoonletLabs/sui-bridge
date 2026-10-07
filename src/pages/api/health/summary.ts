import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import db from '../database'
import { sendError, sendReply } from '../utils'

export type HealthSummaryResponse = {
    unclaimed: {
        count: number
        total_usd: number
        oldest_timestamp_ms: number | null
        last_7d: number
    }
    failures: {
        total: number
        last_30d: number
        latest_timestamp_ms: number | null
    }
    throughput: {
        deposited: number
        claimed: number
        /** Share of deposits that reached the Claimed state, 0-100 */
        completion_rate: number
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const sql = db[networkConfig.network]

        const [unclaimedRows, failureRows, throughputRows] = await Promise.all([
            // Deposits that never reached a Claimed record, valued in USD
            sql`
                WITH deposited AS (
                    SELECT chain_id, nonce, timestamp_ms
                    FROM public.token_transfer
                    WHERE status = 'Deposited'
                ),
                claimed AS (
                    SELECT chain_id, nonce
                    FROM public.token_transfer
                    WHERE status = 'Claimed'
                ),
                stuck AS (
                    SELECT d.timestamp_ms, td.amount, p.price, p.denominator
                    FROM deposited d
                    LEFT JOIN claimed c ON c.chain_id = d.chain_id AND c.nonce = d.nonce
                    JOIN public.token_transfer_data td
                        ON td.chain_id = d.chain_id AND td.nonce = d.nonce
                    LEFT JOIN public.prices p ON p.token_id = td.token_id
                    WHERE c.nonce IS NULL
                )
                SELECT
                    COUNT(*) AS count,
                    COALESCE(SUM((amount::NUMERIC / NULLIF(denominator, 0)) * price::NUMERIC), 0) AS total_usd,
                    MIN(timestamp_ms) AS oldest_timestamp_ms,
                    COUNT(*) FILTER (
                        WHERE timestamp_ms > (EXTRACT(EPOCH FROM NOW()) * 1000 - 604800000)
                    ) AS last_7d
                FROM stuck
            `,
            sql`
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (
                        WHERE timestamp_ms > (EXTRACT(EPOCH FROM NOW()) * 1000 - 2592000000)
                    ) AS last_30d,
                    MAX(timestamp_ms) AS latest_timestamp_ms
                FROM public.sui_error_transactions
            `,
            sql`
                SELECT
                    COUNT(*) FILTER (WHERE status = 'Deposited') AS deposited,
                    COUNT(*) FILTER (WHERE status = 'Claimed') AS claimed
                FROM public.token_transfer
            `,
        ])

        const u = unclaimedRows[0] || {}
        const f = failureRows[0] || {}
        const t = throughputRows[0] || {}

        const deposited = Number(t.deposited) || 0
        const claimed = Number(t.claimed) || 0

        const response: HealthSummaryResponse = {
            unclaimed: {
                count: Number(u.count) || 0,
                total_usd: Number(u.total_usd) || 0,
                oldest_timestamp_ms: u.oldest_timestamp_ms ? Number(u.oldest_timestamp_ms) : null,
                last_7d: Number(u.last_7d) || 0,
            },
            failures: {
                total: Number(f.total) || 0,
                last_30d: Number(f.last_30d) || 0,
                latest_timestamp_ms: f.latest_timestamp_ms ? Number(f.latest_timestamp_ms) : null,
            },
            throughput: {
                deposited,
                claimed,
                completion_rate: deposited > 0 ? (claimed / deposited) * 100 : 0,
            },
        }

        sendReply(res, response)
    } catch (error) {
        console.error('Health summary API error:', error)
        sendError(res, { code: 500, message: 'Failed to load bridge health summary' })
    }
}
