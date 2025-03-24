import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from '../utils'
import db from '../dabatase'
import { getNetworkConfig } from 'src/config/helper'
import { setFlowDirection, transformAmount } from 'src/utils/helper'
import { getPrices } from '../prices'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        /**
         * To track the volume of assets moving across the bridge over time, you can aggregate data by day, week, or month using timestamps.
         *
         */
        const query = await db[networkConfig.network]`
            SELECT
                DATE_TRUNC('month', TO_TIMESTAMP(timestamp_ms / 1000)) AS transfer_date,
                COUNT(*) AS total_count,
                (SUM(amount) / 100000000) AS total_volume,
                destination_chain,
                token_id
            FROM
                public.token_transfer_data
            WHERE is_finalized=true
            GROUP BY
                DATE_TRUNC('month', TO_TIMESTAMP(timestamp_ms / 1000)),
                destination_chain,
                token_id
            ORDER BY
                transfer_date;`

        const prices = await getPrices(networkConfig.network)

        sendReply(
            res,
            transformAmount(networkConfig, setFlowDirection(networkConfig, query), prices),
        )
    } catch (error) {
        sendError(res, error)
    }
}
