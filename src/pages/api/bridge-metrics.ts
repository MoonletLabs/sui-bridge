import { withCache } from 'src/utils/api-cache'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { sendError, sendReply } from './utils'
import db from './database'
import { computerIntervals } from './cards'
import { getPrices } from './prices'
import { TimePeriod } from 'src/config/helper'
import { transformAmount, setFlowDirection, sumQueryField } from 'src/utils/helper'

async function handler(req: NextApiRequest, res: NextApiResponse) {
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

            // Unique addresses, from a single scan of the period. A transfer
            // involves one address on each chain: on an ETH -> SUI transfer the
            // sender is the Ethereum address and the recipient the Sui one, and
            // the other way round for SUI -> ETH.
            db[networkConfig.network]`
                WITH transfers AS (
                    SELECT destination_chain, sender_address, recipient_address
                    FROM public.token_transfer_data
                    WHERE
                        is_finalized = true
                        AND timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                        AND destination_chain IN (${networkConfig.config.networkId.SUI}, ${networkConfig.config.networkId.ETH})
                ),
                sui_chain_addresses AS (
                    SELECT CASE WHEN destination_chain = ${networkConfig.config.networkId.SUI}
                                THEN recipient_address ELSE sender_address END AS address
                    FROM transfers
                ),
                eth_chain_addresses AS (
                    SELECT CASE WHEN destination_chain = ${networkConfig.config.networkId.SUI}
                                THEN sender_address ELSE recipient_address END AS address
                    FROM transfers
                )
                SELECT
                    (SELECT COUNT(DISTINCT address) FROM sui_chain_addresses WHERE address IS NOT NULL) AS unique_sui_addresses,
                    (SELECT COUNT(DISTINCT address) FROM eth_chain_addresses WHERE address IS NOT NULL) AS unique_eth_addresses,
                    (SELECT COUNT(DISTINCT address) FROM (
                        SELECT address FROM sui_chain_addresses WHERE address IS NOT NULL
                        UNION
                        SELECT address FROM eth_chain_addresses WHERE address IS NOT NULL
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

export default withCache(handler, 60)
