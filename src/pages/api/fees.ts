import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './database'
import { getNetworkConfig, TimePeriod } from 'src/config/helper'
import { calculateStartDate } from 'src/utils/format-chart-data'
import dayjs from 'dayjs'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const timePeriod = (req.query.period as TimePeriod) || 'Last Week'

        const startDate = calculateStartDate(timePeriod)

        /**
         * Average Gas Usage per chain per day
         *
         * Shows average gas usage in native units:
         * - ETH gas is in gwei (1e9 wei)
         * - SUI gas is in MIST (1e9 MIST)
         */
        const query = await db[networkConfig.network]`
            SELECT
                DATE_TRUNC('day', TO_TIMESTAMP(timestamp_ms / 1000)) AS transfer_date,
                COALESCE(AVG(CASE 
                    WHEN data_source = 'ETH' 
                    THEN gas_usage::numeric / 1e9  -- Convert to gwei
                    ELSE NULL 
                END), 0) AS eth_gas_usage,
                COALESCE(AVG(CASE 
                    WHEN data_source = 'SUI' 
                    THEN gas_usage::numeric / 1e9  -- Convert to MIST
                    ELSE NULL 
                END), 0) AS sui_gas_usage
            FROM
                public.token_transfer
            WHERE
                is_finalized = true
                AND TO_TIMESTAMP(timestamp_ms / 1000) >= ${startDate.toISOString()}
            GROUP BY
                DATE_TRUNC('day', TO_TIMESTAMP(timestamp_ms / 1000))
            ORDER BY
                transfer_date;`

        sendReply(res, query)
    } catch (error) {
        sendError(res, error)
    }
}
