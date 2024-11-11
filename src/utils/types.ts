import { NETWORK } from 'src/hooks/get-network-storage'

export type CoinType = {
    id: number
    name: string
    deno: number
    priceUSD: number
}

export type NetworkConfigType = {
    networkId: {
        SUI: number
        ETH: number
    }
    coins: Record<number, CoinType>
}

export type TokenColorInfo = {
    name: string
    color: string
    ticker: string
    icon: string
}

export const getTokensList: (network: NETWORK) => TokenColorInfo[] = (network: NETWORK) => {
    return network === NETWORK.MAINNET
        ? [
              {
                  ticker: 'ETH',
                  name: 'Ethereum',
                  color: '#5c6bc0',
                  icon: '/assets/icons/brands/eth.svg',
              },
          ]
        : [
              {
                  ticker: 'ETH',
                  name: 'Ethereum',
                  color: '#5c6bc0',
                  icon: '/assets/icons/brands/eth.svg',
              },
              {
                  ticker: 'WBTC',
                  name: 'Bitcoin',
                  color: '#f7941a',
                  icon: '/assets/icons/brands/btc.svg',
              },
              {
                  ticker: 'USDC',
                  name: 'USDC',
                  color: '#2775CA',
                  icon: '/assets/icons/brands/usdc.png',
              },
              {
                  ticker: 'Pepe',
                  name: 'Pepe',
                  color: '#20672c',
                  icon: '/assets/icons/brands/pepe.webp',
              },
              {
                  ticker: 'USDT',
                  name: 'USDT',
                  color: '#26A17B',
                  icon: '/assets/icons/brands/usdt.svg',
              },
          ]
}
