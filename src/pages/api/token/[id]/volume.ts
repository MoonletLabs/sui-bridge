import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig, TimePeriod } from 'src/config/helper'
import { sendError, sendReply } from '../../utils'
import db from '../../database'
import { computerIntervals } from '../../cards'

export type TokenVolumePoint = {
    bucket_ms: number
    inflow_usd: number
    outflow_usd: number
    inflow_count: number
    outflow_count: number
}

export type TokenVolumeResponse = {
    token_id: number
    period: TimePeriod
    granularity: 'hour' | 'day' | 'week'
    points: TokenVolumePoint[]
}

const getGranularity = (period: TimePeriod): 'hour' | 'day' | 'week' => {
    if (period === 'Last 24h') return 'hour'
    if (period === 'Last Week') return 'hour'
    if (period === 'Last 6 months' || period === 'Last year' || period === 'All time') return 'week'
    return 'day'
}

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
        const granularity = getGranularity(timePeriod)
        const sql = db[networkConfig.network]

        const truncSpec = granularity === 'hour' ? 'hour' : granularity === 'week' ? 'week' : 'day'

        const SUI_ID = networkConfig.config.networkId.SUI

        const rows = await sql`
            SELECT
                (EXTRACT(EPOCH FROM DATE_TRUNC(${truncSpec}, TO_TIMESTAMP(t.timestamp_ms / 1000))) * 1000)::BIGINT AS bucket_ms,
                CASE WHEN t.destination_chain = ${SUI_ID} THEN 'inflow' ELSE 'outflow' END AS direction,
                COUNT(*)::BIGINT AS tx_count,
                COALESCE(SUM((t.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0) AS volume_usd
            FROM public.token_transfer_data t
            JOIN public.prices p ON p.token_id = t.token_id
            WHERE t.is_finalized = true
              AND t.token_id = ${tokenId}
              AND t.timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
            GROUP BY 1, 2
            ORDER BY 1 ASC
        `

        // Pivot to per-bucket inflow/outflow
        const byBucket: Record<number, TokenVolumePoint> = {}
        for (const row of rows as any[]) {
            const ms = Number(row.bucket_ms)
            if (!byBucket[ms]) {
                byBucket[ms] = {
                    bucket_ms: ms,
                    inflow_usd: 0,
                    outflow_usd: 0,
                    inflow_count: 0,
                    outflow_count: 0,
                }
            }
            const usd = Number(row.volume_usd) || 0
            const cnt = Number(row.tx_count) || 0
            if (row.direction === 'inflow') {
                byBucket[ms].inflow_usd += usd
                byBucket[ms].inflow_count += cnt
            } else {
                byBucket[ms].outflow_usd += usd
                byBucket[ms].outflow_count += cnt
            }
        }

        const points = Object.values(byBucket).sort((a, b) => a.bucket_ms - b.bucket_ms)

        const response: TokenVolumeResponse = {
            token_id: tokenId,
            period: timePeriod,
            granularity,
            points,
        }

        sendReply(res, response)
    } catch (error) {
        console.error('Token volume API error:', error)
        sendError(res, error)
    }
}
