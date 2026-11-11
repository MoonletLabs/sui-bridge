import type { ChainType, CoinType, NetworkConfigType } from 'src/utils/types'
import { NETWORK } from 'src/hooks/get-network-storage'
import { NextApiRequest } from 'next'
import { endpoints } from 'src/utils/axios'

/**
 * Static metadata for tokens we know about. The bridge `prices` table is the
 * source of truth for which token ids exist on each network, their ticker and
 * their denominator; this table only adds what the DB does not hold
 * (CoinGecko id). Tokens that appear in the DB but not here are registered
 * dynamically with `registerCoins`, so a newly listed token shows up without
 * a code change.
 *
 * Verified against both mainnet and testnet `prices` tables: the ids, tickers
 * and denominators below are identical on the two networks. Amounts are
 * normalised by the bridge to at most 8 decimals, which is why e.g. Pepe (18
 * decimals on Ethereum) has a denominator of 10^8.
 */
const KNOWN_COINS: Record<number, CoinType> = {
    1: { id: 1, name: 'WBTC', deno: Math.pow(10, 8), coingeckoId: 'bitcoin' },
    2: { id: 2, name: 'ETH', deno: Math.pow(10, 8), coingeckoId: 'ethereum' },
    3: { id: 3, name: 'USDC', deno: Math.pow(10, 6), coingeckoId: 'usd-coin' },
    4: { id: 4, name: 'USDT', deno: Math.pow(10, 6), coingeckoId: 'tether' },
    5: { id: 5, name: 'Pepe', deno: Math.pow(10, 8), coingeckoId: 'pepe' },
    6: { id: 6, name: 'WLBTC', deno: Math.pow(10, 8), coingeckoId: 'bitcoin' },
}

/** True for tokens shipped in the bundled config (as opposed to ones registered at runtime) */
export const isBundledToken = (id: number) => id in KNOWN_COINS

/** Each network gets its own copy so registering a token on one never leaks into the other */
const cloneCoins = (): Record<number, CoinType> =>
    Object.fromEntries(Object.entries(KNOWN_COINS).map(([id, coin]) => [id, { ...coin }]))

const NETWORK_CONFIG: {
    testnet: NetworkConfigType
    mainnet: NetworkConfigType
} = {
    testnet: {
        networkId: {
            SUI: 1,
            ETH: 11,
        },
        coins: cloneCoins(),
    },
    mainnet: {
        networkId: {
            SUI: 0,
            ETH: 10,
        },
        coins: cloneCoins(),
    },
}

// ----------------------------------------------------------------------
// Dynamic token registry (shared by the API routes and, via /api/token/registry, the UI)

let coinsVersion = 0
const coinListeners = new Set<() => void>()

export const subscribeCoins = (listener: () => void) => {
    coinListeners.add(listener)
    return () => {
        coinListeners.delete(listener)
    }
}

/** Bumped whenever the registry changes; used with useSyncExternalStore */
export const getCoinsVersion = () => coinsVersion

/**
 * Merge tokens reported by the bridge `prices` table into the network config:
 * unknown ids are added, and the DB denominator wins for known ids.
 * Returns true when something changed.
 */
export const registerCoins = (
    network: NETWORK,
    rows: { token_id: number; name: string; denominator?: number | string | null }[],
): boolean => {
    const coins = NETWORK_CONFIG[network]?.coins
    if (!coins) return false

    let changed = false
    for (const row of rows) {
        const id = Number(row.token_id)
        const denominator = Number(row.denominator)
        const existing = coins[id]

        if (!existing) {
            coins[id] = {
                id,
                name: row.name || `Token ${id}`,
                deno: Number.isFinite(denominator) && denominator > 0 ? denominator : 1,
                coingeckoId: '',
            }
            changed = true
        } else if (
            Number.isFinite(denominator) &&
            denominator > 0 &&
            existing.deno !== denominator
        ) {
            existing.deno = denominator
            changed = true
        }
    }

    if (changed) {
        coinsVersion += 1
        coinListeners.forEach(listener => listener())
    }
    return changed
}

export interface INetworkConfig {
    config: NetworkConfigType
    network: NETWORK
}

export interface IPrice {
    token_id: number
    name: string
    price: string
    last_updated: string
}

export interface TrasformedType {
    transfer_date: string
    total_count: number
    total_volume: number
    destination_chain: string
    token_id: number
    direction: string
    total_volume_usd: number
    token_info: {
        id: number
        name: string
        deno: number
        coingeckoId: string
    }
}

export type TimePeriod =
    | 'Last 24h'
    | 'Last Week'
    | 'Last Month'
    | 'Last 6 months'
    | 'Last year'
    | 'All time'

export const TIME_PERIODS: TimePeriod[] = [
    'Last 24h',
    'Last Week',
    'Last Month',
    'Last 6 months',
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
        case 'Last 6 months':
            return ['Daily', 'Weekly', 'Monthly']

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
        case 'Last 6 months':
            return 'Weekly'
        default:
            return 'Weekly'
    }
}

export const getVolumeEndpointForPeriod = (period: TimePeriod, network: NETWORK): string => {
    switch (period) {
        case 'Last 24h':
        case 'Last Week':
            return `${endpoints.volume.hourly}?network=${network}`
        case 'Last Month':
        case 'Last 6 months':
            return `${endpoints.volume.daily}?network=${network}`
        default:
            return `${endpoints.volume.daily}?network=${network}`
    }
}

export const getCumulativeInflowEndpointForPeriod = (
    period: TimePeriod,
    network: NETWORK,
): string => {
    switch (period) {
        case 'Last 24h':
        case 'Last Week':
            return `${endpoints.cumulative_inflow.hourly}?network=${network}`
        case 'Last Month':
        case 'Last 6 months':
            return `${endpoints.cumulative_inflow.daily}?network=${network}`
        default:
            return `${endpoints.cumulative_inflow.daily}?network=${network}`
    }
}

export const getNetworkConfig = (options: {
    req?: NextApiRequest
    network?: NETWORK
}): INetworkConfig => {
    const requested = options?.req?.query?.network || options?.network
    // Unknown values fall back to mainnet instead of crashing on an undefined db/config
    const network = (
        requested === NETWORK.TESTNET || requested === NETWORK.MAINNET ? requested : NETWORK.MAINNET
    ) as NETWORK

    return {
        config: NETWORK_CONFIG[network],
        network,
    }
}

export function truncateAddress(str: string, chars: number = 4) {
    if (!str || str.length <= 6) return str
    return `${str.slice(0, chars)}...${str.slice(-chars)}`
}

export const formatExplorerUrl = (opt: {
    network: NETWORK
    address: string
    isAccount: boolean
    chain: ChainType
}) => {
    const { network, address, isAccount, chain } = opt
    let prefix = ''
    if (chain === 'SUI') {
        prefix =
            network === NETWORK.MAINNET
                ? 'https://suiscan.xyz/mainnet/'
                : 'https://suiscan.xyz/testnet/'
        prefix += isAccount ? 'account/' : 'tx/'
    } else {
        prefix =
            network === NETWORK.MAINNET ? 'https://etherscan.io/' : 'https://sepolia.etherscan.io/'
        prefix += isAccount ? 'address/' : 'tx/'
    }

    return prefix + address
}
