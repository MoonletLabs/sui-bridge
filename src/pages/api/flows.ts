import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig, TimePeriod } from 'src/config/helper'
import { calculateStartDate } from 'src/utils/format-chart-data'
import db from './database'
import { sendError, sendReply } from './utils'

/**
 * Flows endpoint — aggregates bridge transfers by
 *   (source chain, destination chain, token) over a given period.
 *
 * Used by the Sankey diagram on /flows.
 *
 * Returns one row per unique (src_chain, dst_chain, token_id) combo:
 *   { src_chain, dst_chain, token_id, usd, count }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const timePeriod = (req.query.period as TimePeriod) || 'Last Month'
        const startDate = calculateStartDate(timePeriod)
        const startMs = startDate.valueOf()

        const rows = await db[networkConfig.network]`
            SELECT
                t.chain_id                                             AS src_chain,
                t.destination_chain                                    AS dst_chain,
                t.token_id                                             AS token_id,
                COALESCE(SUM((t.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0)
                                                                       AS usd,
                COUNT(*)                                               AS count
            FROM public.token_transfer_data t
            JOIN public.prices p ON p.token_id = t.token_id
            WHERE
                t.is_finalized = true
                AND t.timestamp_ms >= ${startMs}
            GROUP BY 1, 2, 3
            ORDER BY usd DESC`

        const data = (rows as any[]).map(r => ({
            src_chain: Number(r.src_chain),
            dst_chain: Number(r.dst_chain),
            token_id: Number(r.token_id),
            usd: Number(r.usd) || 0,
            count: Number(r.count) || 0,
        }))

        sendReply(res, data)
    } catch (error) {
        console.error('flows api error:', error)
        sendError(res, error)
    }
}
