import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './database'
import { getNetworkConfig } from 'src/config/helper'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        /**
         * Total Bridging Fees (Gas Usage)
         *
         * If you need to analyze total gas usage related to bridging transactions:
         */
        const query = await db[networkConfig.network]`
            SELECT
                DATE_TRUNC('day', TO_TIMESTAMP(timestamp_ms / 1000)) AS transfer_date,
                SUM(CASE WHEN data_source = 'ETH' THEN gas_usage ELSE 0 END) AS eth_gas_usage,
                SUM(CASE WHEN data_source = 'SUI' THEN gas_usage ELSE 0 END) AS sui_gas_usage
            FROM
                public.token_transfer
            WHERE
                is_finalized = true
            GROUP BY
                DATE_TRUNC('day', TO_TIMESTAMP(timestamp_ms / 1000))
            ORDER BY
                transfer_date;`

        sendReply(res, query)
    } catch (error) {
        sendError(res, error)
    }
}
