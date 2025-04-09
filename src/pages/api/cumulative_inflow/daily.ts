import { NextApiRequest, NextApiResponse } from 'next'
import { sendError, sendReply } from '../utils'
import db from '../dabatase'
import { getNetworkConfig, TrasformedType } from 'src/config/helper'
import { setFlowDirection, transformAmount } from 'src/utils/helper'
import { getPrices } from '../prices'

function addCumulativeNetInflow(data: TrasformedType[]): any[] {
    const result: any[] = []
    const groupedData = new Map<string, TrasformedType[]>()

    data.forEach(item => {
        const key = `${new Date(item.transfer_date).toISOString()}_${item.token_info.name}`
        if (!groupedData.has(key)) {
            groupedData.set(key, [item])
        } else {
            const group = groupedData.get(key)
            group?.push(item)
        }
    })

    type AuxType = {
        transfer_date: string
        token_id: string | number
        token_info: any
        total_volume: number
        total_volume_usd: number
    }

    let aux: AuxType[] = []

    // console.log(groupedData)

    const groupedData2 = new Map<
        string, // token
        AuxType[]
    >()

    groupedData.forEach((items: TrasformedType[], key) => {
        let total_volume = 0
        let total_volume_usd = 0
        items.forEach(item => {
            if (item.direction === 'inflow') {
                total_volume += item.total_volume
                total_volume_usd += item.total_volume_usd
            } else {
                total_volume -= item.total_volume
                total_volume_usd -= item.total_volume_usd
            }
        })
        const d = {
            transfer_date: items?.[0]?.transfer_date,
            token_id: items?.[0]?.token_id,
            token_info: items?.[0]?.token_info,
            total_volume,
            total_volume_usd,
        }

        const key2 = items?.[0].token_info.name

        if (!groupedData2.has(key2)) {
            groupedData2.set(key2, [d])
        } else {
            const group = groupedData2.get(key2)
            group?.push(d)
        }
    })

    groupedData2.forEach((items: AuxType[], key) => {
        let sorted = items?.sort(
            (a, b) => new Date(a.transfer_date).getTime() - new Date(b.transfer_date).getTime(),
        )

        for (let i = 0; i < sorted.length; i++) {
            if (i != 0) {
                sorted[i].total_volume = sorted[i - 1].total_volume + sorted[i].total_volume
                sorted[i].total_volume_usd =
                    sorted[i - 1].total_volume_usd + sorted[i].total_volume_usd
            }
        }
    })

    groupedData2.forEach((items: AuxType[]) => {
        result.push(...items)
    })

    return result
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        /**
         * To track the volume of assets moving across the bridge over time, you can aggregate data by day, week, or month using timestamps.
         *
         */
        const query = await db[networkConfig.network]`
            SELECT
                TO_TIMESTAMP(timestamp_ms / 1000)::DATE AS transfer_date,
                COUNT(*) AS total_count,
                SUM(amount) AS total_volume,
                destination_chain,
                token_id
            FROM
                public.token_transfer_data
            WHERE is_finalized=true
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

        const cumulativeData = addCumulativeNetInflow(transformedData)

        sendReply(res, cumulativeData)
    } catch (error) {
        sendError(res, error)
    }
}
