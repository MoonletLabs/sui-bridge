import { IPrice } from 'src/config/helper'
import db from './dabatase'
import { NETWORK } from 'src/hooks/get-network-storage'

export const getPrices = async (network: NETWORK): Promise<IPrice[]> => {
    return await db[network]`
            SELECT token_id, name, price, last_updated
            FROM public.prices;
        `.then((prices: any) =>
        prices.map(
            (row: { token_id: number; name: string; price: string; last_updated: string }) => ({
                token_id: Number(row.token_id),
                name: row.name,
                price: Number(row.price),
                last_updated: new Date(row.last_updated),
            }),
        ),
    )
}
