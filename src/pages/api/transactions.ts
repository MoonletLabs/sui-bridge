import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig } from 'src/config/helper'
import {
    buildConditionalQuery,
    isHexadecimal,
    removePrefix,
    transferHasStatus,
    transformTransfers,
} from 'src/utils/helper'
import db from './database'
import { parseIntParam, sendError, sendReply } from './utils'
import { getPrices } from './prices'

const SORTS = ['date', 'amount'] as const
const STATUSES = ['all', 'completed', 'awaiting_claim', 'pending_approval'] as const
type Status = (typeof STATUSES)[number]

/** One response page is at most this many rows; `export=1` raises it for CSV downloads */
const MAX_PAGE = 100
const MAX_EXPORT = 5000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })

        const isExport = req.query.export === '1'
        const offset = isExport ? 0 : parseIntParam(req.query.offset, 0)
        const limit =
            parseIntParam(
                req.query.limit,
                isExport ? MAX_EXPORT : 100,
                isExport ? MAX_EXPORT : MAX_PAGE,
            ) || MAX_PAGE

        const suiAddress = removePrefix(req.query.suiAddress?.toString() || '')
        const ethAddress = removePrefix(req.query.ethAddress?.toString() || '')
        const flow = (req.query.flow as 'all' | 'inflow' | 'outflow') || 'all'
        const senders = (req.query.senders?.toString() || '')
            .split(',')
            .map(s => removePrefix(s))
            .filter(s => s.length > 0)

        const recipients = (req.query.recipients?.toString() || '')
            .split(',')
            .map(r => removePrefix(r))
            .filter(r => r.length > 0)

        const rawFrom = req.query.amount_from ? Number(req.query.amount_from) : undefined
        const rawTo = req.query.amount_to ? Number(req.query.amount_to) : undefined
        const amountFrom = Number.isFinite(rawFrom) ? rawFrom : undefined
        const amountTo = Number.isFinite(rawTo) ? rawTo : undefined

        // Token tickers (e.g. "ETH,USDT") -> ids of this network
        const wantedTokens = (req.query.tokens?.toString() || '')
            .split(',')
            .map(t => t.trim())
            .filter(Boolean)
        // Make sure the token registry is loaded (cold process) before resolving tickers
        await getPrices(networkConfig.network)
        const tokenIds = Object.values(networkConfig.config.coins)
            .filter(coin => wantedTokens.includes(coin.name))
            .map(coin => coin.id)

        const statusParam = req.query.status as Status
        const status: Status = STATUSES.includes(statusParam) ? statusParam : 'all'

        const sort = SORTS.includes(req.query.sort as (typeof SORTS)[number])
            ? (req.query.sort as (typeof SORTS)[number])
            : 'date'
        const ascending = req.query.order === 'asc'

        const badSenders = senders.some(s => !isHexadecimal(s))
        const badRecipients = recipients.some(r => !isHexadecimal(r))

        if (
            (suiAddress && !isHexadecimal(suiAddress)) ||
            (ethAddress && !isHexadecimal(ethAddress)) ||
            badRecipients ||
            badSenders
        ) {
            sendError(res, {
                code: 400,
                message: 'you must provide valid addresses',
            })
            return
        }

        const sql = db[networkConfig.network]

        const conditionalQuery = buildConditionalQuery(
            sql,
            {
                suiAddress,
                ethAddress,
                flow,
                senders,
                recipients,
                amountFrom,
                amountTo,
                // Asking for tokens that don't exist here must match nothing, not everything
                tokenIds: wantedTokens.length ? (tokenIds.length ? tokenIds : [-1]) : undefined,
                status,
            },
            networkConfig,
        )

        // Whitelisted fragments only - never interpolate user input into ORDER BY
        const direction = ascending ? sql`ASC` : sql`DESC`
        const orderBy =
            sort === 'amount'
                ? sql`amount_usd ${direction} NULLS LAST, t.timestamp_ms DESC`
                : sql`t.timestamp_ms ${direction}`

        // The page, the totals and the prices are independent: fetch them together
        const [query, totals, prices] = await Promise.all([
            sql`
            SELECT
                encode(t.txn_hash, 'hex')           AS tx_hash,
                encode(t.sender_address, 'hex')     AS sender_address,
                encode(t.recipient_address, 'hex')  AS recipient_address,
                t.chain_id,
                t.destination_chain,
                t.nonce,
                t.block_height,
                t.timestamp_ms,
                t.token_id,
                t.amount,
                p.price,
                (t.amount::NUMERIC / p.denominator) * (p.price::FLOAT8) AS amount_usd,
                ${transferHasStatus(sql, 'Approved')} AS approved,
                ${transferHasStatus(sql, 'Claimed')}  AS claimed
            FROM token_transfer_data AS t
            JOIN prices AS p
                ON t.token_id = p.token_id
            WHERE
                is_finalized = true ${conditionalQuery}
            ORDER BY ${orderBy}
            OFFSET ${offset} LIMIT ${limit}`,
            sql`
            SELECT
                COUNT(*) AS count,
                COALESCE(SUM((t.amount::NUMERIC / p.denominator) * (p.price::FLOAT8)), 0) AS total_usd
            FROM token_transfer_data AS t
            JOIN prices AS p
                ON t.token_id = p.token_id
            WHERE is_finalized = true ${conditionalQuery}`,
            getPrices(networkConfig.network),
        ])

        const transactions = transformTransfers(networkConfig, query as any[], prices).map(
            (tx: any) => ({
                ...tx,
                status: tx.claimed
                    ? 'completed'
                    : tx.approved
                      ? 'awaiting_claim'
                      : 'pending_approval',
            }),
        )

        sendReply(res, {
            transactions,
            total: Number(totals?.[0]?.count),
            total_usd: Number(totals?.[0]?.total_usd) || 0,
        })
    } catch (error) {
        console.log({ error })
        sendError(res, error)
    }
}
