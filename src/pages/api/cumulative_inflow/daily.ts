import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from '../utils'
import db from '../dabatase'
import { getNetworkConfig, TrasformedType } from 'src/config/helper'
import { setFlowDirection, transformAmount } from 'src/utils/helper'
import { getPrices } from '../prices'

function addCumulativeNetInflow(data: TrasformedType[]): any[] {
    const result: any[] = []

    return result
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        /**
         * To track the volume of assets moving across the bridge over time, you can aggregate data by day, week, or month using timestamps.
         *
         */
        const query = await db[networkConfig.network]`
            SELECT
                TO_TIMESTAMP(timestamp_ms / 1000)::DATE AS transfer_date,
                COUNT(*) AS total_count,
                SUM(amount) AS total_volume,
                destination_chain,
                token_id
            FROM
                public.token_transfer_data
            WHERE is_finalized=true
            GROUP BY
                TO_TIMESTAMP(timestamp_ms / 1000)::DATE,
                destination_chain,
                token_id
            ORDER BY
                transfer_date DESC;`

        const prices = await getPrices(networkConfig.network)

        const transformedData = transformAmount(
            networkConfig,
            setFlowDirection(networkConfig, query),
            prices,
        ) as TrasformedType[]

        const cumulativeData = addCumulativeNetInflow(transformedData)

        sendReply(res, cumulativeData)
    } catch (error) {
        sendError(res, error)
    }
}
