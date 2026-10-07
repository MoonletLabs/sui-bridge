import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import { decodeBridgeFailure, failureGroupKey, FailureSeverity } from 'src/utils/bridge-errors'
import { base58Encode } from 'src/utils/helper'
import db from '../database'
import { sendError, sendReply } from '../utils'

export type FailureBreakdownItem = {
    key: string
    label: string
    description: string
    severity: FailureSeverity
    location?: string
    abort_code?: number
    count: number
    share: number
    latest_timestamp_ms: number
}

export type FailedTransaction = {
    /** Base58 - these are always Sui transactions */
    tx_digest: string
    /** 0x prefixed hex Sui address */
    sender_address: string
    timestamp_ms: number
    label: string
    description: string
    severity: FailureSeverity
    location?: string
    abort_code?: number
    raw_status: string
}

export type FailuresResponse = {
    breakdown: FailureBreakdownItem[]
    transactions: FailedTransaction[]
    total: number
    monthly: { month: string; count: number }[]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const sql = db[networkConfig.network]

        const limit = Math.min(Number(req.query.limit) || 25, 100)
        const rawOffset = Number(req.query.offset)
        const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0

        const [groupRows, txRows, countRows, monthlyRows] = await Promise.all([
            // Group in SQL by raw status, decode + merge in JS so that different
            // raw strings mapping to the same abort code aggregate together.
            sql`
                SELECT failure_status, COUNT(*) AS count, MAX(timestamp_ms) AS latest
                FROM public.sui_error_transactions
                GROUP BY failure_status
            `,
            sql`
                SELECT
                    encode(txn_digest, 'hex') AS tx_digest,
                    encode(sender_address, 'hex') AS sender_address,
                    timestamp_ms,
                    failure_status
                FROM public.sui_error_transactions
                ORDER BY timestamp_ms DESC
                LIMIT ${limit} OFFSET ${offset}
            `,
            sql`SELECT COUNT(*) AS total FROM public.sui_error_transactions`,
            sql`
                SELECT
                    to_char(to_timestamp(timestamp_ms / 1000), 'YYYY-MM') AS month,
                    COUNT(*) AS count
                FROM public.sui_error_transactions
                WHERE timestamp_ms > (EXTRACT(EPOCH FROM NOW()) * 1000 - 31536000000)
                GROUP BY 1
                ORDER BY 1
            `,
        ])

        const total = Number(countRows[0]?.total) || 0

        // Merge decoded groups
        const merged = new Map<string, FailureBreakdownItem>()
        for (const row of groupRows as any[]) {
            const decoded = decodeBridgeFailure(row.failure_status)
            const key = failureGroupKey(row.failure_status)
            const count = Number(row.count) || 0
            const latest = Number(row.latest) || 0
            const existing = merged.get(key)

            if (existing) {
                existing.count += count
                existing.latest_timestamp_ms = Math.max(existing.latest_timestamp_ms, latest)
            } else {
                merged.set(key, {
                    key,
                    label: decoded.label,
                    description: decoded.description,
                    severity: decoded.severity,
                    location: decoded.location,
                    abort_code: decoded.abortCode,
                    count,
                    share: 0,
                    latest_timestamp_ms: latest,
                })
            }
        }

        const breakdown = Array.from(merged.values())
            .map(item => ({ ...item, share: total > 0 ? (item.count / total) * 100 : 0 }))
            .sort((a, b) => b.count - a.count)

        const transactions: FailedTransaction[] = (txRows as any[]).map(row => {
            const decoded = decodeBridgeFailure(row.failure_status)
            return {
                // sui_error_transactions only ever holds Sui transactions, whose
                // canonical digest form is base58 rather than hex
                tx_digest: base58Encode(row.tx_digest),
                sender_address: `0x${row.sender_address}`,
                timestamp_ms: Number(row.timestamp_ms),
                label: decoded.label,
                description: decoded.description,
                severity: decoded.severity,
                location: decoded.location,
                abort_code: decoded.abortCode,
                raw_status: row.failure_status,
            }
        })

        const response: FailuresResponse = {
            breakdown,
            transactions,
            total,
            monthly: (monthlyRows as any[]).map(r => ({
                month: r.month,
                count: Number(r.count) || 0,
            })),
        }

        sendReply(res, response)
    } catch (error) {
        console.error('Bridge failures API error:', error)
        sendError(res, { code: 500, message: 'Failed to load bridge failures' })
    }
}
