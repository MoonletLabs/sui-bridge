import type { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { sendError, sendReply } from './utils'
import db from './database'
import { computerIntervals } from './cards'
import { getPrices } from './prices'
import { TimePeriod } from 'src/config/helper'
import { transformAmount, setFlowDirection, sumQueryField } from 'src/utils/helper'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const timePeriod = (req.query.period as TimePeriod) || 'Last Week'
        const { fromInterval, toInterval } = computerIntervals(timePeriod, false)

        // Run both queries in parallel for better performance
        const [transactionCountQuery, uniqueAddressesQuery, prices] = await Promise.all([
            // Transaction count query
            db[networkConfig.network]`
                SELECT
                    TO_TIMESTAMP(timestamp_ms / 1000)::DATE AS transfer_date,
                    COUNT(*) AS total_count,
                    COUNT(CASE WHEN destination_chain = ${networkConfig.config.networkId.SUI} THEN 1 END) AS sui_count,
                    COUNT(CASE WHEN destination_chain = ${networkConfig.config.networkId.ETH} THEN 1 END) AS eth_count
                FROM public.token_transfer_data
                WHERE 
                    is_finalized = true AND
                    timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                GROUP BY TO_TIMESTAMP(timestamp_ms / 1000)::DATE
                ORDER BY transfer_date DESC
            `,

            // Unique addresses query - improved with better CTE naming and structure
            db[networkConfig.network]`
                WITH eth_chain_addresses AS (
                    SELECT encode(sender_address, 'hex') AS address
                    FROM public.token_transfer_data
                    WHERE 
                        is_finalized = true
                        AND timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                        AND sender_address IS NOT NULL
                        AND destination_chain = ${networkConfig.config.networkId.SUI}

                    UNION

                    SELECT encode(recipient_address, 'hex') AS address
                    FROM public.token_transfer_data
                    WHERE 
                        is_finalized = true
                        AND timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                        AND recipient_address IS NOT NULL
                        AND destination_chain = ${networkConfig.config.networkId.ETH}
                ),
                sui_chain_addresses AS (
                    SELECT encode(recipient_address, 'hex') AS address
                    FROM public.token_transfer_data
                    WHERE 
                        is_finalized = true
                        AND timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                        AND recipient_address IS NOT NULL
                        AND destination_chain = ${networkConfig.config.networkId.SUI}

                    UNION

                    SELECT encode(sender_address, 'hex') AS address
                    FROM public.token_transfer_data
                    WHERE 
                        is_finalized = true
                        AND timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                        AND sender_address IS NOT NULL
                        AND destination_chain = ${networkConfig.config.networkId.ETH}
                )
                SELECT
                    (SELECT COUNT(DISTINCT address) FROM sui_chain_addresses) AS unique_sui_addresses,
                    (SELECT COUNT(DISTINCT address) FROM eth_chain_addresses) AS unique_eth_addresses,
                    (SELECT COUNT(DISTINCT address) FROM (
                        SELECT address FROM sui_chain_addresses
                        UNION
                        SELECT address FROM eth_chain_addresses
                    ) AS all_addresses) AS total_unique_addresses
            `,

            // Get prices
            getPrices(networkConfig.network),
        ])

        // Format transaction data
        const formattedTransactionCountData = transformAmount(
            networkConfig,
            setFlowDirection(networkConfig, transactionCountQuery),
            prices,
        )

        // Extract unique address counts
        const uniqueAddresses = {
            sui: parseInt(uniqueAddressesQuery[0]?.unique_sui_addresses || '0'),
            eth: parseInt(uniqueAddressesQuery[0]?.unique_eth_addresses || '0'),
            total: parseInt(uniqueAddressesQuery[0]?.total_unique_addresses || '0'),
        }

        // Build optimized response
        const responseData = {
            transactionCount: {
                chart: formattedTransactionCountData,
                total: sumQueryField(transactionCountQuery, 'total_count'),
                sui: sumQueryField(transactionCountQuery, 'sui_count'),
                eth: sumQueryField(transactionCountQuery, 'eth_count'),
            },
            uniqueAddressesCount: uniqueAddresses,
        }

        sendReply(res, responseData)
    } catch (error) {
        sendError(res, error)
    }
}
