/**
 * https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore?tab=readme-ov-file#_flatten
 * https://github.com/you-dont-need-x/you-dont-need-lodash
 */

import { getNetworkConfig, INetworkConfig } from 'src/config/helper'
import { CardType, NetworkConfigType, TokenRespType } from './types'

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
) => {
    return data.map(it => {
        const tokenData = networkConfig?.config?.coins?.[it.token_id]
        if (tokenData) {
            return {
                ...it,
                total_count: Number(it.total_count),
                total_volume: Number(it.total_volume) / tokenData.deno,
                total_volume_usd: (Number(it.total_volume) / tokenData.deno) * tokenData.priceUSD,
                token_info: tokenData,
                destination_chain: getNetworkName(
                    it.destination_chain,
                    networkConfig.config.networkId,
                ),
            }
        } else {
            console.warn(`Cannot find tokenData for token_id: ${it.token_id}`)
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
) => {
    return data
        .map(it => {
            const tokenData = networkConfig?.config?.coins?.[it.token_id]
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
                    amount_usd: (Number(it.amount) / tokenData.deno) * tokenData.priceUSD,
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
        ?.filter(it => !!it)
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

    const uniqueAddressTotal = apiData.addresses
        .filter(
            item => selectedTokens.includes('All') || selectedTokens.includes(item.token_info.name),
        )
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

    const uniqueAddressTotalPrevious = apiData.previousAddresses
        .filter(
            item => selectedTokens.includes('All') || selectedTokens.includes(item.token_info.name),
        )
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
            title: 'Net flow (USD)',
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
