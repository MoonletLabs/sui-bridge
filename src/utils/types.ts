import { NETWORK } from 'src/hooks/get-network-storage'

export type CoinType = {
    id: number
    name: string
    deno: number
    icon: string
    color: string
    coingeckoId: string
}

export type NetworkConfigType = {
    networkId: {
        SUI: number
        ETH: number
    }
    coins: Record<number, CoinType>
}
