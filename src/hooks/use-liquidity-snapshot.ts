'use client'

import dayjs from 'dayjs'
import { useMemo } from 'react'
import useSWR from 'swr'
import { getStockEndpointForPeriod } from 'src/config/helper'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { fetcher } from 'src/utils/axios'
import { getTokensList } from 'src/utils/types'

export type StockApiItem = {
    transfer_date: string
    token_id: number
    token_info: {
        id: number
        name: string
        deno: number
        coingeckoId: string
    }
    stock_amount: number
    stock_amount_usd: number
    raw_stock_amount: number
}

export type TokenSnapshot = {
    token: string
    icon?: string
    color?: string
    current: { amount: number; usd: number }
    prev24h: { amount: number; usd: number }
    prev7d: { amount: number; usd: number }
    delta24h: { amount: number; usd: number; pct: number }
    delta7d: { amount: number; usd: number; pct: number }
    sharePct: number
    // Spark: last ~30 daily USD points (chronological)
    sparkline: number[]
}

export type LiquiditySnapshot = {
    rows: TokenSnapshot[]
    totalUsd: number
    totalPrev24hUsd: number
    totalPrev7dUsd: number
    delta24hUsd: number
    delta24hPct: number
    delta7dUsd: number
    delta7dPct: number
    largestToken?: TokenSnapshot
}

function pickOnOrBefore(rows: StockApiItem[], target: dayjs.Dayjs): StockApiItem | undefined {
    // rows are ascending; walk backwards to find the newest <= target
    for (let i = rows.length - 1; i >= 0; i--) {
        if (dayjs(rows[i].transfer_date).isBefore(target.add(1, 'second'))) {
            return rows[i]
        }
    }
    return undefined
}

function pct(curr: number, prev: number): number {
    if (!prev) return 0
    return ((curr - prev) / Math.abs(prev)) * 100
}

export function useLiquiditySnapshot(): {
    snapshot: LiquiditySnapshot | null
    isLoading: boolean
    error: unknown
} {
    const network = getNetwork()
    const { timePeriod, selectedTokens } = useGlobalContext()

    const { data, isLoading, error } = useSWR<StockApiItem[]>(
        getStockEndpointForPeriod(timePeriod, network),
        fetcher,
        { revalidateOnFocus: false },
    )

    const snapshot = useMemo<LiquiditySnapshot | null>(() => {
        if (!data?.length) return null

        const tokensMeta = getTokensList(network)
        const includeToken = (name: string) =>
            selectedTokens.includes('All') || selectedTokens.includes(name)

        // Group rows by token, sorted chronologically.
        const byToken = new Map<string, StockApiItem[]>()
        data.forEach(row => {
            const name = row?.token_info?.name
            if (!name || !includeToken(name)) return
            if (!byToken.has(name)) byToken.set(name, [])
            byToken.get(name)!.push(row)
        })
        byToken.forEach(arr =>
            arr.sort(
                (a, b) => new Date(a.transfer_date).getTime() - new Date(b.transfer_date).getTime(),
            ),
        )

        const now = dayjs()
        const t24h = now.subtract(24, 'hour')
        const t7d = now.subtract(7, 'day')

        const rowsPre: TokenSnapshot[] = []
        byToken.forEach((rows, token) => {
            if (!rows.length) return
            const meta = tokensMeta.find(t => t.ticker === token)
            const latest = rows[rows.length - 1]
            const r24 = pickOnOrBefore(rows, t24h)
            const r7 = pickOnOrBefore(rows, t7d)

            const current = {
                amount: Number(latest.stock_amount) || 0,
                usd: Number(latest.stock_amount_usd) || 0,
            }
            const prev24h = {
                amount: Number(r24?.stock_amount) || 0,
                usd: Number(r24?.stock_amount_usd) || 0,
            }
            const prev7d = {
                amount: Number(r7?.stock_amount) || 0,
                usd: Number(r7?.stock_amount_usd) || 0,
            }

            // Sparkline: last 30 daily USD values
            const sparkline = rows.slice(-30).map(r => Number(r.stock_amount_usd) || 0)

            rowsPre.push({
                token,
                icon: meta?.icon,
                color: meta?.color,
                current,
                prev24h,
                prev7d,
                delta24h: {
                    amount: current.amount - prev24h.amount,
                    usd: current.usd - prev24h.usd,
                    pct: pct(current.usd, prev24h.usd),
                },
                delta7d: {
                    amount: current.amount - prev7d.amount,
                    usd: current.usd - prev7d.usd,
                    pct: pct(current.usd, prev7d.usd),
                },
                sharePct: 0, // filled in below
                sparkline,
            })
        })

        const totalUsd = rowsPre.reduce((s, r) => s + r.current.usd, 0)
        const totalPrev24hUsd = rowsPre.reduce((s, r) => s + r.prev24h.usd, 0)
        const totalPrev7dUsd = rowsPre.reduce((s, r) => s + r.prev7d.usd, 0)

        const rows = rowsPre
            .map(r => ({
                ...r,
                sharePct: totalUsd ? (r.current.usd / totalUsd) * 100 : 0,
            }))
            .sort((a, b) => b.current.usd - a.current.usd)

        return {
            rows,
            totalUsd,
            totalPrev24hUsd,
            totalPrev7dUsd,
            delta24hUsd: totalUsd - totalPrev24hUsd,
            delta24hPct: pct(totalUsd, totalPrev24hUsd),
            delta7dUsd: totalUsd - totalPrev7dUsd,
            delta7dPct: pct(totalUsd, totalPrev7dUsd),
            largestToken: rows[0],
        }
    }, [data, selectedTokens, network])

    return { snapshot, isLoading, error }
}
