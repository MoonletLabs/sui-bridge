import { CoinType, NetworkConfigType } from 'src/utils/types'
import { NETWORK } from 'src/hooks/get-network-storage'
import { NextApiRequest } from 'next'

const TOKEN_LIST: Record<number, CoinType> = {
    2: {
        name: 'ETH',
        deno: Math.pow(10, 8),
        priceUSD: 3191, // TODO: get dynamically @SergiuT
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
        priceUSD: 105048,
        id: 1,
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
        priceUSD: 0.00001278,
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
