import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './dabatase'
import { getNetworkConfig } from 'src/config/helper'
import { transformAmount } from 'src/utils/helper'
import { getPrices } from './prices'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        /**
         * To analyze inflows and outflows, you need to filter transactions by the originating and destination chains.
         *
         * Inflows: Count of tokens bridged into the current chain
         */

        const query = await db[networkConfig.network]`
            SELECT
                destination_chain,
                token_id,
                COUNT(*) AS total_count,
                SUM(amount) AS total_volume
            FROM
                public.token_transfer_data
            WHERE
                destination_chain = ${networkConfig.config.networkId.SUI}
            AND is_finalized=true
            GROUP by
                destination_chain,
                token_id`

        const prices = await getPrices(networkConfig.network)

        sendReply(res, transformAmount(networkConfig, query as any[], prices))
    } catch (error) {
        sendError(res, error)
    }
}
