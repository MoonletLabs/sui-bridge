import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from '../utils'
import db from '../database'
import { getNetworkConfig } from 'src/config/helper'
import { setFlowDirection, transformAmount } from 'src/utils/helper'
import dayjs from 'dayjs'
import { getPrices } from '../prices'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        const maxOneWeek = dayjs().subtract(7, 'day').valueOf() // for hourly data get maximum 1 week (too much data)

        /**
         * To track the volume of assets moving across the bridge over time, you can aggregate data by day, week, or month using timestamps.
         *
         */
        const query = await db[networkConfig.network]`
            SELECT
                TO_TIMESTAMP(timestamp_ms / 1000)::DATE + INTERVAL '1 hour' * EXTRACT(HOUR FROM TO_TIMESTAMP(timestamp_ms / 1000)) AS transfer_date,
                COUNT(*) AS total_count,
                SUM(amount) AS total_volume,
                destination_chain,
                token_id
            FROM
                public.token_transfer_data
            WHERE is_finalized=true
                AND timestamp_ms >= ${maxOneWeek}
            GROUP BY
                transfer_date,
                destination_chain,
                token_id
            ORDER BY
                transfer_date DESC;`

        const prices = await getPrices(networkConfig.network)

        sendReply(
            res,
            transformAmount(networkConfig, setFlowDirection(networkConfig, query), prices),
        )
    } catch (error) {
        sendError(res, error)
    }
}
