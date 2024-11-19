import { CoinType, NetworkConfigType } from 'src/utils/types'
import { NETWORK } from 'src/hooks/get-network-storage'
import { NextApiRequest } from 'next'

const TOKEN_LIST_MAINNET: Record<number, CoinType> = {
    2: {
        name: 'ETH',
        deno: Math.pow(10, 8),
        id: 2,
        color: '#5c6bc0',
        icon: '/assets/icons/brands/eth.svg',
        coingeckoId: 'ethereum',
    },
}
export const TOKEN_LIST_TESTNET: Record<number, CoinType> = {
    2: {
        name: 'ETH',
        deno: Math.pow(10, 8),
        id: 2,
        color: '#5c6bc0',
        icon: '/assets/icons/brands/eth.svg',
        coingeckoId: 'ethereum',
    },
    4: {
        name: 'USDT',
        deno: Math.pow(10, 6),
        id: 4,
        color: '#26A17B',
        icon: '/assets/icons/brands/usdt.svg',
        coingeckoId: 'tether',
    },

    1: {
        name: 'WBTC',
        deno: Math.pow(10, 8),
        id: 1,
        color: '#f7941a',
        icon: '/assets/icons/brands/btc.svg',
        coingeckoId: 'bitcoin',
    },

    3: {
        name: 'USDC',
        deno: Math.pow(10, 6),
        id: 3,
        color: '#2775CA',
        icon: '/assets/icons/brands/usdc.png',
        coingeckoId: 'usd-coin',
    },

    5: {
        name: 'Pepe',
        deno: Math.pow(10, 8), // teoretic are 18 decimals dar aici se seteaza doar 8 ??
        id: 5,
        color: '#20672c',
        icon: '/assets/icons/brands/pepe.webp',
        coingeckoId: 'pepe',
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
        coins: TOKEN_LIST_TESTNET, // todo: CHECK IF THE TOKENS HAVE SAME ID ON MAINNET & TESTNET !!
    },
    mainnet: {
        networkId: {
            SUI: 0,
            ETH: 10,
        },
        coins: TOKEN_LIST_MAINNET, // todo: CHECK IF THE TOKENS HAVE SAME ID ON MAINNET & TESTNET !!
    },
}

export interface INetworkConfig {
    config: NetworkConfigType
    network: NETWORK
}

export type TimePeriod = 'Last 24h' | 'Last Week' | 'Last Month' | 'Year to date' | 'All time'

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
