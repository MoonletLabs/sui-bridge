import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from './utils'
import db from './database'
import { getNetworkConfig, TrasformedType } from 'src/config/helper'
import { addCumulativeNetInflow, setFlowDirection, transformAmount } from 'src/utils/helper'
import { getPrices } from './prices'

/**
 * GET /api/stock
 *
 * Returns per-token running stock on the bridge bucketed by day.
 * Stock(t) = cumulative(inflow_to_sui - outflow_to_eth) up to day t.
 *
 * Methodology caveat: USD values use the latest price from the `prices`
 * table applied to historical token amounts (the `prices` table does not
 * currently store historical snapshots). This matches the behaviour of
 * `/api/cumulative_inflow/*`.
 *
 * Response shape (array, sorted by transfer_date ASC):
 *   [{
 *     transfer_date: string   // ISO day
 *     token_id: number
 *     token_info: { id, name, deno, coingeckoId }
 *     stock_amount: number      // native token units (cumulative, floored at 0)
 *     stock_amount_usd: number  // USD (cumulative, floored at 0)
 *     raw_stock_amount: number  // cumulative before flooring (can be negative on data drift)
 *   }]
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        const query = await db[networkConfig.network]`
            SELECT
                TO_TIMESTAMP(timestamp_ms / 1000)::DATE AS transfer_date,
                COUNT(*) AS total_count,
                SUM(amount) AS total_volume,
                destination_chain,
                token_id
            FROM
                public.token_transfer_data
            WHERE is_finalized = true
            GROUP BY
                TO_TIMESTAMP(timestamp_ms / 1000)::DATE,
                destination_chain,
                token_id
            ORDER BY
                transfer_date DESC;`

        const prices = await getPrices(networkConfig.network)

        const transformedData = transformAmount(
            networkConfig,
            setFlowDirection(networkConfig, query),
            prices,
        ) as TrasformedType[]

        // Produces running per-token cumulative totals (net inflow) per day.
        const cumulativeData = addCumulativeNetInflow(transformedData)

        // Re-shape into "stock" semantics. Floor negatives to 0 to avoid
        // meaningless negative stock from transient indexer drift, but
        // retain the raw value for debugging / potential UI warning.
        const stockData = cumulativeData
            .filter(it => !!it?.token_info)
            .map(it => {
                const rawAmount = Number(it.total_volume) || 0
                const rawUsd = Number(it.total_volume_usd) || 0
                return {
                    transfer_date: it.transfer_date,
                    token_id: it.token_id,
                    token_info: it.token_info,
                    stock_amount: Math.max(rawAmount, 0),
                    stock_amount_usd: Math.max(rawUsd, 0),
                    raw_stock_amount: rawAmount,
                }
            })
            .sort(
                (a, b) => new Date(a.transfer_date).getTime() - new Date(b.transfer_date).getTime(),
            )

        sendReply(res, stockData)
    } catch (error) {
        sendError(res, error)
    }
}
