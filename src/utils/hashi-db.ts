import postgres from 'postgres'
import { SUI_HASHI_POSTGRES_URL, SUI_HASHI_TESTNET_POSTGRES_URL } from 'src/pages/api/secrets'

type Client = ReturnType<typeof postgres>

// One small pool per network, created on first use. Without a configured URL there is no
// store: callers get null and fall back to reading Sui directly.
const clients: Partial<Record<'mainnet' | 'testnet', Client>> = {}

export function getHashiDb(network: string): Client | null {
    const key = network === 'testnet' ? 'testnet' : 'mainnet'
    const url = key === 'testnet' ? SUI_HASHI_TESTNET_POSTGRES_URL : SUI_HASHI_POSTGRES_URL
    if (!url) return null
    if (!clients[key]) {
        clients[key] = postgres(url, { max: 3, idle_timeout: 60, connect_timeout: 5 })
    }
    return clients[key] as Client
}
