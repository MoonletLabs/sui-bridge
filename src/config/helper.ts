import { CoinType, NetworkConfigType } from 'src/utils/types'
import { NETWORK } from 'src/hooks/get-network-storage'
import { NextApiRequest } from 'next'
import { endpoints } from 'src/utils/axios'

const TOKEN_LIST: Record<number, CoinType> = {
    2: {
        name: 'ETH',
        deno: Math.pow(10, 8),
        priceUSD: 2350, // TODO: get dynamically @SergiuT
        id: 2,
    },

    4: {
        name: 'USDT',
        deno: Math.pow(10, 6),
        priceUSD: 1,
        id: 4,
    },

    1: {
        name: 'WBTC',
        deno: Math.pow(10, 8),
        priceUSD: 95000,
        id: 1,
    },

    6: {
        name: 'WLBTC',
        deno: Math.pow(10, 8),
        priceUSD: 95000,
        id: 6,
    },

    3: {
        name: 'USDC',
        deno: Math.pow(10, 6),
        priceUSD: 1,
        id: 3,
    },

    5: {
        name: 'Pepe',
        deno: Math.pow(10, 8), // teoretic are 18 decimals dar aici se seteaza doar 8 ??
        priceUSD: 0.057456,
        id: 5,
    },
}

const NETWORK_CONFIG: {
    testnet: NetworkConfigType
    mainnet: NetworkConfigType
} = {
    testnet: {
        networkId: {
            SUI: 1,
            ETH: 11,
        },
        coins: TOKEN_LIST, // todo: CHECK IF THE TOKENS HAVE SAME ID ON MAINNET & TESTNET !!
    },
    mainnet: {
        networkId: {
            SUI: 0,
            ETH: 10,
        },
        coins: TOKEN_LIST, // todo: CHECK IF THE TOKENS HAVE SAME ID ON MAINNET & TESTNET !!
    },
}

export interface INetworkConfig {
    config: NetworkConfigType
    network: NETWORK
}

export type TimePeriod = 'Last 24h' | 'Last Week' | 'Last Month' | 'Last year' | 'All time'

export const TIME_PERIODS: TimePeriod[] = [
    'Last 24h',
    'Last Week',
    'Last Month',
    'Last year',
    'All time',
]

export type TimeInterval = 'Hourly' | 'Daily' | 'Weekly' | 'Monthly'

export const TIME_INTERVALS: TimeInterval[] = ['Daily', 'Weekly', 'Monthly']

export const getTimeIntervalForPeriod = (period: TimePeriod): TimeInterval[] => {
    switch (period) {
        case 'Last 24h':
            return ['Hourly']
        case 'Last Week':
            return ['Hourly', 'Daily']
        case 'Last Month':
            return ['Daily', 'Weekly']

        default:
            return TIME_INTERVALS
    }
}

export const getDefaultTimeIntervalForPeriod = (period: TimePeriod): TimeInterval => {
    switch (period) {
        case 'Last 24h':
            return 'Hourly'
        case 'Last Week':
        case 'Last Month':
            return 'Daily'
        default:
            return 'Weekly'
    }
}

export const getVolumeEndpointForPeriod = (period: TimePeriod, network: NETWORK): string => {
    switch (period) {
        case 'Last 24h':
        case 'Last Week':
            return `${endpoints.volume.hourly}?network=${network}`
        default:
            return `${endpoints.volume.daily}?network=${network}`
    }
}

export const getNetworkConfig = (options: {
    req?: NextApiRequest
    network?: NETWORK
}): INetworkConfig => {
    const network = (options?.req?.query?.network || options?.network || NETWORK.MAINNET) as NETWORK

    return {
        config: NETWORK_CONFIG[network],
        network,
    }
}
