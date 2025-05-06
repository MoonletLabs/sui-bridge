/**
 * https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore?tab=readme-ov-file#_flatten
 * https://github.com/you-dont-need-x/you-dont-need-lodash
 */

import { getNetworkConfig, INetworkConfig, IPrice, TrasformedType } from 'src/config/helper'
import {
    CardType,
    CumulativeInflowType,
    NetworkConfigType,
    TokenRespType,
    TransactionHistoryType,
    TransactionType,
} from './types'
import { paths } from 'src/routes/paths'

// ----------------------------------------------------------------------

export function flattenArray<T>(list: T[], key = 'children'): T[] {
    let children: T[] = []

    const flatten = list?.map((item: any) => {
        if (item[key] && item[key].length) {
            children = [...children, ...item[key]]
        }
        return item
    })

    return flatten?.concat(children.length ? flattenArray(children, key) : children)
}

// ----------------------------------------------------------------------

export function flattenDeep(array: any): any[] {
    const isArray = array && Array.isArray(array)

    if (isArray) {
        return array.flat(Infinity)
    }
    return []
}

// ----------------------------------------------------------------------

export function orderBy<T>(array: T[], properties: (keyof T)[], orders?: ('asc' | 'desc')[]): T[] {
    return array.slice().sort((a, b) => {
        for (let i = 0; i < properties.length; i += 1) {
            const property = properties[i]
            const order = orders && orders[i] === 'desc' ? -1 : 1

            const aValue = a[property]
            const bValue = b[property]

            if (aValue < bValue) return -1 * order
            if (aValue > bValue) return 1 * order
        }
        return 0
    })
}

// ----------------------------------------------------------------------

export function keyBy<T>(
    array: T[],
    key: keyof T,
): {
    [key: string]: T
} {
    return (array || []).reduce((result, item) => {
        const keyValue = key ? item[key] : item

        return { ...result, [String(keyValue)]: item }
    }, {})
}

// ----------------------------------------------------------------------

export function sumBy<T>(array: T[], iteratee: (item: T) => number): number {
    return array.reduce((sum, item) => sum + iteratee(item), 0)
}

// ----------------------------------------------------------------------

export function isEqual(a: any, b: any): boolean {
    if (a === null || a === undefined || b === null || b === undefined) {
        return a === b
    }

    if (typeof a !== typeof b) {
        return false
    }

    if (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean') {
        return a === b
    }

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false
        }

        return a.every((item, index) => isEqual(item, b[index]))
    }

    if (typeof a === 'object' && typeof b === 'object') {
        const keysA = Object.keys(a!)
        const keysB = Object.keys(b!)

        if (keysA.length !== keysB.length) {
            return false
        }

        return keysA.every(key => isEqual(a[key], b[key]))
    }

    return false
}

const numberToFixed = (value: number, decimals: number = 2) => {
    return Number(value?.toFixed(decimals))
}

export const removePrefix = (tx?: string) => {
    if (tx === 'undefined') return ''
    let finalTx = tx?.toString() || ''
    return finalTx?.startsWith('0x') || finalTx?.startsWith('0X') ? finalTx?.slice(2) : finalTx
}

export function isHexadecimal(str: string): boolean {
    // This regex allows an optional "0x" prefix and then one or more hexadecimal digits.
    const hexRegex = /^(0x)?[0-9A-Fa-f]+$/
    if (!hexRegex.test(str)) return false

    // Remove the "0x" prefix if it exists.
    const hexDigits = removePrefix(str)

    // Ensure the number of hex digits is even.
    return hexDigits.length % 2 === 0
}

const joinSQL = (sql: any, fragments: any[], separator: any) => {
    if (fragments.length === 0) return sql``
    return fragments.reduce(
        (prev, curr, index) => (index === 0 ? curr : sql`${prev}${separator}${curr}`),
        sql``,
    )
}

export const buildConditionalQuery = (
    sql: any,
    { suiAddress, ethAddress }: { suiAddress?: string; ethAddress?: string },
) => {
    const conditions: any[] = []

    if (suiAddress) {
        conditions.push(
            sql`(sender_address = decode(${suiAddress}, 'hex') OR recipient_address = decode(${suiAddress}, 'hex'))`,
        )
    }
    if (ethAddress) {
        conditions.push(
            sql`(sender_address = decode(${ethAddress}, 'hex') OR recipient_address = decode(${ethAddress}, 'hex'))`,
        )
    }

    return conditions.length ? sql`AND (${joinSQL(sql, conditions, sql` AND `)})` : sql``
}
// ----------------------------------------------------------------------

function isObject(item: any) {
    return item && typeof item === 'object' && !Array.isArray(item)
}

export const merge = (target: any, ...sources: any[]): any => {
    if (!sources.length) return target

    const source = sources.shift()

    // eslint-disable-next-line no-restricted-syntax
    for (const key in source) {
        if (isObject(source[key])) {
            if (!target[key]) Object.assign(target, { [key]: {} })
            merge(target[key], source[key])
        } else {
            Object.assign(target, { [key]: source[key] })
        }
    }

    return merge(target, ...sources)
}

export const setFlowDirection = (networkConfig: INetworkConfig, data: any[]) => {
    return data.map(it => ({
        ...it,
        direction:
            it.destination_chain === networkConfig.config.networkId.SUI ? 'inflow' : 'outflow',
    }))
}

const getNetworkName = (
    id: number,
    networkConfig: NetworkConfigType['networkId'],
): string | null => {
    for (const [key, value] of Object.entries(networkConfig)) {
        if (value === id) {
            return key
        }
    }
    return null // or throw an error if the ID is invalid
}

export const transformAmount = (
    networkConfig: INetworkConfig,
    data: {
        destination_chain: number
        token_id: number
        total_count: string
        total_volume: string
    }[],
    prices: IPrice[],
) => {
    return data.map(it => {
        const tokenData = networkConfig?.config?.coins?.[it.token_id]
        const priceData = prices.find(price => price.token_id === it.token_id)

        if (tokenData) {
            return {
                ...it,
                total_count: Number(it.total_count),
                total_volume: Number(it.total_volume) / tokenData.deno,
                total_volume_usd:
                    (Number(it.total_volume) / tokenData.deno) * Number(priceData?.price),
                token_info: tokenData,
                destination_chain: getNetworkName(
                    it.destination_chain,
                    networkConfig.config.networkId,
                ),
            }
        } else {
            // console.warn(`Cannot find tokenData for token_id: ${it.token_id}`)

            return {
                ...it,
                total_count: Number(it.total_count),
            }
        }
    })
}

export const transformTransfers = (
    networkConfig: INetworkConfig,
    data: {
        tx_hash: string
        sender_address: string
        recipient_address: string
        chain_id: number
        destination_chain: number
        nonce: number
        block_height: number
        timestamp_ms: number
        token_id: number
        amount: number
    }[],
    prices: IPrice[],
) => {
    return transformNumberFields(
        data
            .map(it => {
                const tokenData = networkConfig?.config?.coins?.[it.token_id]
                const priceData = prices.find(price => price.token_id === it.token_id)

                if (tokenData) {
                    const destination_chain = getNetworkName(
                        it.destination_chain,
                        networkConfig.config.networkId,
                    )
                    const from_chain = getNetworkName(it.chain_id, networkConfig.config.networkId)

                    let tx_hash = it.tx_hash // todo: fix hash for SUI
                    let sender_address = it.sender_address
                    let recipient_address = it.recipient_address

                    if (it.chain_id === networkConfig.config.networkId.ETH) {
                        tx_hash = `0x${it.tx_hash}`
                        sender_address = `0x${it.sender_address}`
                    } else {
                        recipient_address = `0x${it.recipient_address}`
                    }
                    return {
                        ...it,
                        amount: Number(it.amount) / tokenData.deno,
                        amount_usd: (Number(it.amount) / tokenData.deno) * Number(priceData?.price),
                        token_info: tokenData,
                        destination_chain,
                        from_chain,
                        tx_hash,
                        sender_address,
                        recipient_address,
                    }
                } else {
                    console.warn(`Cannot find tokenData for token_id: ${it.token_id}`)
                }
            })
            ?.filter(it => !!it),
    )
}

export const transformHistory = (data: TransactionHistoryType[]) => {
    return transformNumberFields(data)
        ?.map(it => {
            let tx_hash = it.tx_hash // todo: fix hash for SUI
            let txn_sender = it.txn_sender
            if (it.data_source === 'ETH') {
                tx_hash = `0x${it.tx_hash}`
                txn_sender = `0x${it.txn_sender}`
            }
            return {
                ...it,
                tx_hash,
                txn_sender,
            }
        })
        ?.sort((a, b) => a.timestamp_ms - b.timestamp_ms)
}

export const computeStats = (txs: TransactionType[]) => {
    const totalTransactions = txs.length
    const totalUsdVolume = txs.reduce((acc, tx) => acc + tx.amount_usd, 0)
    const avgTransactionUsd = totalTransactions > 0 ? totalUsdVolume / totalTransactions : 0

    // Median calculation:
    let medianTransactionUsd = 0
    if (totalTransactions > 0) {
        const sortedAmounts = txs.map(tx => tx.amount_usd).sort((a, b) => a - b)
        if (totalTransactions % 2 === 0) {
            medianTransactionUsd =
                (sortedAmounts[totalTransactions / 2 - 1] + sortedAmounts[totalTransactions / 2]) /
                2
        } else {
            medianTransactionUsd = sortedAmounts[Math.floor(totalTransactions / 2)]
        }
    }

    // Standard deviation calculation:
    let stdDeviationUsd = 0
    if (totalTransactions > 0) {
        const mean = avgTransactionUsd
        const variance =
            txs.reduce((acc, tx) => acc + Math.pow(tx.amount_usd - mean, 2), 0) / totalTransactions
        stdDeviationUsd = Math.sqrt(variance)
    }

    // Find the earliest and latest transactions based on timestamp
    let earliestTx = txs[0]
    let latestTx = txs[0]
    txs.forEach(tx => {
        if (tx.timestamp_ms < earliestTx.timestamp_ms) earliestTx = tx
        if (tx.timestamp_ms > latestTx.timestamp_ms) latestTx = tx
    })

    // Identify the largest and smallest transactions by USD amount
    let largestTx = txs[0]
    let smallestTx = txs[0]
    txs.forEach(tx => {
        if (tx.amount_usd > largestTx.amount_usd) largestTx = tx
        if (tx.amount_usd < smallestTx.amount_usd) smallestTx = tx
    })

    // Compute stats per token (group by token name)
    const tokenStats = txs.reduce(
        (acc, tx) => {
            const tokenName = tx.token_info.name
            if (!acc[tokenName]) {
                acc[tokenName] = { count: 0, totalAmount: 0, totalUsd: 0 }
            }
            acc[tokenName].count += 1
            acc[tokenName].totalAmount += tx.amount
            acc[tokenName].totalUsd += tx.amount_usd
            return acc
        },
        {} as { [token: string]: { count: number; totalAmount: number; totalUsd: number } },
    )

    // Find the most used token
    let mostUsedToken = ''
    let mostUsedTokenCount = 0
    Object.entries(tokenStats).forEach(([token, stats]) => {
        if (stats.count > mostUsedTokenCount) {
            mostUsedTokenCount = stats.count
            mostUsedToken = token
        }
    })

    // Number of unique tokens
    const uniqueTokensCount = Object.keys(tokenStats).length

    // SUI Inflow/Outflow Volume
    const suiInflowVolume = txs.reduce((acc, tx) => {
        if (tx.destination_chain === 'SUI') {
            return acc + tx.amount_usd
        }
        return acc
    }, 0)

    const suiOutflowVolume = txs.reduce((acc, tx) => {
        if (tx.from_chain === 'SUI') {
            return acc + tx.amount_usd
        }
        return acc
    }, 0)

    // Compute stats per chain (group by originating chain - from_chain)
    const chainStats = txs.reduce(
        (acc, tx) => {
            const chain = tx.from_chain
            if (!acc[chain]) {
                acc[chain] = {
                    count: 0,
                    differentTokens: [],
                    totalUsd: 0,
                    avgUsd: 0,
                    differentTokensCount: 0,
                }
            }
            acc[chain].count += 1
            acc[chain].differentTokens = [
                ...(acc?.[chain].differentTokens || []),
                tx.token_info.name,
            ]
            acc[chain].totalUsd += tx.amount_usd
            return acc
        },
        {} as {
            [chain: string]: {
                count: number
                differentTokens?: string[]
                differentTokensCount: number
                totalUsd: number
                avgUsd: number
            }
        },
    )

    // Compute the average USD value per chain
    Object.entries(chainStats).forEach(([chain, stats]) => {
        stats.avgUsd = stats.count > 0 ? stats.totalUsd / stats.count : 0
        stats.differentTokensCount = new Set(stats?.differentTokens || []).size

        delete stats.differentTokens
    })

    return {
        totalTransactions,
        totalUsdVolume,
        avgTransactionUsd,
        medianTransactionUsd,
        stdDeviationUsd,
        chainStats,
        earliestTx,
        latestTx,
        largestTx,
        smallestTx,
        tokenStats,
        mostUsedToken,
        mostUsedTokenCount,
        uniqueTokensCount,
        suiInflowVolume,
        suiOutflowVolume,
    }
}

export const transformNumberFields = <T extends Record<string, any>>(data: T[]) => {
    const fieldsToTransform = ['nonce', 'block_height', 'timestamp_ms', 'gas_usage']

    return data.map(obj => ({
        ...obj,
        ...Object.fromEntries(
            fieldsToTransform
                .filter(field => field in obj) // Check if the field exists in the object
                .map(field => [field, Number(obj[field])]),
        ),
    }))
}

export const calculateCardsTotals = (
    apiData: {
        inflows: TokenRespType[]
        outflows: TokenRespType[]
        addresses: TokenRespType[]
        previousInflows: TokenRespType[]
        previousOutflows: TokenRespType[]
        previousAddresses: TokenRespType[]
    },
    selectedTokens: string[],
): CardType[] => {
    const inflowTotal = apiData.inflows
        .filter(
            item => selectedTokens.includes('All') || selectedTokens.includes(item.token_info.name),
        )
        .reduce((acc: any, item: { total_volume_usd: any }) => acc + item.total_volume_usd, 0)

    const outflowTotal = apiData.outflows
        .filter(
            item => selectedTokens.includes('All') || selectedTokens.includes(item.token_info.name),
        )
        .reduce((acc: any, item: { total_volume_usd: any }) => acc + item.total_volume_usd, 0)

    const uniqueAddressTotal = selectedTokens.includes('All')
        ? Number(apiData.addresses.find(item => item.token_id === -1)?.total_unique_addresses) || 0
        : apiData.addresses
              .filter(item => selectedTokens.includes(item.token_info?.name))
              .reduce(
                  (acc: number, item: { total_unique_addresses: any }) =>
                      acc + parseInt(item.total_unique_addresses || 0),
                  0,
              )

    const netFlow = inflowTotal - outflowTotal

    // compute previous

    const inflowTotalPrevious = apiData.previousInflows
        .filter(
            item => selectedTokens.includes('All') || selectedTokens.includes(item.token_info.name),
        )
        .reduce((acc: any, item: { total_volume_usd: any }) => acc + item.total_volume_usd, 0)

    const outflowTotalPrevious = apiData.previousOutflows
        .filter(
            item => selectedTokens.includes('All') || selectedTokens.includes(item.token_info.name),
        )
        .reduce((acc: any, item: { total_volume_usd: any }) => acc + item.total_volume_usd, 0)

    const uniqueAddressTotalPrevious = selectedTokens.includes('All')
        ? Number(
              apiData.previousAddresses.find(item => item.token_id === -1)?.total_unique_addresses,
          ) || 0
        : apiData.previousAddresses
              .filter(item => selectedTokens.includes(item.token_info?.name))
              .reduce(
                  (acc: number, item: { total_unique_addresses: any }) =>
                      acc + parseInt(item.total_unique_addresses || 0),
                  0,
              )

    const netFlowPrevious = inflowTotalPrevious - outflowTotalPrevious

    return [
        {
            title: 'Total Inflow (USD)',
            value: inflowTotal,
            color: '#38B137', // green
            dollars: true,
            icon: 'solar:round-arrow-right-bold-duotone',
            percentageChange: numberToFixed(
                ((inflowTotal - inflowTotalPrevious) / inflowTotalPrevious) * 100,
            ),
        },
        {
            title: 'Total Outflow (USD)',
            value: outflowTotal,
            color: '#FA3913', // yellow
            dollars: true,
            icon: 'solar:round-arrow-left-bold-duotone',
            percentageChange: numberToFixed(
                ((outflowTotal - outflowTotalPrevious) / outflowTotalPrevious) * 100,
            ),
        },
        {
            title: 'Net inflow (USD)',
            value: netFlow,
            color: '#FCBD05', // red
            icon: 'solar:square-transfer-horizontal-bold-duotone',
            dollars: true,
            percentageChange: numberToFixed(((netFlow - netFlowPrevious) / netFlowPrevious) * 100),
        },
        {
            title: 'Unique Addresses',
            value: uniqueAddressTotal,
            color: '#3780FF', // blue
            dollars: false,
            icon: 'solar:pause-bold-duotone',
            percentageChange: numberToFixed(
                ((uniqueAddressTotal - uniqueAddressTotalPrevious) / uniqueAddressTotalPrevious) *
                    100,
            ),
        },
    ]
}

export const buildProfileQuery = (opt: { ethAddress?: string; suiAddress?: string }) => {
    const { ethAddress, suiAddress } = opt
    if (!ethAddress && !suiAddress) {
        return
    }

    let query = ''
    if (ethAddress) {
        query += `ethAddress=${ethAddress}`
    }
    if (suiAddress) {
        query += `suiAddress=${suiAddress}`
    }

    return `${paths.profile.root}?${query}`
}

export function addCumulativeNetInflow(
    data: TrasformedType[],
    iterateByHour?: boolean,
): CumulativeInflowType[] {
    const result: CumulativeInflowType[] = []
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

    const groupedData2 = new Map<
        string, // token
        CumulativeInflowType[]
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

    // Ensure all dates are present for each token
    groupedData2.forEach((items: CumulativeInflowType[], key) => {
        let sorted = items?.sort(
            (a, b) => new Date(a.transfer_date).getTime() - new Date(b.transfer_date).getTime(),
        )

        const allDates = new Set<string>()
        sorted.forEach(item => allDates.add(item.transfer_date))

        const minDate = new Date(sorted[0].transfer_date)
        const maxDate = new Date()

        for (
            let d = new Date(minDate);
            d <= maxDate;
            iterateByHour ? d.setHours(d.getHours() + 1) : d.setDate(d.getDate() + 1)
        ) {
            const dateStr = d.toISOString()
            if (!allDates.has(dateStr)) {
                sorted.push({
                    transfer_date: dateStr,
                    token_id: sorted[0].token_id,
                    token_info: sorted[0].token_info,
                    total_volume: 0,
                    total_volume_usd: 0,
                })
            }
        }

        sorted = sorted.sort(
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

    groupedData2.forEach((items: CumulativeInflowType[]) => {
        result.push(...items)
    })

    return result
}

// Helper to calculate sum from query results
export const sumQueryField = (data: any[], field: string): number => {
    return data.reduce((sum, item) => sum + parseInt(item[field] || '0'), 0)
}
