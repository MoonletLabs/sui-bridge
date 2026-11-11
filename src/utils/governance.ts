import { CoinType } from './types'

export type GovChain = 'SUI' | 'ETH'

export type GovernanceRoute = { from: GovChain; to: GovChain }

export type GovernanceEvent = {
    id: number
    action: string
    /** Which chain's bridge contract emitted the event */
    source: GovChain
    timestamp_ms: number
    nonce: number | null
    /** Human readable one-liner */
    summary: string
    /** Set for limit updates */
    route?: GovernanceRoute
    /** Set for limit updates; USD, 24h rolling window */
    limit_usd?: number
    /** Base58 for Sui, 0x hex for Ethereum */
    tx_digest: string
    /** `severity` drives the chip colour in the timeline */
    tone: 'info' | 'warning' | 'success' | 'error'
}

export const GOVERNANCE_ACTION_LABELS: Record<string, string> = {
    UpdateBridgeLimit: 'Bridge limit',
    EmergencyOperation: 'Emergency pause',
    AddSuiTokens: 'Sui token added',
    AddEVMTokens: 'EVM token added',
    UpdateTokenPrices: 'Token price',
    UpdateCommitteeBlocklist: 'Committee blocklist',
    UpgradeEVMContract: 'Contract upgrade',
}

/** Limits and notional prices are fixed point with 8 decimals */
const USD_DECIMALS = 1e8

const isObj = (v: unknown): v is Record<string, any> =>
    typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Ethereum side payloads are wrapped in the emitted event name, e.g.
 * `{"LimitUpdatedV2": {...}}`. The name has changed between contract versions
 * (`LimitUpdated`, `LimitUpdatedV2Filter`, ...), so unwrap generically.
 */
export const unwrapEvent = (data: unknown): Record<string, any> => {
    if (!isObj(data)) return {}
    const keys = Object.keys(data)
    if (keys.length === 1 && isObj(data[keys[0]])) return data[keys[0]]
    return data
}

/** First defined value among several spellings of the same field */
const pick = (obj: Record<string, any>, ...keys: string[]) => {
    for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k]
    return undefined
}

export const fGovUsd = (usd: number) => {
    if (!Number.isFinite(usd)) return '$0'
    if (usd < 1) return '$0'
    if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`
    if (usd >= 1e6) return `$${(usd / 1e6).toFixed(usd % 1e6 === 0 ? 0 : 2)}M`
    if (usd >= 1e3) return `$${(usd / 1e3).toFixed(usd % 1e3 === 0 ? 0 : 1)}k`
    return `$${usd.toFixed(2)}`
}

const shortHex = (s: string) => (s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s)

type Ctx = {
    chainIds: { SUI: number; ETH: number }
    coins: Record<number, CoinType>
}

const chainName = (id: unknown, ctx: Ctx): GovChain | null => {
    const n = Number(id)
    if (n === ctx.chainIds.SUI) return 'SUI'
    if (n === ctx.chainIds.ETH) return 'ETH'
    return null
}

const tokenName = (id: unknown, ctx: Ctx) => {
    const coin = ctx.coins[Number(id)]
    return coin ? coin.name : `token #${id}`
}

export function describeGovernanceAction(
    action: string,
    rawData: unknown,
    ctx: Ctx,
): Pick<GovernanceEvent, 'summary' | 'route' | 'limit_usd' | 'tone'> {
    const d = unwrapEvent(rawData)

    switch (action) {
        case 'UpdateBridgeLimit': {
            const limit = Number(pick(d, 'new_limit', 'newLimit'))
            let from: GovChain | null = null
            let to: GovChain | null = null
            const sending = pick(d, 'sending_chain')
            if (sending !== undefined) {
                from = chainName(sending, ctx)
                to = chainName(pick(d, 'receiving_chain'), ctx)
            } else {
                // Ethereum side only names the source chain; the other end is implied
                from = chainName(pick(d, 'source_chain_id', 'sourceChainID'), ctx)
                to = from === 'SUI' ? 'ETH' : from === 'ETH' ? 'SUI' : null
            }
            const usd = limit / USD_DECIMALS
            const route = from && to ? { from, to } : undefined
            const where = route ? `${route.from} → ${route.to}` : 'a route'
            return {
                route,
                limit_usd: usd,
                tone: 'info',
                summary:
                    usd < 1
                        ? `Limit for ${where} set to ${fGovUsd(usd)} per 24h (transfers effectively blocked)`
                        : `Limit for ${where} set to ${fGovUsd(usd)} per 24h`,
            }
        }
        case 'EmergencyOperation': {
            const paused = pick(d, 'frozen', 'paused')
            return paused
                ? { summary: 'Bridge paused (emergency freeze)', tone: 'error' }
                : { summary: 'Bridge resumed (emergency freeze lifted)', tone: 'success' }
        }
        case 'AddSuiTokens': {
            const type = String(pick(d, 'type_name') ?? '')
            const symbol = type.split('::').pop() || 'token'
            const pkg = type.split('::')[0]
            const decimals = pick(d, 'decimal', 'decimal_multiplier')
            const id = pick(d, 'token_id')
            return {
                tone: 'warning',
                summary: `Sui token ${symbol}${id !== undefined ? ` (#${id})` : ''} registered${pkg ? ` from package 0x${shortHex(pkg).replace(/^0x/, '')}` : ''}${
                    decimals !== undefined && Number(decimals) < 100 ? `, ${decimals} decimals` : ''
                }`,
            }
        }
        case 'AddEVMTokens': {
            const ids: number[] = pick(d, 'token_i_ds', 'token_ids') ?? [pick(d, 'token_id')]
            const addresses: string[] = pick(d, 'token_addresses') ?? [pick(d, 'token_address')]
            const names = ids.filter(i => i !== undefined).map(i => tokenName(i, ctx))
            const addr = addresses.filter(Boolean).map(a => shortHex(String(a)))
            return {
                tone: 'warning',
                summary: `EVM token ${names.join(', ')} registered${
                    addr.length ? ` (${addr.join(', ')})` : ''
                }`,
            }
        }
        case 'UpdateTokenPrices': {
            const price = Number(pick(d, 'new_price', 'token_price', 'tokenPrice'))
            const id = pick(d, 'token_id', 'tokenID')
            return {
                tone: 'info',
                summary: `${tokenName(id, ctx)} notional price set to ${
                    Number.isFinite(price) ? `$${(price / USD_DECIMALS).toLocaleString()}` : '—'
                }`,
            }
        }
        case 'UpdateCommitteeBlocklist': {
            const blocked = pick(d, 'blocklisted', 'is_blocklisted', 'isBlocklisted')
            const members = pick(d, 'public_keys', 'updated_members') ?? []
            const n = Array.isArray(members) ? members.length : 0
            return {
                tone: blocked ? 'warning' : 'success',
                summary: `${n || ''} committee member${n === 1 ? '' : 's'} ${
                    blocked ? 'blocklisted' : 'removed from the blocklist'
                }`.trim(),
            }
        }
        case 'UpgradeEVMContract': {
            const impl = pick(d, 'implementation')
            return {
                tone: 'warning',
                summary: `EVM bridge contract upgraded${impl ? ` to ${shortHex(String(impl))}` : ''}`,
            }
        }
        default:
            return { summary: action, tone: 'info' }
    }
}
