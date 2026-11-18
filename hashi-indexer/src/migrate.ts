import { readdirSync, readFileSync } from 'fs'
import path from 'path'
import { log } from './log'
import type { Sql } from './db'

/** Applies migrations/*.sql in name order, each once, each in its own transaction */
export async function migrate(sql: Sql) {
    // Two copies starting together (or one restarting mid-migration) must not collide
    const conn = await sql.reserve()
    try {
        await conn`select pg_advisory_lock(hashtext('hashi-indexer:migrate'))`
        await apply(sql)
    } finally {
        await conn`select pg_advisory_unlock(hashtext('hashi-indexer:migrate'))`
        conn.release()
    }
}

async function apply(sql: Sql) {
    await sql`create table if not exists hashi_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
    )`
    const dir = path.join(__dirname, '..', 'migrations')
    const files = readdirSync(dir)
        .filter(f => f.endsWith('.sql'))
        .sort()
    for (const file of files) {
        const done = await sql`select 1 from hashi_migrations where name = ${file}`
        if (done.length) continue
        await sql.begin(async tx => {
            await tx.unsafe(readFileSync(path.join(dir, file), 'utf8'))
            await tx`insert into hashi_migrations (name) values (${file})`
        })
        log('info', 'migration applied', { file })
    }
}
