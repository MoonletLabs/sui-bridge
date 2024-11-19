import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './dabatase'
import { transformAmount } from 'src/utils/helper'
import { getNetworkConfig } from 'src/config/helper'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        /**
         *  Transfer Activity by Chain
         *
         *  To analyze transfer activity across different chains:
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
                chain_id,
                token_id,
                destination_chain,
                COUNT(*) AS total_count,
                SUM(amount) AS total_volume
            FROM
                public.token_transfer_data
            GROUP BY
                chain_id,
                token_id,
                destination_chain
            ORDER BY
                total_count DESC`

        sendReply(res, transformAmount(networkConfig, query as any[], prices))
    } catch (error) {
        sendError(res, error)
    }
}
