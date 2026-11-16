import { SATS_PER_BTC } from 'src/config/hashi'

export const satsToBtc = (sats: number) => sats / SATS_PER_BTC

/** 1443948184 sats -> "14.4395 BTC" (more decimals for small amounts) */
export function fBtc(sats: number, withUnit = true): string {
    const btc = satsToBtc(sats)
    const digits = Math.abs(btc) >= 1 ? 4 : Math.abs(btc) >= 0.01 ? 5 : 6
    const text = btc.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: digits,
    })
    return withUnit ? `${text} BTC` : text
}

/** 4300610 ms -> "1h 12m" */
export function fDuration(ms: number | null | undefined): string {
    if (ms == null) return '-'
    const minutes = Math.round(ms / 60000)
    if (minutes < 1) return '<1m'
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    if (hours < 48) return rest ? `${hours}h ${rest}m` : `${hours}h`
    return `${Math.round(hours / 24)}d`
}

export const shortAddress = (value: string, head = 6, tail = 4) =>
    value.length > head + tail + 3 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value

export const btcTxUrl = (txid: string, network: string) => {
    const id = txid.replace(/^0x/, '')
    return `https://mempool.space/${network === 'testnet' ? 'signet/' : ''}tx/${id}`
}

export const suiAccountUrl = (address: string, network: string) =>
    `https://suiscan.xyz/${network === 'testnet' ? 'testnet' : 'mainnet'}/account/${address}`
