import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig, TimePeriod } from 'src/config/helper'
import { sendError, sendReply } from '../utils'
import db from '../database'
import { computerIntervals } from '../cards'

export type TokenSummaryRow = {
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
    rows: TokenSummaryRow[]
}

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const timePeriod = (req.query.period as TimePeriod) || 'Last Month'

        const { fromInterval, toInterval } = computerIntervals(timePeriod, false)
        const { fromInterval: prevFrom, toInterval: prevTo } = computerIntervals(timePeriod, true)

        const sql = db[networkConfig.network]
        const SUI_ID = networkConfig.config.networkId.SUI

        const [current, previous] = await Promise.all([
            aggregateQuery(sql, SUI_ID, fromInterval, toInterval),
            aggregateQuery(sql, SUI_ID, prevFrom, prevTo),
        ])

        const prevByToken: Record<number, number> = {}
        for (const row of previous as any[]) {
            prevByToken[Number(row.token_id)] = Number(row.total_volume_usd) || 0
        }

        const rows: TokenSummaryRow[] = (current as any[]).map((row: any) => ({
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

        sendReply(res, { period: timePeriod, rows } as TokenSummaryResponse)
    } catch (error) {
        console.error('Token summary API error:', error)
        sendError(res, error)
    }
}
