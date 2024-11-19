import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './dabatase'
import { getNetworkConfig } from 'src/config/helper'
import { transformAmount } from 'src/utils/helper'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        /**
         * To analyze inflows and outflows, you need to filter transactions by the originating and destination chains.
         *
         * Outflows: Count of tokens bridged out from the current chain
         */
        const prices: any = await db[networkConfig.network]`
            SELECT token_id, price
            FROM public.token_prices;
        `.then((prices: any) =>
            prices.map((row: { token_id: string; price: string }) => ({
                token_id: row.token_id,
                price: Number(row.price),
            })),
        )

        const query = await db[networkConfig.network]`
            SELECT
                destination_chain,
                token_id,
                COUNT(*) AS total_count,
                SUM(amount) AS total_volume
            FROM
                public.token_transfer_data
            WHERE
                destination_chain = ${networkConfig.config.networkId.ETH}
            AND is_finalized=true
            GROUP by
                destination_chain,
                token_id;`

        sendReply(res, transformAmount(networkConfig, query as any[], prices))
    } catch (error) {
        sendError(res, error)
    }
}
