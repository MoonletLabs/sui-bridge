import postgres from 'postgres'

export const connect = (url: string) =>
    postgres(url, { max: 6, idle_timeout: 30, onnotice: () => undefined })

export type Sql = ReturnType<typeof connect>

/**
 * Runs `fn` only if no other run of the same job holds the lock, so a slow run is never
 * overlapped by the next one (or by a second copy of the indexer). Returns null when skipped.
 */
export async function withLock<T>(sql: Sql, key: string, fn: () => Promise<T>): Promise<T | null> {
    const conn = await sql.reserve()
    try {
        const [{ locked }] = await conn`select pg_try_advisory_lock(hashtext(${key})) as locked`
        if (!locked) return null
        try {
            return await fn()
        } finally {
            await conn`select pg_advisory_unlock(hashtext(${key}))`
        }
    } finally {
        conn.release()
    }
}

/** Insert or update rows in chunks, so a large set stays under the parameter limit */
export async function inChunks<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
    for (let i = 0; i < rows.length; i += size) {
        await fn(rows.slice(i, i + size))
    }
}
