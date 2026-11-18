import postgres from 'postgres'
import { SUI_HASHI_POSTGRES_URL, SUI_HASHI_TESTNET_POSTGRES_URL } from 'src/pages/api/secrets'

type Client = ReturnType<typeof postgres>

// One small pool per network, created on first use. Without a configured URL there is no
// store: callers get null and fall back to reading Sui directly.
// Kept on globalThis so a dev-server hot reload reuses the pool instead of leaking a new one
// each time (the reader role allows only a few connections)
const globalWithClients = globalThis as typeof globalThis & {
    __hashiDbClients?: Partial<Record<'mainnet' | 'testnet', Client>>
}
const clients = (globalWithClients.__hashiDbClients ??= {})

export function getHashiDb(network: string): Client | null {
    const key = network === 'testnet' ? 'testnet' : 'mainnet'
    const url = key === 'testnet' ? SUI_HASHI_TESTNET_POSTGRES_URL : SUI_HASHI_POSTGRES_URL
    if (!url) return null
    if (!clients[key]) {
        // The reader role allows 5 connections per database and the dev and prod dashboards both use it:
        // 2 each leaves room for the other dashboard and one admin check
        clients[key] = postgres(url, { max: 2, idle_timeout: 60, connect_timeout: 5 })
    }
    return clients[key] as Client
}
