import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next'

/** `staleUntil` is when the entry may no longer be served at all, even stale (>= expires) */
type Entry = { expires: number; staleUntil: number; status: number; body: unknown }

/** Hard cap so varying query strings can't grow the cache without bound */
const MAX_ENTRIES = 500

const store = new Map<string, Entry>()
const inflight = new Map<string, Promise<Entry | null>>()

const remember = (key: string, entry: Entry) => {
    if (store.size >= MAX_ENTRIES) {
        // Map iterates in insertion order: drop the oldest entry
        const oldest = store.keys().next().value
        if (oldest !== undefined) store.delete(oldest)
    }
    store.set(key, entry)
}

const sendCached = (
    res: NextApiResponse,
    entry: Entry,
    ttlSeconds: number,
    state: 'HIT' | 'MISS' | 'STALE',
) => {
    res.setHeader(
        'Cache-Control',
        `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 5}`,
    )
    res.setHeader('X-Cache', state)
    res.status(entry.status).json(entry.body)
}

const newEntry = (
    ttlSeconds: number,
    staleSeconds: number,
    status: number,
    body: unknown,
): Entry => {
    const expires = Date.now() + ttlSeconds * 1000
    return { expires, staleUntil: expires + staleSeconds * 1000, status, body }
}

/**
 * Re-run a handler in the background and store its reply, while the caller is already being
 * served the stale one. Handlers only reply through `res.status(code).json(body)`, so a minimal
 * stand-in for `res` is enough. Does nothing if a refresh of this key is already running.
 */
const refreshInBackground = (
    key: string,
    handler: NextApiHandler,
    req: NextApiRequest,
    ttlSeconds: number,
    staleSeconds: number,
) => {
    if (inflight.has(key)) return
    let resolve: (e: Entry | null) => void = () => {}
    inflight.set(key, new Promise<Entry | null>(r => (resolve = r)))
    let status = 200
    const stand: Record<string, unknown> = {
        status: (code: number) => {
            status = code
            return stand
        },
        json: (body: unknown) => {
            if (status === 200) {
                const entry = newEntry(ttlSeconds, staleSeconds, status, body)
                remember(key, entry)
                resolve(entry)
            } else {
                resolve(null)
            }
            return stand
        },
        setHeader: () => stand,
        getHeader: () => undefined,
        end: () => stand,
    }
    Promise.resolve()
        .then(() => handler(req, stand as unknown as NextApiResponse))
        .catch(() => undefined)
        .finally(() => {
            resolve(null)
            inflight.delete(key)
        })
}

/**
 * Wrap an API route with a small in-memory TTL cache, keyed by the full URL
 * (path + query, so network/period/pagination all separate).
 *
 * - Only successful (200) JSON replies are cached; errors always re-run.
 * - Concurrent identical requests share one handler run, so a burst of page
 *   loads costs a single DB round trip instead of one each.
 * - Also sets `Cache-Control` so browsers/CDNs can reuse the reply.
 *
 * The dashboards' data moves on a minutes scale, so 30-60s is invisible to
 * users but removes most repeated heavy queries.
 */
export function withCache(
    handler: NextApiHandler,
    ttlSeconds = 60,
    options: { staleSeconds?: number } = {},
): NextApiHandler {
    // With `staleSeconds`, an expired entry is still served at once (marked X-Cache: STALE) while a
    // fresh one is fetched in the background, so only the very first request waits for the handler
    const staleSeconds = Math.max(0, options.staleSeconds ?? 0)
    return async (req: NextApiRequest, res: NextApiResponse) => {
        if (req.method !== 'GET') return handler(req, res)

        const key = req.url || ''
        const now = Date.now()

        const cached = store.get(key)
        if (cached && cached.expires > now) {
            sendCached(res, cached, ttlSeconds, 'HIT')
            return
        }
        if (cached && staleSeconds > 0 && cached.staleUntil > now) {
            sendCached(res, cached, ttlSeconds, 'STALE')
            refreshInBackground(key, handler, req, ttlSeconds, staleSeconds)
            return
        }

        const pending = inflight.get(key)
        if (pending) {
            const entry = await pending
            if (entry) {
                sendCached(res, entry, ttlSeconds, 'HIT')
                return
            }
            // The leader failed: fall through and run it ourselves
            return handler(req, res)
        }

        // Leader: run the handler against a capturing proxy of `res`
        let resolve: (e: Entry | null) => void = () => {}
        const promise = new Promise<Entry | null>(r => (resolve = r))
        inflight.set(key, promise)

        let status = 200
        const originalStatus = res.status.bind(res)
        const originalJson = res.json.bind(res)
        res.status = (code: number) => {
            status = code
            return originalStatus(code)
        }
        res.json = (body: unknown) => {
            if (status === 200) {
                const entry = newEntry(ttlSeconds, staleSeconds, status, body)
                remember(key, entry)
                res.setHeader(
                    'Cache-Control',
                    `public, s-maxage=${ttlSeconds}, stale-while-revalidate=${ttlSeconds * 5}`,
                )
                res.setHeader('X-Cache', 'MISS')
                resolve(entry)
            } else {
                resolve(null)
            }
            return originalJson(body)
        }

        try {
            await handler(req, res)
        } finally {
            // If the handler threw or never replied with JSON, release followers
            resolve(null)
            inflight.delete(key)
        }
    }
}

/** For tests / manual invalidation */
export const clearApiCache = () => {
    store.clear()
    inflight.clear()
}

/**
 * Cache an async function's result in memory (not an HTTP reply). Used for
 * data that many routes need on every request, such as token prices.
 */
export function memoizeAsync<A extends unknown[], R>(
    fn: (...args: A) => Promise<R>,
    keyOf: (...args: A) => string,
    ttlSeconds: number,
): (...args: A) => Promise<R> {
    const results = new Map<string, { expires: number; value: Promise<R> }>()
    return (...args: A) => {
        const key = keyOf(...args)
        const hit = results.get(key)
        if (hit && hit.expires > Date.now()) return hit.value
        const value = fn(...args)
        results.set(key, { expires: Date.now() + ttlSeconds * 1000, value })
        // Never keep a rejected promise around
        value.catch(() => results.delete(key))
        return value
    }
}
