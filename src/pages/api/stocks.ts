import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './dabatase'
import { getNetworkConfig } from 'src/config/helper'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        /**
         * To analyze the current stock of each token that has been bridged, you can calculate the net inflows and outflows for each asset
         *
         * Stock of Each Bridged Token
         * TODO: see this, ONLY ETH NOW?
         */
        const query = await db[networkConfig.network]`
            WITH inflows AS (
                SELECT
                    token_id,
                    (SUM(amount) / 100000000) AS inflow_amount_eth
                FROM
                    public.token_transfer_data
                WHERE
                    destination_chain = ${networkConfig.config.networkId.SUI}  -- Replace YOUR_CHAIN_ID with the specific chain you want to analyze
                GROUP BY
                    token_id
            ),
            outflows AS (
                SELECT
                    token_id,
                    (SUM(amount) / 100000000) AS outflow_amount_eth
                FROM
                    public.token_transfer_data
                WHERE
                    destination_chain = ${networkConfig.config.networkId.ETH}
                GROUP BY
                    token_id
            )
            SELECT
                COALESCE(inflows.token_id, outflows.token_id) AS token_id,
                COALESCE(inflow_amount_eth, 0) - COALESCE(outflow_amount_eth, 0) AS net_stock_eth
            FROM
                inflows
            FULL OUTER JOIN
                outflows ON inflows.token_id = outflows.token_id;
`

        sendReply(res, query)
    } catch (error) {
        sendError(res, error)
    }
}
