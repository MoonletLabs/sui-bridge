import { IPrice, registerCoins } from 'src/config/helper'
import db from './database'
import { NETWORK } from 'src/hooks/get-network-storage'

export const getPrices = async (network: NETWORK): Promise<IPrice[]> => {
    return await db[network]`
            SELECT token_id, name, price, last_updated, denominator
            FROM public.prices;
        `.then((prices: any) => {
        // The prices table lists every bridged token: keep the token registry in sync with it
        registerCoins(network, prices)
        return prices.map(
            (row: { token_id: number; name: string; price: string; last_updated: string }) => ({
                token_id: Number(row.token_id),
                name: row.name,
                price: Number(row.price),
                last_updated: new Date(row.last_updated),
            }),
        )
    })
}
