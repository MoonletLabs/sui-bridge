import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig, TimePeriod } from 'src/config/helper'
import { sendError, sendReply } from '../../utils'
import db from '../../database'
import { computerIntervals } from '../../cards'

export type TokenHolderRow = {
    rank: number
    address: string
    address_type: 'sui' | 'eth'
    total_volume_usd: number
    total_volume_raw: number
    tx_count: number
    inflow_count: number
    outflow_count: number
    first_tx_ms: number
    last_tx_ms: number
}

export type TokenHoldersResponse = {
    token_id: number
    period: TimePeriod
    total: number
    holders: TokenHolderRow[]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const timePeriod = (req.query.period as TimePeriod) || 'Last Month'
        const tokenId = Number(req.query.id)
        const limit = Math.min(Number(req.query.limit) || 25, 100)
        const offset = Number(req.query.offset) || 0
        const sortBy = (req.query.sortBy as 'volume' | 'count') || 'volume'

        if (!Number.isFinite(tokenId)) {
            sendError(res, { code: 400, message: 'Invalid token id' })
            return
        }

        const { fromInterval, toInterval } = computerIntervals(timePeriod, false)
        const sql = db[networkConfig.network]

        const SUI_ID = networkConfig.config.networkId.SUI

        const orderBy =
            sortBy === 'count'
                ? sql`tx_count DESC NULLS LAST`
                : sql`total_volume_usd DESC NULLS LAST`

        const [holdersQuery, countQuery] = await Promise.all([
            sql`
                WITH per_address AS (
                    SELECT
                        encode(t.sender_address, 'hex') AS address,
                        SUM(CASE WHEN t.destination_chain = ${SUI_ID} THEN 1 ELSE 0 END)::BIGINT AS inflow_count,
                        SUM(CASE WHEN t.destination_chain <> ${SUI_ID} THEN 1 ELSE 0 END)::BIGINT AS outflow_count,
                        COUNT(*)::BIGINT AS tx_count,
                        COALESCE(SUM(t.amount), 0) AS total_volume_raw,
                        COALESCE(SUM((t.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0) AS total_volume_usd,
                        MIN(t.timestamp_ms) AS first_tx_ms,
                        MAX(t.timestamp_ms) AS last_tx_ms,
                        CASE
                            WHEN SUM(CASE WHEN t.destination_chain = ${SUI_ID} THEN 1 ELSE 0 END) >
                                 SUM(CASE WHEN t.destination_chain <> ${SUI_ID} THEN 1 ELSE 0 END)
                            THEN 'eth'
                            ELSE 'sui'
                        END AS address_type
                    FROM public.token_transfer_data t
                    JOIN public.prices p ON p.token_id = t.token_id
                    WHERE t.is_finalized = true
                      AND t.token_id = ${tokenId}
                      AND t.sender_address IS NOT NULL
                      AND t.timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                    GROUP BY 1
                )
                SELECT *
                FROM per_address
                ORDER BY ${orderBy}
                LIMIT ${limit} OFFSET ${offset}
            `,
            sql`
                SELECT COUNT(DISTINCT t.sender_address)::BIGINT AS total
                FROM public.token_transfer_data t
                WHERE t.is_finalized = true
                  AND t.token_id = ${tokenId}
                  AND t.sender_address IS NOT NULL
                  AND t.timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
            `,
        ])

        const holders: TokenHolderRow[] = (holdersQuery as any[]).map((row: any, idx: number) => ({
            rank: offset + idx + 1,
            address: row.address,
            address_type: row.address_type as 'sui' | 'eth',
            total_volume_usd: Number(row.total_volume_usd) || 0,
            total_volume_raw: Number(row.total_volume_raw) || 0,
            tx_count: Number(row.tx_count) || 0,
            inflow_count: Number(row.inflow_count) || 0,
            outflow_count: Number(row.outflow_count) || 0,
            first_tx_ms: Number(row.first_tx_ms) || 0,
            last_tx_ms: Number(row.last_tx_ms) || 0,
        }))

        sendReply(res, {
            token_id: tokenId,
            period: timePeriod,
            total: Number((countQuery as any[])[0]?.total) || 0,
            holders,
        } as TokenHoldersResponse)
    } catch (error) {
        console.error('Token holders API error:', error)
        sendError(res, error)
    }
}
