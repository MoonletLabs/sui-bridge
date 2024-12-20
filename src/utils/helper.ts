/**
 * https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore?tab=readme-ov-file#_flatten
 * https://github.com/you-dont-need-x/you-dont-need-lodash
 */

import { getNetworkConfig, INetworkConfig } from 'src/config/helper'
import { NetworkConfigType } from './types'

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

export const calculateCardsTotals = (apiData: any, selectedTokens: string[]) => {
    const inflowTotal = apiData.inflows
        .filter(
            (item: { token_info: { name: string } }) =>
                selectedTokens.includes('All') || selectedTokens.includes(item.token_info.name),
        )
        .reduce((acc: any, item: { total_volume_usd: any }) => acc + item.total_volume_usd, 0)

    const outflowTotal = apiData.outflows
        .filter(
            (item: { token_info: { name: string } }) =>
                selectedTokens.includes('All') || selectedTokens.includes(item.token_info.name),
        )
        .reduce((acc: any, item: { total_volume_usd: any }) => acc + item.total_volume_usd, 0)

    const volumeTotal = apiData.volume
        .filter(
            (item: { token_info: { name: string } }) =>
                selectedTokens.includes('All') || selectedTokens.includes(item.token_info.name),
        )
        .reduce((acc: any, item: { total_volume_usd: any }) => acc + item.total_volume_usd, 0)

    const uniqueAddressTotal = apiData.addresses
        .filter(
            (item: { token_info: { name: string } }) =>
                selectedTokens.includes('All') || selectedTokens.includes(item.token_info.name),
        )
        .reduce(
            (acc: number, item: { total_unique_addresses: any }) =>
                acc + parseInt(item.total_unique_addresses || 0),
            0,
        )

    return [
        {
            title: 'Total Inflow (USD)',
            value: inflowTotal,
            color: '#38B137', // green
            dollars: true,
        },
        {
            title: 'Total Outflow (USD)',
            value: outflowTotal,
            color: '#FCBD05', // yellow
            dollars: true,
        },
        {
            title: 'Total Volume (USD)',
            value: volumeTotal,
            color: '#FA3913', // red
            dollars: true,
        },
        {
            title: 'Unique Addresses',
            value: uniqueAddressTotal,
            color: '#3780FF', // blue
            dollars: false,
        },
    ]
}
