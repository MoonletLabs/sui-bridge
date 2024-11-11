import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './dabatase'
import { getNetworkConfig } from 'src/config/helper'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        /**
         * Example data of recent transfers
         */
        const query = await db[networkConfig.network]`
            SELECT
                chain_id,
                nonce,
                data_source,
                status,
                block_height,
                TO_TIMESTAMP(timestamp_ms / 1000) AS transfer_time,
                encode(txn_hash, 'hex') AS txn_hash,
                encode(txn_sender, 'hex') AS txn_sender,
                gas_usage
            FROM
                public.token_transfer
            where is_finalized=true
            ORDER BY
                timestamp_ms DESC
            LIMIT 50`

        sendReply(res, query)
    } catch (error) {
        sendError(res, error)
    }
}
