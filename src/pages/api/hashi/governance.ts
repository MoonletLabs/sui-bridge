import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { withCache } from 'src/utils/api-cache'
import { getHashiGovernance } from 'src/utils/hashi-chain'
import { sendError, sendReply } from '../utils'

export type { HashiGovernance } from 'src/utils/hashi-chain'

async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { network } = getNetworkConfig({ req })
        return sendReply(res, await getHashiGovernance(network))
    } catch (error) {
        console.error('hashi governance failed:', error)
        return sendError(res, { code: 502, message: 'Could not read Hashi governance' })
    }
}

export default withCache(handler, 120)
