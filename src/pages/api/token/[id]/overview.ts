import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig, TimePeriod } from 'src/config/helper'
import { sendError, sendReply } from '../../utils'
import db from '../../database'
import { computerIntervals } from '../../cards'

export type TokenOverviewResponse = {
    token_id: number
    token_name: string
    price_usd: number
    decimals: number
    period: TimePeriod
    totals: {
        total_volume_usd: number
        total_volume_raw: number
        total_tx_count: number
        unique_senders: number
        unique_recipients: number
        avg_tx_usd: number
        max_tx_usd: number
        min_tx_usd: number
        first_tx_ms: number | null
        last_tx_ms: number | null
    }
    direction: {
        inflow_usd: number
        outflow_usd: number
        inflow_count: number
        outflow_count: number
        net_usd: number
    }
    previous: {
        total_volume_usd: number
        total_tx_count: number
        unique_senders: number
    }
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

        const tokenMeta = networkConfig.config.coins[tokenId]
        if (!tokenMeta) {
            sendError(res, { code: 404, message: 'Token not found' })
            return
        }

        const { fromInterval, toInterval } = computerIntervals(timePeriod, false)
        const { fromInterval: prevFrom, toInterval: prevTo } = computerIntervals(timePeriod, true)
        const sql = db[networkConfig.network]

        // Run queries in parallel
        const [priceRow, currentRow, directionRows, previousRow] = await Promise.all([
            sql`
                SELECT price, denominator
                FROM public.prices
                WHERE token_id = ${tokenId}
                LIMIT 1
            `,
            sql`
                SELECT
                    COUNT(*)::BIGINT                                                AS tx_count,
                    COUNT(DISTINCT t.sender_address)::BIGINT                        AS unique_senders,
                    COUNT(DISTINCT t.recipient_address)::BIGINT                     AS unique_recipients,
                    COALESCE(SUM(t.amount), 0)                                      AS total_volume_raw,
                    COALESCE(SUM((t.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0) AS total_volume_usd,
                    COALESCE(AVG((t.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0) AS avg_tx_usd,
                    COALESCE(MAX((t.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0) AS max_tx_usd,
                    COALESCE(MIN((t.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0) AS min_tx_usd,
                    MIN(t.timestamp_ms)                                             AS first_tx_ms,
                    MAX(t.timestamp_ms)                                             AS last_tx_ms
                FROM public.token_transfer_data t
                JOIN public.prices p ON p.token_id = t.token_id
                WHERE t.is_finalized = true
                  AND t.token_id = ${tokenId}
                  AND t.timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
            `,
            sql`
                SELECT
                    t.destination_chain,
                    COUNT(*)::BIGINT                                                AS tx_count,
                    COALESCE(SUM((t.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0) AS volume_usd
                FROM public.token_transfer_data t
                JOIN public.prices p ON p.token_id = t.token_id
                WHERE t.is_finalized = true
                  AND t.token_id = ${tokenId}
                  AND t.timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                GROUP BY t.destination_chain
            `,
            sql`
                SELECT
                    COUNT(*)::BIGINT                                                AS tx_count,
                    COUNT(DISTINCT t.sender_address)::BIGINT                        AS unique_senders,
                    COALESCE(SUM((t.amount::NUMERIC / p.denominator) * p.price::FLOAT8), 0) AS total_volume_usd
                FROM public.token_transfer_data t
                JOIN public.prices p ON p.token_id = t.token_id
                WHERE t.is_finalized = true
                  AND t.token_id = ${tokenId}
                  AND t.timestamp_ms BETWEEN ${prevFrom} AND ${prevTo}
            `,
        ])

        const cur = (currentRow as any[])[0] ?? {}
        const prev = (previousRow as any[])[0] ?? {}

        const SUI_ID = networkConfig.config.networkId.SUI
        const ETH_ID = networkConfig.config.networkId.ETH

        let inflowUsd = 0,
            outflowUsd = 0,
            inflowCount = 0,
            outflowCount = 0
        for (const row of directionRows as any[]) {
            const dst = Number(row.destination_chain)
            const usd = Number(row.volume_usd) || 0
            const cnt = Number(row.tx_count) || 0
            // inflow = into SUI (destination is SUI)
            if (dst === SUI_ID) {
                inflowUsd += usd
                inflowCount += cnt
            } else if (dst === ETH_ID) {
                outflowUsd += usd
                outflowCount += cnt
            }
        }

        const priceMeta = (priceRow as any[])[0] ?? {}

        const response: TokenOverviewResponse = {
            token_id: tokenId,
            token_name: tokenMeta.name,
            price_usd: Number(priceMeta.price) || 0,
            decimals: Math.log10(tokenMeta.deno) || 0,
            period: timePeriod,
            totals: {
                total_volume_usd: Number(cur.total_volume_usd) || 0,
                total_volume_raw: Number(cur.total_volume_raw) || 0,
                total_tx_count: Number(cur.tx_count) || 0,
                unique_senders: Number(cur.unique_senders) || 0,
                unique_recipients: Number(cur.unique_recipients) || 0,
                avg_tx_usd: Number(cur.avg_tx_usd) || 0,
                max_tx_usd: Number(cur.max_tx_usd) || 0,
                min_tx_usd: Number(cur.min_tx_usd) || 0,
                first_tx_ms: cur.first_tx_ms ? Number(cur.first_tx_ms) : null,
                last_tx_ms: cur.last_tx_ms ? Number(cur.last_tx_ms) : null,
            },
            direction: {
                inflow_usd: inflowUsd,
                outflow_usd: outflowUsd,
                inflow_count: inflowCount,
                outflow_count: outflowCount,
                net_usd: inflowUsd - outflowUsd,
            },
            previous: {
                total_volume_usd: Number(prev.total_volume_usd) || 0,
                total_tx_count: Number(prev.tx_count) || 0,
                unique_senders: Number(prev.unique_senders) || 0,
            },
        }

        sendReply(res, response)
    } catch (error) {
        console.error('Token overview API error:', error)
        sendError(res, error)
    }
}
