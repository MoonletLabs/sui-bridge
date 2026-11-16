import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { withCache } from 'src/utils/api-cache'
import {
    getHashiRecentRequests,
    getHashiRequests,
    HashiDeposit,
    HashiWithdrawal,
} from 'src/utils/hashi-chain'
import { sendError, sendReply } from '../utils'

const DAY_MS = 86_400_000
const RECENT_BUCKET_MS = 600_000 // 10 minutes

export type HashiStatusCount = { status: string; count: number; sats: number }

export type HashiDailyPoint = {
    day_ms: number
    deposits: number
    deposit_sats: number
    withdrawals: number
    withdrawal_sats: number
}

export type HashiActivityResponse = {
    /** The network has too many requests to read from the chain directly */
    tooLarge?: boolean
    /**
     * 'full': every completed request. 'recent': only the latest request events (large
     * networks), counted as requests, with no timing data.
     */
    mode: 'full' | 'recent'
    /** Length of one `daily` bucket in milliseconds (a day, or minutes for recent mode) */
    bucketMs: number
    /** Period covered when mode is 'recent' */
    window?: { fromMs: number; toMs: number }
    totals: {
        deposits: number
        withdrawals: number
        depositSats: number
        withdrawalSats: number
        uniqueDepositors: number
        uniqueWithdrawers: number
        /** Different people who made at least one deposit or withdrawal */
        uniqueUsers: number
        /** People who both deposited and withdrew */
        twoWayUsers: number
        avgDepositSats: number
        avgWithdrawalSats: number
        largestDepositSats: number
        largestWithdrawalSats: number
    }
    /** Created request → minted hBTC (milliseconds), over confirmed deposits */
    depositTime: { medianMs: number | null; p90Ms: number | null; approvalMedianMs: number | null }
    /** Created request → Bitcoin transaction confirmed, over confirmed withdrawals */
    withdrawalTime: { medianMs: number | null; p90Ms: number | null }
    /** Requests by where they are in the process (full mode only) */
    depositStatus: HashiStatusCount[]
    withdrawalStatus: HashiStatusCount[]
    daily: HashiDailyPoint[]
    recent: ((HashiDeposit & { kind: 'deposit' }) | (HashiWithdrawal & { kind: 'withdrawal' }))[]
}

const percentile = (values: number[], p: number): number | null => {
    if (!values.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)
    return sorted[Math.max(0, idx)]
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

const statusCounts = (items: { status: string; amountSats: number }[], order: string[]) =>
    order
        .map(status => {
            const rows = items.filter(i => i.status === status)
            return { status, count: rows.length, sats: sum(rows.map(r => r.amountSats)) }
        })
        .filter(entry => entry.count > 0)

const userStats = (depositors: string[], withdrawers: string[]) => {
    const d = new Set(depositors)
    const w = new Set(withdrawers)
    const both = Array.from(d).filter(address => w.has(address)).length
    return { uniqueUsers: d.size + w.size - both, twoWayUsers: both }
}

export function buildActivity(
    deposits: HashiDeposit[],
    withdrawals: HashiWithdrawal[],
): HashiActivityResponse {
    // Only requests that actually completed count as volume
    const doneDeposits = deposits.filter(d => d.status === 'confirmed')
    const doneWithdrawals = withdrawals.filter(w => w.status === 'confirmed')

    const byDay = new Map<number, HashiDailyPoint>()
    const point = (ms: number) => {
        const day = Math.floor(ms / DAY_MS) * DAY_MS
        let p = byDay.get(day)
        if (!p) {
            p = { day_ms: day, deposits: 0, deposit_sats: 0, withdrawals: 0, withdrawal_sats: 0 }
            byDay.set(day, p)
        }
        return p
    }
    doneDeposits.forEach(d => {
        const p = point(d.confirmedMs as number)
        p.deposits += 1
        p.deposit_sats += d.amountSats
    })
    doneWithdrawals.forEach(w => {
        const p = point(w.confirmedMs as number)
        p.withdrawals += 1
        p.withdrawal_sats += w.amountSats
    })

    // Fill empty days so the chart has a continuous axis
    const days = Array.from(byDay.keys()).sort((a, b) => a - b)
    const daily: HashiDailyPoint[] = []
    if (days.length) {
        for (let t = days[0]; t <= days[days.length - 1]; t += DAY_MS) {
            daily.push(
                byDay.get(t) ?? {
                    day_ms: t,
                    deposits: 0,
                    deposit_sats: 0,
                    withdrawals: 0,
                    withdrawal_sats: 0,
                },
            )
        }
    }

    const depositMs = doneDeposits.map(d => (d.confirmedMs as number) - d.createdMs)
    const approvalMs = doneDeposits
        .filter(d => d.approvedMs)
        .map(d => (d.approvedMs as number) - d.createdMs)
    const withdrawalMs = doneWithdrawals.map(w => (w.confirmedMs as number) - w.createdMs)

    const depositAmounts = doneDeposits.map(d => d.amountSats)
    const withdrawalAmounts = doneWithdrawals.map(w => w.amountSats)

    const recent = [
        ...deposits.map(d => ({ ...d, kind: 'deposit' as const })),
        ...withdrawals.map(w => ({ ...w, kind: 'withdrawal' as const })),
    ]
        .sort((a, b) => b.createdMs - a.createdMs)
        .slice(0, 25)

    return {
        mode: 'full',
        bucketMs: DAY_MS,
        totals: {
            deposits: doneDeposits.length,
            withdrawals: doneWithdrawals.length,
            depositSats: sum(depositAmounts),
            withdrawalSats: sum(withdrawalAmounts),
            uniqueDepositors: new Set(doneDeposits.map(d => d.sender)).size,
            uniqueWithdrawers: new Set(doneWithdrawals.map(w => w.sender)).size,
            ...userStats(
                doneDeposits.map(d => d.sender),
                doneWithdrawals.map(w => w.sender),
            ),
            avgDepositSats: depositAmounts.length ? sum(depositAmounts) / depositAmounts.length : 0,
            avgWithdrawalSats: withdrawalAmounts.length
                ? sum(withdrawalAmounts) / withdrawalAmounts.length
                : 0,
            largestDepositSats: Math.max(0, ...depositAmounts),
            largestWithdrawalSats: Math.max(0, ...withdrawalAmounts),
        },
        depositTime: {
            medianMs: percentile(depositMs, 0.5),
            p90Ms: percentile(depositMs, 0.9),
            approvalMedianMs: percentile(approvalMs, 0.5),
        },
        withdrawalTime: {
            medianMs: percentile(withdrawalMs, 0.5),
            p90Ms: percentile(withdrawalMs, 0.9),
        },
        depositStatus: statusCounts(deposits, ['pending', 'approved', 'confirmed']),
        withdrawalStatus: statusCounts(withdrawals, ['pending', 'approved', 'signed', 'confirmed']),
        daily,
        recent,
    }
}

/** Latest request events (large networks): counts per 10 minutes, no timing information */
export function buildRecentActivity(
    deposits: HashiDeposit[],
    withdrawals: HashiWithdrawal[],
    window: { fromMs: number; toMs: number },
): HashiActivityResponse {
    const start = Math.floor(window.fromMs / RECENT_BUCKET_MS) * RECENT_BUCKET_MS
    const end = Math.floor(window.toMs / RECENT_BUCKET_MS) * RECENT_BUCKET_MS
    const daily: HashiDailyPoint[] = []
    for (let t = start; t <= end; t += RECENT_BUCKET_MS) {
        daily.push({ day_ms: t, deposits: 0, deposit_sats: 0, withdrawals: 0, withdrawal_sats: 0 })
    }
    const bucket = (ms: number) => daily[Math.floor((ms - start) / RECENT_BUCKET_MS)]
    deposits.forEach(d => {
        const p = bucket(d.createdMs)
        if (p) {
            p.deposits += 1
            p.deposit_sats += d.amountSats
        }
    })
    withdrawals.forEach(w => {
        const p = bucket(w.createdMs)
        if (p) {
            p.withdrawals += 1
            p.withdrawal_sats += w.amountSats
        }
    })

    const depositAmounts = deposits.map(d => d.amountSats)
    const withdrawalAmounts = withdrawals.map(w => w.amountSats)
    const recent = [
        ...deposits.map(d => ({ ...d, kind: 'deposit' as const })),
        ...withdrawals.map(w => ({ ...w, kind: 'withdrawal' as const })),
    ]
        .sort((a, b) => b.createdMs - a.createdMs)
        .slice(0, 25)

    return {
        mode: 'recent',
        bucketMs: RECENT_BUCKET_MS,
        window,
        totals: {
            deposits: deposits.length,
            withdrawals: withdrawals.length,
            depositSats: sum(depositAmounts),
            withdrawalSats: sum(withdrawalAmounts),
            uniqueDepositors: new Set(deposits.map(d => d.sender)).size,
            uniqueWithdrawers: new Set(withdrawals.map(w => w.sender)).size,
            ...userStats(
                deposits.map(d => d.sender),
                withdrawals.map(w => w.sender),
            ),
            avgDepositSats: depositAmounts.length ? sum(depositAmounts) / depositAmounts.length : 0,
            avgWithdrawalSats: withdrawalAmounts.length
                ? sum(withdrawalAmounts) / withdrawalAmounts.length
                : 0,
            largestDepositSats: Math.max(0, ...depositAmounts),
            largestWithdrawalSats: Math.max(0, ...withdrawalAmounts),
        },
        depositTime: { medianMs: null, p90Ms: null, approvalMedianMs: null },
        withdrawalTime: { medianMs: null, p90Ms: null },
        depositStatus: [],
        withdrawalStatus: [],
        daily,
        recent,
    }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { network } = getNetworkConfig({ req })
        const full = await getHashiRequests(network)
        if (full.tooLarge) {
            const latest = await getHashiRecentRequests(network)
            return sendReply(res, {
                ...buildRecentActivity(latest.deposits, latest.withdrawals, {
                    fromMs: latest.fromMs,
                    toMs: latest.toMs,
                }),
                tooLarge: true,
            })
        }
        return sendReply(res, {
            ...buildActivity(full.deposits, full.withdrawals),
            tooLarge: false,
        })
    } catch (error) {
        console.error('hashi activity failed:', error)
        return sendError(res, { code: 502, message: 'Could not read Hashi activity' })
    }
}

export default withCache(handler, 120)
