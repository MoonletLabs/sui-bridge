import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { removePrefix, transformHistory, transformTransfers } from 'src/utils/helper'
import db from '../database'
import { sendError, sendReply } from '../utils'
import { getPrices } from '../prices'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        const tx = removePrefix(req.query.tx?.toString())

        /**
         * Get bridge transactions
         */

        const queryTokenData = await db[networkConfig.network]`
            SELECT
                encode(txn_hash, 'hex') AS tx_hash,
                encode(sender_address, 'hex') AS sender_address,
                encode(recipient_address, 'hex') AS recipient_address,
                chain_id,
                destination_chain,
                nonce,
                block_height,
                timestamp_ms,
                token_id,
                amount,
                is_finalized
            FROM token_transfer_data
            WHERE
                txn_hash = decode(${tx}, 'hex')`

        const tokendata = queryTokenData?.[0]

        if (!tokendata) {
            sendError(res, { code: 404, message: `Cannot find tx ${req.query.tx}` })
            return
        }

        const queryTokenTransfers = await db[networkConfig.network]`
                SELECT
                	encode(txn_hash, 'hex') AS tx_hash,
                	encode(txn_sender, 'hex') AS txn_sender,
                	chain_id,
                    nonce,
                    status,
                	block_height,
                	timestamp_ms,
                    gas_usage,
                    data_source,
                	nonce,
                    is_finalized
                FROM token_transfer
                WHERE
                	nonce=${tokendata?.nonce} AND chain_id=${tokendata?.chain_id}`

        const prices = await getPrices(networkConfig.network)

        sendReply(res, {
            history: transformHistory(queryTokenTransfers as any[]),
            tx: transformTransfers(networkConfig, [tokendata] as any, prices)?.[0],
        })
    } catch (error) {
        sendError(res)
    }
}
