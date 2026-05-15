import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig, TimePeriod } from 'src/config/helper'
import { sendError, sendReply } from '../../utils'
import db from '../../database'
import { computerIntervals } from '../../cards'

export type TokenSizeBucket = {
    bucket: string
    bucket_order: number
    count: number
    usd: number
}

/**
 * Per-token size histogram. Buckets transfers by their USD value.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const timePeriod = (req.query.period as TimePeriod) || 'Last Month'
        const tokenId = Number(req.query.id)

        if (!Number.isFinite(tokenId)) {
            sendError(res, { code: 400, message: 'Invalid token id' })
            return
        }

        const { fromInterval, toInterval } = computerIntervals(timePeriod, false)
        const sql = db[networkConfig.network]

        const rows = await sql`
            WITH txs AS (
                SELECT
                    (t.amount::NUMERIC / p.denominator) * p.price::FLOAT8 AS usd
                FROM public.token_transfer_data t
                JOIN public.prices p ON p.token_id = t.token_id
                WHERE t.is_finalized = true
                  AND t.token_id = ${tokenId}
                  AND t.timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
            )
            SELECT
                CASE
                    WHEN usd <      100  THEN '< $100'
                    WHEN usd <     1000  THEN '$100 – $1k'
                    WHEN usd <    10000  THEN '$1k – $10k'
                    WHEN usd <   100000  THEN '$10k – $100k'
                    WHEN usd <  1000000  THEN '$100k – $1M'
                    ELSE                      '$1M+'
                END AS bucket,
                CASE
                    WHEN usd <      100  THEN 1
                    WHEN usd <     1000  THEN 2
                    WHEN usd <    10000  THEN 3
                    WHEN usd <   100000  THEN 4
                    WHEN usd <  1000000  THEN 5
                    ELSE                      6
                END AS bucket_order,
                COUNT(*) AS count,
                COALESCE(SUM(usd), 0) AS usd
            FROM txs
            GROUP BY 1, 2
            ORDER BY bucket_order
        `

        const data: TokenSizeBucket[] = (rows as any[]).map(r => ({
            bucket: String(r.bucket),
            bucket_order: Number(r.bucket_order),
            count: Number(r.count) || 0,
            usd: Number(r.usd) || 0,
        }))

        sendReply(res, data)
    } catch (error) {
        console.error('Token size-histogram API error:', error)
        sendError(res, error)
    }
}
