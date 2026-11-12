import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { withCache } from 'src/utils/api-cache'
import { cleanSearchQuery, classifyQuery } from 'src/utils/search'
import { parseTransactionHash } from 'src/utils/helper'
import db from './database'
import { sendError, sendReply } from './utils'

/**
 * Looks up what a pasted value refers to in the bridge data: a transfer
 * (full or partial hash, SUI digest, nonce, block), or an address that took part
 * in at least one transfer.
 *
 * `token_transfer_data` has no index on the transaction hash or the recipient,
 * so every lookup is guarded:
 * - partial values need MIN_PREFIX_CHARS+ characters and only look at the last
 *   PREFIX_WINDOW_DAYS days (the timestamp index bounds the scan)
 * - at most MAX_PER_KIND rows per kind
 * - a short statement timeout, so a slow query cannot hold a connection
 * - a per-client rate limit (cache hits don't count)
 */
const MIN_PREFIX_CHARS = 6
const PREFIX_WINDOW_DAYS = 30
const MAX_PER_KIND = 5
const STATEMENT_TIMEOUT_MS = 3000
const ADDRESS_COUNT_CAP = 1000

const RATE_LIMIT = 40
const RATE_WINDOW_MS = 60_000
const MAX_TRACKED_CLIENTS = 5000

export type SearchHit =
    | {
          kind: 'tx'
          value: string
          timestamp_ms: number
          direction: 'inflow' | 'outflow'
          /** How it matched: the hash itself, a nonce or a block height */
          via: 'hash' | 'nonce' | 'block'
      }
    | { kind: 'sui-address' | 'eth-address'; value: string; transfers: number; capped: boolean }

export type SearchResponse = {
    hits: SearchHit[]
    /** Partial values only look back this many days */
    prefixWindowDays: number
    minPrefixChars: number
    /** The query was a partial value that is too short to search */
    tooShort?: boolean
}

// ----------------------------------------------------------------------
// Rate limit: fixed window per client, in memory (one process)

const hits = new Map<string, { count: number; resetAt: number }>()

const clientKey = (req: NextApiRequest) => {
    const forwarded = (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '')
        .toString()
        .split(',')[0]
        .trim()
    return forwarded || req.socket?.remoteAddress || 'unknown'
}

/** Returns the seconds to wait when the client is over the limit */
const rateLimited = (key: string): number => {
    const now = Date.now()
    const entry = hits.get(key)
    if (!entry || entry.resetAt <= now) {
        if (hits.size >= MAX_TRACKED_CLIENTS) {
            hits.forEach((v, k) => {
                if (v.resetAt <= now) hits.delete(k)
            })
            if (hits.size >= MAX_TRACKED_CLIENTS) hits.clear()
        }
        hits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
        return 0
    }
    entry.count += 1
    return entry.count > RATE_LIMIT ? Math.ceil((entry.resetAt - now) / 1000) : 0
}

// ----------------------------------------------------------------------

/** Byte range [lo, hi] of every value that starts with this hex prefix */
const prefixRange = (hex: string) => {
    const even = hex.length % 2 === 0
    return {
        lo: even ? hex : `${hex}0`,
        // anything of any length (hash 32 bytes, address 20/32 bytes) sorts below this
        hi: `${even ? hex : `${hex}f`}${'ff'.repeat(33)}`,
    }
}

async function search(network: 'mainnet' | 'testnet', suiId: number, query: string) {
    const kind = classifyQuery(query)
    const sql = db[network]
    const found: SearchHit[] = []

    const direction = (destination: number) =>
        Number(destination) === suiId ? 'inflow' : 'outflow'
    const txHit = (r: any, via: 'hash' | 'nonce' | 'block'): SearchHit => ({
        kind: 'tx',
        value: `0x${r.tx_hash}`,
        timestamp_ms: Number(r.timestamp_ms),
        direction: direction(r.destination_chain),
        via,
    })
    const addressHit = (hex: string, transfers: number): SearchHit => ({
        kind: hex.length === 40 ? 'eth-address' : 'sui-address',
        value: `0x${hex}`,
        transfers: Math.min(transfers, ADDRESS_COUNT_CAP),
        capped: transfers >= ADDRESS_COUNT_CAP,
    })

    await sql.begin(async (tx: any) => {
        await tx.unsafe(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`)

        if (kind.type === 'digest') {
            const hex = parseTransactionHash(query)
            const rows = await tx`
                SELECT encode(txn_hash, 'hex') AS tx_hash, timestamp_ms, destination_chain
                FROM token_transfer_data WHERE txn_hash = decode(${hex}, 'hex') LIMIT 1`
            rows.forEach((r: any) => found.push(txHit(r, 'hash')))
        } else if (kind.type === 'hex') {
            const hex = kind.hex
            const isFull64 = hex.length === 64
            const isFull40 = hex.length === 40

            if (isFull64 || isFull40) {
                const [txRows, countRows] = await Promise.all([
                    isFull64
                        ? tx`
                            SELECT encode(txn_hash, 'hex') AS tx_hash, timestamp_ms, destination_chain
                            FROM token_transfer_data WHERE txn_hash = decode(${hex}, 'hex') LIMIT 1`
                        : Promise.resolve([] as any[]),
                    tx`
                        SELECT COUNT(*)::INT AS n FROM (
                            (SELECT 1 FROM token_transfer_data
                             WHERE sender_address = decode(${hex}, 'hex') LIMIT ${ADDRESS_COUNT_CAP})
                            UNION ALL
                            (SELECT 1 FROM token_transfer_data
                             WHERE recipient_address = decode(${hex}, 'hex') LIMIT ${ADDRESS_COUNT_CAP})
                        ) x`,
                ])
                txRows.forEach((r: any) => found.push(txHit(r, 'hash')))
                const n = Number(countRows[0]?.n) || 0
                if (n > 0) found.push(addressHit(hex, n))
            } else if (hex.length >= MIN_PREFIX_CHARS) {
                const { lo, hi } = prefixRange(hex)
                const since = Date.now() - PREFIX_WINDOW_DAYS * 24 * 3600 * 1000
                const [txRows, addrRows] = await Promise.all([
                    tx`
                        SELECT encode(txn_hash, 'hex') AS tx_hash, timestamp_ms, destination_chain
                        FROM token_transfer_data
                        WHERE timestamp_ms >= ${since}
                          AND txn_hash >= decode(${lo}, 'hex') AND txn_hash <= decode(${hi}, 'hex')
                        ORDER BY timestamp_ms DESC LIMIT ${MAX_PER_KIND}`,
                    tx`
                        SELECT addr FROM (
                            SELECT DISTINCT encode(a, 'hex') AS addr FROM (
                                SELECT sender_address AS a FROM token_transfer_data
                                WHERE timestamp_ms >= ${since}
                                  AND sender_address >= decode(${lo}, 'hex')
                                  AND sender_address <= decode(${hi}, 'hex')
                                UNION ALL
                                SELECT recipient_address AS a FROM token_transfer_data
                                WHERE timestamp_ms >= ${since}
                                  AND recipient_address >= decode(${lo}, 'hex')
                                  AND recipient_address <= decode(${hi}, 'hex')
                            ) m
                        ) d LIMIT ${MAX_PER_KIND}`,
                ])
                txRows.forEach((r: any) => found.push(txHit(r, 'hash')))
                // Counts are skipped for partial matches: the user picks one, then sees its page
                addrRows.forEach((r: any) => found.push(addressHit(r.addr, 0)))
            }
        } else if (kind.type === 'number') {
            const n = kind.value
            const [byNonce, byBlock] = await Promise.all([
                tx`
                    SELECT encode(txn_hash, 'hex') AS tx_hash, timestamp_ms, destination_chain
                    FROM token_transfer_data WHERE nonce = ${n}
                    ORDER BY timestamp_ms DESC LIMIT ${MAX_PER_KIND}`,
                tx`
                    SELECT encode(txn_hash, 'hex') AS tx_hash, timestamp_ms, destination_chain
                    FROM token_transfer_data WHERE block_height = ${n}
                    ORDER BY timestamp_ms DESC LIMIT ${MAX_PER_KIND}`,
            ])
            byNonce.forEach((r: any) => found.push(txHit(r, 'nonce')))
            byBlock.forEach((r: any) => found.push(txHit(r, 'block')))
        }
    })

    return found
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const retryAfter = rateLimited(clientKey(req))
        if (retryAfter > 0) {
            res.setHeader('Retry-After', String(retryAfter))
            sendError(res, { code: 429, message: 'Too many searches, try again shortly' })
            return
        }

        const networkConfig = getNetworkConfig({ req })
        const query = cleanSearchQuery((req.query.q || '').toString())
        const kind = classifyQuery(query)

        const response: SearchResponse = {
            hits: [],
            prefixWindowDays: PREFIX_WINDOW_DAYS,
            minPrefixChars: MIN_PREFIX_CHARS,
        }

        if (kind.type === 'hex' && kind.hex.length < MIN_PREFIX_CHARS) {
            response.tooShort = true
        } else if (kind.type !== 'none') {
            response.hits = await search(
                networkConfig.network,
                networkConfig.config.networkId.SUI,
                query,
            )
        }

        sendReply(res, response)
    } catch (error: any) {
        // A timed out query is a "try a longer value", not a server fault
        if (error?.code === '57014') {
            sendError(res, { code: 503, message: 'Search took too long, try a longer value' })
            return
        }
        console.error('Search API error:', error)
        sendError(res, error)
    }
}

// Cache per full URL, so repeated lookups never reach the rate limiter or the DB
export default withCache(handler, 30)
