import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './dabatase'
import axios from 'axios'
import { getNetworkConfig } from 'src/config/helper'
import { NETWORK } from 'src/hooks/get-network-storage'

async function fetchTokenPrices(tokenList: { coingeckoId: string; id: number }[]) {
    const coingeckoIds = tokenList.map(token => token.coingeckoId).join(',')
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds}&vs_currencies=usd`

    const response = await axios.get(url)
    return response.data
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const { tokenList } = req.body

        if (!Array.isArray(tokenList) || tokenList.length === 0) {
            console.error('Invalid or missing token list')
            return res.status(400).end() // Bad Request
        }

        // Fetch token prices from API
        const pricesData = await fetchTokenPrices(Object.values(tokenList))

        // Prepare the token prices for insertion/updating
        const tokenPrices = tokenList.map((token: any) => ({
            token_id: token.id,
            price: pricesData[token.coingeckoId]?.usd,
        }))

        // Insert or update the token prices in the database
        const queries = tokenPrices.map(
            ({ token_id, price }: any) =>
                db[networkConfig.network]`
                INSERT INTO public.token_prices (token_id, price)
                VALUES (${token_id}, ${price})
                ON CONFLICT (token_id)
                DO UPDATE SET 
                    price = EXCLUDED.price;
            `,
        )

        await Promise.all(queries)

        // Respond with "No Content" since no response body is needed
        res.status(204).end()
    } catch (error) {
        console.error('Error updating token prices:', error)

        // Respond with a 500 status code for server errors
        res.status(500).end()
    }
}
