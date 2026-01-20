import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { sendError, sendReply } from './utils'
import db from './database'
import dayjs from 'dayjs'

export type SparklineData = {
    address: string
    data: number[] // Last 7 days of transaction counts
}

export type SparklineResponse = {
    sparklines: Record<string, number[]>
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        // Get addresses from query (comma-separated)
        const addressesParam = req.query.addresses?.toString() || ''
        const addresses = addressesParam
            .split(',')
            .map(a => a.trim().toLowerCase())
            .filter(a => a.length > 0)

        if (addresses.length === 0) {
            sendReply(res, { sparklines: {} })
            return
        }

        // Limit to max 50 addresses per request
        const limitedAddresses = addresses.slice(0, 50)

        // Calculate date range (last 7 days)
        const endDate = dayjs()
        const startDate = endDate.subtract(7, 'day')
        const fromTimestamp = startDate.valueOf()
        const toTimestamp = endDate.valueOf()

        // Query to get daily transaction counts for each address over the last 7 days
        const sparklineQuery = await db[networkConfig.network]`
            WITH date_series AS (
                SELECT generate_series(
                    ${startDate.format('YYYY-MM-DD')}::date,
                    ${endDate.format('YYYY-MM-DD')}::date,
                    '1 day'::interval
                )::date AS day
            ),
            user_daily_counts AS (
                SELECT 
                    encode(sender_address, 'hex') as address,
                    DATE(TO_TIMESTAMP(timestamp_ms / 1000)) as tx_date,
                    COUNT(*) as daily_count
                FROM public.token_transfer_data
                WHERE 
                    is_finalized = true
                    AND timestamp_ms BETWEEN ${fromTimestamp} AND ${toTimestamp}
                    AND sender_address IS NOT NULL
                    AND encode(sender_address, 'hex') = ANY(${limitedAddresses})
                GROUP BY encode(sender_address, 'hex'), DATE(TO_TIMESTAMP(timestamp_ms / 1000))
            ),
            addresses_list AS (
                SELECT unnest(${limitedAddresses}::text[]) as address
            ),
            full_data AS (
                SELECT 
                    al.address,
                    ds.day,
                    COALESCE(udc.daily_count, 0) as daily_count
                FROM addresses_list al
                CROSS JOIN date_series ds
                LEFT JOIN user_daily_counts udc 
                    ON al.address = udc.address 
                    AND ds.day = udc.tx_date
            )
            SELECT 
                address,
                array_agg(daily_count ORDER BY day) as counts
            FROM full_data
            GROUP BY address
        `

        // Build response map
        const sparklines: Record<string, number[]> = {}

        sparklineQuery.forEach((row: any) => {
            sparklines[row.address] = row.counts.map((c: any) => Number(c))
        })

        // Fill in empty arrays for addresses with no data
        limitedAddresses.forEach(addr => {
            if (!sparklines[addr]) {
                sparklines[addr] = [0, 0, 0, 0, 0, 0, 0, 0]
            }
        })

        sendReply(res, { sparklines })
    } catch (error) {
        console.error('Sparklines API error:', error)
        sendError(res, error)
    }
}
