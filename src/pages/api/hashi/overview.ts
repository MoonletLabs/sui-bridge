import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { withCache } from 'src/utils/api-cache'
import { getHashiOverview } from 'src/utils/hashi-chain'
import { sendError, sendReply } from '../utils'

export type { HashiOverview } from 'src/utils/hashi-chain'

async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { network } = getNetworkConfig({ req })
        return sendReply(res, await getHashiOverview(network))
    } catch (error) {
        console.error('hashi overview failed:', error)
        return sendError(res, { code: 502, message: 'Could not read Hashi from Sui' })
    }
}

export default withCache(handler, 60, { staleSeconds: 600 })
