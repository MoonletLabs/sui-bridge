import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { withCache } from 'src/utils/api-cache'
import { getHashiRequests, HashiDeposit, HashiWithdrawal } from 'src/utils/hashi-chain'
import { sendError, sendReply } from '../utils'

const DAY_MS = 86_400_000

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
    totals: {
        deposits: number
        withdrawals: number
        depositSats: number
        withdrawalSats: number
        uniqueDepositors: number
        uniqueWithdrawers: number
        avgDepositSats: number
        avgWithdrawalSats: number
        largestDepositSats: number
        largestWithdrawalSats: number
    }
    /** Created request → minted hBTC (milliseconds), over confirmed deposits */
    depositTime: { medianMs: number | null; p90Ms: number | null; approvalMedianMs: number | null }
    /** Created request → Bitcoin transaction confirmed, over confirmed withdrawals */
    withdrawalTime: { medianMs: number | null; p90Ms: number | null }
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
        totals: {
            deposits: doneDeposits.length,
            withdrawals: doneWithdrawals.length,
            depositSats: sum(depositAmounts),
            withdrawalSats: sum(withdrawalAmounts),
            uniqueDepositors: new Set(doneDeposits.map(d => d.sender)).size,
            uniqueWithdrawers: new Set(doneWithdrawals.map(w => w.sender)).size,
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
        daily,
        recent,
    }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const { network } = getNetworkConfig({ req })
        const { deposits, withdrawals, tooLarge } = await getHashiRequests(network)
        return sendReply(res, { ...buildActivity(deposits, withdrawals), tooLarge })
    } catch (error) {
        console.error('hashi activity failed:', error)
        return sendError(res, { code: 502, message: 'Could not read Hashi activity' })
    }
}

export default withCache(handler, 120)
