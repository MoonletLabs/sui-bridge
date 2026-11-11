import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { getPrices } from '../prices'
import { sendError, sendReply } from '../utils'

export type TokenRegistryResponse = {
    tokens: { id: number; name: string; deno: number; coingeckoId: string }[]
}

/**
 * Tokens bridged on a network, as listed in its `prices` table. Lets the UI
 * pick up newly listed tokens without a deploy.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        // Side effect: syncs the server's token registry with the DB
        const prices = await getPrices(networkConfig.network)

        const tokens = prices
            .map(p => networkConfig.config.coins[p.token_id])
            .filter(Boolean)
            .map(c => ({ id: c.id, name: c.name, deno: c.deno, coingeckoId: c.coingeckoId }))

        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
        sendReply(res, { tokens } as TokenRegistryResponse)
    } catch (error) {
        console.error('Token registry API error:', error)
        sendError(res, { code: 500, message: 'Failed to load token registry' })
    }
}
