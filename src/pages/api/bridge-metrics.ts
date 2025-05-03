import type { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { sendError, sendReply } from './utils'
import db from './dabatase'
import { computerIntervals } from './cards'
import { getPrices } from './prices'
import { TimePeriod } from 'src/config/helper'
import { transformAmount, setFlowDirection } from 'src/utils/helper'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const timePeriod = (req.query.period as TimePeriod) || 'Last Week'
        const { fromInterval, toInterval } = computerIntervals(timePeriod, false)

        // Get transaction volume stats - this is what we're keeping
        const transactionCountQuery = await db[networkConfig.network]`
            SELECT
                TO_TIMESTAMP(timestamp_ms / 1000)::DATE AS transfer_date,
                COUNT(*) AS total_count,
                COUNT(CASE WHEN destination_chain = ${networkConfig.config.networkId.SUI} THEN 1 END) AS sui_count,
                COUNT(CASE WHEN destination_chain = ${networkConfig.config.networkId.ETH} THEN 1 END) AS eth_count
            FROM
                public.token_transfer_data
            WHERE is_finalized = true AND
                  timestamp_ms >= ${fromInterval} AND
                  timestamp_ms <= ${toInterval}
            GROUP BY
                TO_TIMESTAMP(timestamp_ms / 1000)::DATE
            ORDER BY
                transfer_date desc;
        `

        // Get unique addresses count - optimized query
        const uniqueAddressesQuery = await db[networkConfig.network]`
            WITH all_addresses AS (
                SELECT encode(sender_address, 'hex') AS address, destination_chain
                FROM public.token_transfer_data
                WHERE 
                    is_finalized = true
                    AND timestamp_ms >= ${fromInterval}
                    AND timestamp_ms <= ${toInterval}
                    AND sender_address IS NOT NULL
                
                UNION
                
                SELECT encode(recipient_address, 'hex') AS address, destination_chain
                FROM public.token_transfer_data
                WHERE 
                    is_finalized = true
                    AND timestamp_ms >= ${fromInterval}
                    AND timestamp_ms <= ${toInterval}
                    AND recipient_address IS NOT NULL
            )
            SELECT
                COUNT(DISTINCT CASE WHEN destination_chain = ${networkConfig.config.networkId.SUI} THEN address END) AS unique_sui_addresses,
                COUNT(DISTINCT CASE WHEN destination_chain = ${networkConfig.config.networkId.ETH} THEN address END) AS unique_eth_addresses,
                COUNT(DISTINCT address) AS total_unique_addresses
            FROM all_addresses
        `

        const prices = await getPrices(networkConfig.network)

        // Format transaction count data to match other API formats
        const formattedTransactionCountData = transformAmount(
            networkConfig,
            setFlowDirection(networkConfig, transactionCountQuery),
            prices,
        )

        // Simplified response with only what we need
        const responseData = {
            transactionCount: {
                chart: formattedTransactionCountData,
                total: transactionCountQuery.reduce(
                    (sum, item) => sum + parseInt(item.total_count || '0'),
                    0,
                ),
                sui: transactionCountQuery.reduce(
                    (sum, item) => sum + parseInt(item.sui_count || '0'),
                    0,
                ),
                eth: transactionCountQuery.reduce(
                    (sum, item) => sum + parseInt(item.eth_count || '0'),
                    0,
                ),
            },
            uniqueAddressesCount: {
                total: parseInt(uniqueAddressesQuery[0]?.total_unique_addresses || '0'),
                sui: parseInt(uniqueAddressesQuery[0]?.unique_sui_addresses || '0'),
                eth: parseInt(uniqueAddressesQuery[0]?.unique_eth_addresses || '0'),
            },
        }

        sendReply(res, responseData)
    } catch (error) {
        sendError(res, error)
    }
}
