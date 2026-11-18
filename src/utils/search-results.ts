import { formatDistanceToNow } from 'date-fns'
import { getNetworkConfig, truncateAddress } from 'src/config/helper'
import type { NETWORK } from 'src/hooks/get-network-storage'
import type { SearchHit } from 'src/pages/api/search'
import { paths } from 'src/routes/paths'
import { cleanSearchQuery, classifyQuery } from 'src/utils/search'

export type SearchGroup = 'Transfers' | 'Addresses' | 'Tokens' | 'Filters' | 'Pages'

export type SearchResult = {
    key: string
    group: SearchGroup
    label: string
    description: string
    icon: string
    href: string
}

const PAGES = [
    { label: 'Overview', href: '/', keywords: ['overview', 'home', 'dashboard', 'volume'] },
    {
        label: 'Bridge Health',
        href: paths.health.root,
        keywords: ['health', 'latency', 'status', 'incident', 'delays'],
    },
    {
        label: 'Governance',
        href: paths.governance.root,
        keywords: ['governance', 'proposal', 'vote', 'committee', 'upgrade'],
    },
    { label: 'Flows', href: paths.flows.root, keywords: ['flows', 'inflow', 'outflow', 'net'] },
    { label: 'Tokens', href: paths.tokens.root, keywords: ['tokens', 'assets', 'coins'] },
    {
        label: 'Transactions',
        href: paths.transactions.root,
        keywords: ['transactions', 'transfers', 'txs', 'history'],
    },
    {
        label: 'Leaderboard',
        href: paths.leaderboard.root,
        keywords: ['leaderboard', 'top', 'whales', 'ranking', 'users'],
    },
    {
        label: 'Address profile',
        href: paths.profile.root,
        keywords: ['profile', 'address', 'wallet', 'account'],
    },
]

const STATUS_FILTERS = [
    {
        status: 'completed',
        label: 'Completed transfers',
        keywords: ['completed', 'claimed', 'done', 'settled', 'finished'],
    },
    {
        status: 'awaiting_claim',
        label: 'Transfers awaiting claim',
        keywords: ['awaiting claim', 'unclaimed', 'approved', 'waiting claim'],
    },
    {
        status: 'pending_approval',
        label: 'Transfers awaiting approval',
        keywords: ['pending', 'awaiting approval', 'unapproved', 'waiting approval', 'stuck'],
    },
]

const matches = (keywords: string[], q: string) =>
    q.length >= 2 && keywords.some(k => k.startsWith(q) || (q.length >= 3 && k.includes(q)))

const AMOUNT_RE =
    /^(>=?|<=?|over|above|more than|under|below|less than)\s*\$?\s*([\d.,]+)\s*([kmb])?$/i

/** "over 100k", "> $2.5m", "under 500" -> a transactions view filtered by amount */
function amountResult(q: string): SearchResult | null {
    const m = q.match(AMOUNT_RE)
    if (!m) return null
    const base = Number(m[2].replace(/,/g, ''))
    if (!Number.isFinite(base)) return null
    const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[3] || '').toLowerCase() as 'k' | 'm' | 'b'] ?? 1
    const value = Math.round(base * mult)
    const upper = /^(<|under|below|less)/i.test(m[1])
    const nice = value >= 1e6 ? `${value / 1e6}M` : value >= 1e3 ? `${value / 1e3}k` : `${value}`
    return {
        key: `amount-${upper ? 'to' : 'from'}-${value}`,
        group: 'Filters',
        label: `Transfers ${upper ? 'under' : 'over'} $${nice}`,
        description: 'Open the transactions page filtered by amount',
        icon: 'eva:funnel-outline',
        href: `${paths.transactions.root}?${upper ? 'amountTo' : 'amountFrom'}=${value}`,
    }
}

/**
 * Results that need no database: tokens, pages, status and amount filters.
 */
export function localSearchResults(rawQuery: string, network: NETWORK): SearchResult[] {
    const query = cleanSearchQuery(rawQuery)
    const q = query.toLowerCase()
    if (!q) return []

    const results: SearchResult[] = []

    const amount = amountResult(query)
    if (amount) results.push(amount)

    // Tokens by ticker or name
    const coins = Object.values(getNetworkConfig({ network }).config.coins) as {
        id: number
        name: string
    }[]
    coins
        .filter(c => q.length >= 2 && c.name.toLowerCase().includes(q))
        .slice(0, 4)
        .forEach(c =>
            results.push({
                key: `token-${c.id}`,
                group: 'Tokens',
                label: c.name,
                description: 'Token overview: volume, flows and top holders',
                icon: 'eva:pie-chart-outline',
                href: paths.tokens.details(c.id),
            }),
        )

    STATUS_FILTERS.filter(s => matches(s.keywords, q)).forEach(s =>
        results.push({
            key: `status-${s.status}`,
            group: 'Filters',
            label: s.label,
            description: 'Open the transactions page with this status',
            icon: 'eva:funnel-outline',
            href: `${paths.transactions.root}?status=${s.status}`,
        }),
    )

    PAGES.filter(p => matches([p.label.toLowerCase(), ...p.keywords], q)).forEach(p =>
        results.push({
            key: `page-${p.href}`,
            group: 'Pages',
            label: p.label,
            description: 'Go to page',
            icon: 'eva:arrow-forward-outline',
            href: p.href,
        }),
    )

    return results
}

function txResult(
    value: string,
    title: string,
    via: 'hash' | 'nonce' | 'block',
    detail = '',
): SearchResult {
    return {
        key: `tx-${value}-${via}`,
        group: 'Transfers',
        label: `${title} ${truncateAddress(value, 6)}`,
        description: detail || 'View bridge transaction details and timeline',
        icon: 'mdi:fingerprint',
        href: `${paths.transactions.root}/${value}`,
    }
}

function addressResult(
    value: string,
    kind: 'eth-address' | 'sui-address',
    transfers: number | null,
    capped = false,
): SearchResult {
    const count =
        transfers && transfers > 0
            ? `${capped ? `${transfers}+` : transfers} transfer${transfers === 1 ? '' : 's'} · `
            : ''
    return {
        key: `addr-${value}`,
        group: 'Addresses',
        label: `${kind === 'eth-address' ? 'Ethereum' : 'SUI'} address ${truncateAddress(value, 6)}`,
        description: `${count}View bridge profile and transaction history`,
        icon: 'eva:person-outline',
        href: `${paths.profile.root}?${kind === 'eth-address' ? 'ethAddress' : 'suiAddress'}=${value}`,
    }
}

/** Complete values we can send somewhere without asking the server (lookup unavailable) */
export function exactGuesses(rawQuery: string): SearchResult[] {
    const query = cleanSearchQuery(rawQuery)
    const kind = classifyQuery(query)
    if (kind.type === 'digest') {
        return [txResult(query, 'SUI transaction', 'hash')]
    }
    if (kind.type !== 'hex') return []
    const withPrefix = `0x${kind.hex}`
    if (kind.hex.length === 40) return [addressResult(withPrefix, 'eth-address', null)]
    if (kind.hex.length === 64) {
        return [
            txResult(withPrefix, 'Transaction', 'hash'),
            addressResult(withPrefix, 'sui-address', null),
        ]
    }
    return []
}

/** Turn what /api/search found into rows the dialog can show */
export function hitToResult(hit: SearchHit): SearchResult {
    if (hit.kind === 'tx') {
        const ago = formatDistanceToNow(hit.timestamp_ms, { addSuffix: true })
        const route = hit.direction === 'inflow' ? 'Ethereum → Sui' : 'Sui → Ethereum'
        const via =
            hit.via === 'nonce' ? 'Nonce match' : hit.via === 'block' ? 'Block match' : 'Transfer'
        return txResult(hit.value, 'Transaction', hit.via, `${via} · ${route} · ${ago}`)
    }
    return addressResult(hit.value, hit.kind, hit.transfers, hit.capped)
}

const MIN_LOOKUP_HEX = 6

/** A partial hash / address that is too short to look up (e.g. "0x3f9") */
export function isShortHex(rawQuery: string): boolean {
    const query = cleanSearchQuery(rawQuery)
    const kind = classifyQuery(query)
    return (
        kind.type === 'hex' &&
        kind.hex.length < MIN_LOOKUP_HEX &&
        (/^0x/i.test(query) || kind.hex.length >= 4)
    )
}

/** Does this query need the database (full/partial hash, address, digest, number)? */
export function needsLookup(rawQuery: string): boolean {
    const kind = classifyQuery(cleanSearchQuery(rawQuery))
    if (kind.type === 'hex') return kind.hex.length >= MIN_LOOKUP_HEX
    return kind.type !== 'none'
}
