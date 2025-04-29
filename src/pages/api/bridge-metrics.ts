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
                COUNT(*) AS total_count
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
            SELECT
                COUNT(DISTINCT encode(sender_address, 'hex')) AS total_unique_addresses
            FROM
                public.token_transfer_data
            WHERE
                is_finalized = true
                AND timestamp_ms >= ${fromInterval}
                AND timestamp_ms <= ${toInterval}
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
            transactionCount: formattedTransactionCountData,
            uniqueAddressesCount: parseInt(uniqueAddressesQuery[0]?.total_unique_addresses || '0'),
        }

        sendReply(res, responseData)
    } catch (error) {
        sendError(res, error)
    }
}
