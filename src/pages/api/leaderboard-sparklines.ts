import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig, TimePeriod } from 'src/config/helper'
import { sendError, sendReply } from './utils'
import db from './database'
import { computerIntervals } from './cards'

export type SparklineData = {
    address: string
    data: number[] // Transaction counts per segment
}

export type SparklineResponse = {
    sparklines: Record<string, number[]>
}

// Number of segments for the sparkline based on time period
const SPARKLINE_SEGMENTS = 7

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const timePeriod = (req.query.period as TimePeriod) || 'Last Week'

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

        // Use same time intervals as leaderboard
        const { fromInterval, toInterval } = computerIntervals(timePeriod, false)

        // Calculate segment duration based on time period
        const totalDuration = toInterval - fromInterval
        const segmentDuration = Math.floor(totalDuration / SPARKLINE_SEGMENTS)

        // Generate segment boundaries
        const segments: { start: number; end: number }[] = []
        for (let i = 0; i < SPARKLINE_SEGMENTS; i++) {
            segments.push({
                start: fromInterval + i * segmentDuration,
                end: fromInterval + (i + 1) * segmentDuration,
            })
        }

        // Query to get transaction counts per segment for each address
        const sparklineQuery = await db[networkConfig.network]`
            WITH user_transactions AS (
                SELECT 
                    encode(sender_address, 'hex') as address,
                    timestamp_ms
                FROM public.token_transfer_data
                WHERE 
                    is_finalized = true
                    AND timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                    AND sender_address IS NOT NULL
                    AND encode(sender_address, 'hex') = ANY(${limitedAddresses})
            )
            SELECT 
                address,
                ${db[networkConfig.network].unsafe(
                    segments
                        .map(
                            (seg, i) =>
                                `COUNT(*) FILTER (WHERE timestamp_ms >= ${seg.start} AND timestamp_ms < ${seg.end}) as seg_${i}`,
                        )
                        .join(', '),
                )}
            FROM user_transactions
            GROUP BY address
        `

        // Build response map
        const sparklines: Record<string, number[]> = {}

        sparklineQuery.forEach((row: any) => {
            const counts: number[] = []
            for (let i = 0; i < SPARKLINE_SEGMENTS; i++) {
                counts.push(Number(row[`seg_${i}`]) || 0)
            }
            sparklines[row.address] = counts
        })

        // Fill in empty arrays for addresses with no data
        limitedAddresses.forEach(addr => {
            if (!sparklines[addr]) {
                sparklines[addr] = Array(SPARKLINE_SEGMENTS).fill(0)
            }
        })

        sendReply(res, { sparklines })
    } catch (error) {
        console.error('Sparklines API error:', error)
        sendError(res, {
            code: 500,
            message: error instanceof Error ? error.message : 'Internal server error',
        })
    }
}
