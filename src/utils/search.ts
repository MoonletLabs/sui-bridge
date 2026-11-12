// Pure helpers shared by the search UI and /api/search (no React, no DOM).

const HEX_RE = /^[0-9a-fA-F]+$/
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,50}$/
const URL_HASH_RE = /0x[0-9a-fA-F]{64}|0x[0-9a-fA-F]{40}/

/**
 * What the user typed, minus the noise around it: whitespace, quotes, trailing
 * punctuation, and explorer URLs (Etherscan, Suiscan, SuiVision...) reduced to
 * the hash / address / digest inside them.
 */
export function cleanSearchQuery(raw: string): string {
    let q = unwrap(raw.trim())

    if (/^(https?:\/\/|[\w-]+(\.[\w-]+)+\/)/i.test(q) || q.includes('/')) {
        // Drop query string / fragment, then look for a hash or a base58 digest in the path
        const path = q.replace(/^https?:\/\//i, '').split(/[?#]/)[0]
        const hex = path.match(URL_HASH_RE)
        if (hex) return hex[0]
        const segment = path.split('/').find(part => BASE58_RE.test(part))
        if (segment) return segment
    }

    return q
}

const PAIRS: Record<string, string> = { '"': '"', "'": "'", '`': '`', '(': ')', '[': ']', '<': '>' }

/**
 * Remove wrapping quotes / brackets and trailing sentence punctuation. A bracket
 * is only removed as a matching pair, so a comparison like "< 500" or ">= 1k" is kept.
 */
function unwrap(value: string): string {
    // Sentence punctuation can sit outside the brackets: "(0xabc)."
    let q = value.replace(/[.,;:]+$/, '')
    for (let i = 0; i < 3; i += 1) {
        const close = PAIRS[q[0]]
        if (q.length > 1 && close && q[q.length - 1] === close) {
            q = q.slice(1, -1).trim()
        } else {
            break
        }
    }
    return q.replace(/[.,;:]+$/, '')
}

export type QueryKind =
    | { type: 'hex'; hex: string }
    | { type: 'digest' }
    | { type: 'number'; value: number }
    | { type: 'none' }

/** Hex (any length, optional 0x), a base58 SUI digest, or a plain number */
export function classifyQuery(query: string): QueryKind {
    const q = query.trim()
    if (!q) return { type: 'none' }

    const body = /^0x/i.test(q) ? q.slice(2) : q
    if (body && body.length <= 64 && HEX_RE.test(body)) {
        // Digits only (and not 0x-prefixed) is a nonce / block height, unless it is 40 or 64 long
        if (/^\d+$/.test(q) && q.length <= 12) return { type: 'number', value: Number(q) }
        return { type: 'hex', hex: body.toLowerCase() }
    }
    if (BASE58_RE.test(q)) return { type: 'digest' }
    return { type: 'none' }
}
