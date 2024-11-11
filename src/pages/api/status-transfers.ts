import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './dabatase'
import { getNetworkConfig } from 'src/config/helper'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        /**
         * Status of Transfers
         *
         * To display the status of different transfers (for example, pending, finalized)
         */
        const query = await db[networkConfig.network]`
            SELECT
                status,
                COUNT(*) AS transfer_count
            FROM
                public.token_transfer
            GROUP BY
                status`

        sendReply(res, query)
    } catch (error) {
        sendError(res, error)
    }
}
