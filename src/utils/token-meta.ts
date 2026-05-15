import { NETWORK } from 'src/hooks/get-network-storage'
import { getNetworkConfig } from 'src/config/helper'
import { getTokensList, TokenColorInfo } from 'src/utils/types'

/**
 * Combined token metadata: id + ticker + display color + icon (when available).
 * Used by `/tokens` listing and token drilldown pages.
 */
export type TokenMeta = {
    id: number
    ticker: string
    name: string
    color: string
    icon?: string
    decimals: number
    coingeckoId: string
}

/**
 * Build a list of TokenMeta entries for a given network.
 * Only includes tokens that are actually bridged on that network
 * (i.e. present in the UI token list). This keeps the listing
 * consistent with pie charts / top-tokens / sankey on the same network.
 */
export function getTokenMetaList(network: NETWORK): TokenMeta[] {
    const config = getNetworkConfig({ network }).config
    const uiList: TokenColorInfo[] = getTokensList(network)
    const coinsByTicker: Record<string, { id: number; deno: number; coingeckoId: string }> = {}
    for (const coin of Object.values(config.coins)) {
        coinsByTicker[coin.name] = {
            id: coin.id,
            deno: coin.deno,
            coingeckoId: coin.coingeckoId,
        }
    }

    return uiList
        .map((ui): TokenMeta | null => {
            const coin = coinsByTicker[ui.ticker]
            if (!coin) return null
            return {
                id: coin.id,
                ticker: ui.ticker,
                name: ui.name,
                color: ui.color,
                icon: ui.icon,
                decimals: Math.log10(coin.deno) || 0,
                coingeckoId: coin.coingeckoId,
            }
        })
        .filter((t): t is TokenMeta => t !== null)
}

/**
 * Look up a token by id. Falls back to the raw network config
 * so /tokens/[id] still works for tokens that aren't in the UI list
 * (e.g. opening a USDC link while on mainnet).
 */
export function getTokenMeta(network: NETWORK, id: number | string): TokenMeta | undefined {
    const numericId = Number(id)
    const list = getTokenMetaList(network)
    const found = list.find(t => t.id === numericId)
    if (found) return found

    // Fallback: build a minimal meta from the network config if available
    const config = getNetworkConfig({ network }).config
    const coin = config.coins[numericId]
    if (!coin) return undefined
    return {
        id: coin.id,
        ticker: coin.name,
        name: coin.name,
        color: '#a78bfa',
        icon: undefined,
        decimals: Math.log10(coin.deno) || 0,
        coingeckoId: coin.coingeckoId,
    }
}
