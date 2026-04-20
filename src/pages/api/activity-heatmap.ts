import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig, TimePeriod } from 'src/config/helper'
import { calculateStartDate } from 'src/utils/format-chart-data'
import db from './database'
import { sendError, sendReply } from './utils'

/**
 * Activity heatmap — counts transfers by ISO day-of-week × hour-of-day (UTC).
 * Used by the Day-of-week x Hour-of-day heatmap on /flows.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const timePeriod = (req.query.period as TimePeriod) || 'Last Month'
        const startDate = calculateStartDate(timePeriod)
        const startMs = startDate.valueOf()

        const rows = await db[networkConfig.network]`
            SELECT
                EXTRACT(ISODOW FROM TO_TIMESTAMP(t.timestamp_ms / 1000))::int AS dow,
                EXTRACT(HOUR   FROM TO_TIMESTAMP(t.timestamp_ms / 1000))::int AS hour,
                COUNT(*)                                                      AS count,
                COALESCE(SUM((t.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0)
                                                                              AS usd
            FROM public.token_transfer_data t
            JOIN public.prices p ON p.token_id = t.token_id
            WHERE t.is_finalized = true
              AND t.timestamp_ms >= ${startMs}
            GROUP BY 1, 2
            ORDER BY 1, 2`

        const data = (rows as any[]).map(r => ({
            dow: Number(r.dow),
            hour: Number(r.hour),
            count: Number(r.count) || 0,
            usd: Number(r.usd) || 0,
        }))

        sendReply(res, data)
    } catch (error) {
        console.error('activity-heatmap api error:', error)
        sendError(res, error)
    }
}
