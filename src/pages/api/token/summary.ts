import { withCache } from 'src/utils/api-cache'
import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig, TimePeriod } from 'src/config/helper'
import { sendError, sendReply } from '../utils'
import db from '../database'
import { computerIntervals } from '../cards'

export type TokenSummaryRow = {
    /** Volume (USD) per bucket in `TokenSummaryResponse.buckets`, for a trend line */
    spark: number[]
    token_id: number
    inflow_usd: number
    outflow_usd: number
    inflow_count: number
    outflow_count: number
    total_volume_usd: number
    total_tx_count: number
    unique_senders: number
    avg_tx_usd: number
    max_tx_usd: number
    prev_total_volume_usd: number
}

export type TokenSummaryResponse = {
    period: TimePeriod
    /** Bucket start times (ms) shared by every row's `spark` */
    buckets: number[]
    rows: TokenSummaryRow[]
}

const sparkGranularity = (period: TimePeriod): 'hour' | 'day' | 'week' =>
    period === 'Last 24h'
        ? 'hour'
        : period === 'Last Week' || period === 'Last Month'
          ? 'day'
          : 'week'

const aggregateQuery = (sql: any, SUI_ID: number, from: number, to: number) => sql`
    WITH base AS (
        SELECT
            t.token_id,
            t.destination_chain,
            t.amount,
            t.sender_address
        FROM public.token_transfer_data t
        WHERE t.is_finalized = true
          AND t.timestamp_ms BETWEEN ${from} AND ${to}
    )
    SELECT
        b.token_id,
        SUM(CASE WHEN b.destination_chain = ${SUI_ID} THEN (b.amount::NUMERIC / p.denominator) * p.price::FLOAT8 ELSE 0 END) AS inflow_usd,
        SUM(CASE WHEN b.destination_chain <> ${SUI_ID} THEN (b.amount::NUMERIC / p.denominator) * p.price::FLOAT8 ELSE 0 END) AS outflow_usd,
        SUM(CASE WHEN b.destination_chain = ${SUI_ID} THEN 1 ELSE 0 END)::BIGINT AS inflow_count,
        SUM(CASE WHEN b.destination_chain <> ${SUI_ID} THEN 1 ELSE 0 END)::BIGINT AS outflow_count,
        COUNT(*)::BIGINT AS total_tx_count,
        COUNT(DISTINCT b.sender_address)::BIGINT AS unique_senders,
        COALESCE(SUM((b.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0) AS total_volume_usd,
        COALESCE(AVG((b.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0) AS avg_tx_usd,
        COALESCE(MAX((b.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0) AS max_tx_usd
    FROM base b
    LEFT JOIN public.prices p ON p.token_id = b.token_id
    GROUP BY b.token_id
`

async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const timePeriod = (req.query.period as TimePeriod) || 'Last Month'

        const { fromInterval, toInterval } = computerIntervals(timePeriod, false)
        const { fromInterval: prevFrom, toInterval: prevTo } = computerIntervals(timePeriod, true)

        const sql = db[networkConfig.network]
        const SUI_ID = networkConfig.config.networkId.SUI

        const trunc = sparkGranularity(timePeriod)
        const [current, previous, seriesRows] = await Promise.all([
            aggregateQuery(sql, SUI_ID, fromInterval, toInterval),
            aggregateQuery(sql, SUI_ID, prevFrom, prevTo),
            sql`
                SELECT
                    t.token_id,
                    (EXTRACT(EPOCH FROM DATE_TRUNC(${trunc}, TO_TIMESTAMP(t.timestamp_ms / 1000))) * 1000)::BIGINT AS bucket_ms,
                    COALESCE(SUM((t.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0) AS volume_usd
                FROM public.token_transfer_data t
                JOIN public.prices p ON p.token_id = t.token_id
                WHERE t.is_finalized = true
                  AND t.timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                GROUP BY 1, 2
                ORDER BY 2 ASC
            `,
        ])

        // Full bucket grid for the period (same truncation as the series query), so quiet
        // intervals show as zero instead of being skipped
        const gridRows = await sql`
            SELECT (EXTRACT(EPOCH FROM g) * 1000)::BIGINT AS bucket_ms
            FROM generate_series(
                DATE_TRUNC(${trunc}, TO_TIMESTAMP(${fromInterval}::BIGINT / 1000)),
                DATE_TRUNC(${trunc}, TO_TIMESTAMP(${toInterval}::BIGINT / 1000)),
                (${'1 ' + trunc})::INTERVAL
            ) AS g
            ORDER BY 1 ASC
        `
        const buckets = (gridRows as any[]).map(r => Number(r.bucket_ms))
        const bucketIndex = new Map(buckets.map((b, i) => [b, i]))
        const sparkByToken: Record<number, number[]> = {}
        for (const r of seriesRows as any[]) {
            const id = Number(r.token_id)
            if (!sparkByToken[id]) sparkByToken[id] = new Array(buckets.length).fill(0)
            const idx = bucketIndex.get(Number(r.bucket_ms))
            if (idx !== undefined) sparkByToken[id][idx] = Number(r.volume_usd) || 0
        }

        const prevByToken: Record<number, number> = {}
        for (const row of previous as any[]) {
            prevByToken[Number(row.token_id)] = Number(row.total_volume_usd) || 0
        }

        // Tokens with volume only in the previous period still count towards the change
        const currentIds = new Set((current as any[]).map(r => Number(r.token_id)))
        const currentRows = [
            ...(current as any[]),
            ...(previous as any[])
                .filter(r => !currentIds.has(Number(r.token_id)))
                .map(r => ({ token_id: r.token_id })),
        ]

        const rows: TokenSummaryRow[] = currentRows.map((row: any) => ({
            spark: sparkByToken[Number(row.token_id)] ?? new Array(buckets.length).fill(0),
            token_id: Number(row.token_id),
            inflow_usd: Number(row.inflow_usd) || 0,
            outflow_usd: Number(row.outflow_usd) || 0,
            inflow_count: Number(row.inflow_count) || 0,
            outflow_count: Number(row.outflow_count) || 0,
            total_volume_usd: Number(row.total_volume_usd) || 0,
            total_tx_count: Number(row.total_tx_count) || 0,
            unique_senders: Number(row.unique_senders) || 0,
            avg_tx_usd: Number(row.avg_tx_usd) || 0,
            max_tx_usd: Number(row.max_tx_usd) || 0,
            prev_total_volume_usd: prevByToken[Number(row.token_id)] || 0,
        }))

        sendReply(res, { period: timePeriod, buckets, rows } as TokenSummaryResponse)
    } catch (error) {
        console.error('Token summary API error:', error)
        sendError(res, error)
    }
}

export default withCache(handler, 60)
