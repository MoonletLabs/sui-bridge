import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './database'
import { getNetworkConfig } from 'src/config/helper'
import { getPrices } from './prices'
import { calculateStartDate } from 'src/utils/format-chart-data'

// Helper to get network name from ID
const getNetworkName = (id: number, networkId: { SUI: number; ETH: number }): string | null => {
    for (const [key, value] of Object.entries(networkId)) {
        if (value === id) {
            return key
        }
    }
    return null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const timePeriod = (req.query.timePeriod as string) || 'Last Month'

        const startDate = calculateStartDate(timePeriod)
        const startTimestampMs = startDate.valueOf()

        /**
         * Query to get route data grouped by source chain, destination chain, and token
         * This gives us the flow of assets between chains
         */
        const query = await db[networkConfig.network]`
            SELECT
                chain_id,
                destination_chain,
                token_id,
                COUNT(*) AS total_count,
                SUM(amount) AS total_volume
            FROM
                public.token_transfer_data
            WHERE
                is_finalized = true
                AND timestamp_ms >= ${startTimestampMs}
            GROUP BY
                chain_id,
                destination_chain,
                token_id
            ORDER BY
                total_volume DESC`

        const prices = await getPrices(networkConfig.network)

        // Transform the data with proper chain names and token info
        const transformedData = (query as any[])
            .map(row => {
                const tokenData = networkConfig.config.coins[row.token_id]
                const priceData = prices.find(price => price.token_id === row.token_id)

                const fromChain = getNetworkName(row.chain_id, networkConfig.config.networkId)
                const destinationChain = getNetworkName(
                    row.destination_chain,
                    networkConfig.config.networkId,
                )

                if (!tokenData || !fromChain || !destinationChain) {
                    return null
                }

                const totalVolume = Number(row.total_volume) / tokenData.deno
                const totalVolumeUsd = totalVolume * Number(priceData?.price || 0)

                return {
                    from_chain: fromChain,
                    destination_chain: destinationChain,
                    token_id: row.token_id,
                    token_info: {
                        id: tokenData.id,
                        name: tokenData.name,
                        deno: tokenData.deno,
                    },
                    total_count: Number(row.total_count),
                    total_volume: totalVolume,
                    total_volume_usd: totalVolumeUsd,
                }
            })
            .filter(Boolean)

        sendReply(res, transformedData)
    } catch (error) {
        sendError(res, error)
    }
}
