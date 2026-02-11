import { NextApiRequest, NextApiResponse } from 'next'
import { getNetworkConfig, TimePeriod } from 'src/config/helper'
import { sendError, sendReply } from './utils'
import db from './database'
import { computerIntervals } from './cards'
import { getPrices } from './prices'

export type LeaderboardUser = {
    rank: number
    address: string
    address_type: 'sui' | 'eth'
    total_volume_usd: number
    transaction_count: number
    tokens_used: number[]
    most_used_token: string
    most_used_token_count: number
    first_tx_date: number
    last_tx_date: number
}

export type LeaderboardResponse = {
    users: LeaderboardUser[]
    total: number
    stats: {
        total_users: number
        total_volume_usd: number
        avg_volume_per_user: number
        top_user_address: string
        top_user_volume: number
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        const networkConfig = getNetworkConfig({ req })
        const timePeriod = (req.query.period as TimePeriod) || 'Last Week'
        const addressType = (req.query.addressType as 'all' | 'sui' | 'eth') || 'all'
        const sortBy = (req.query.sortBy as 'volume' | 'count') || 'volume'
        const limit = Math.min(Number(req.query.limit) || 25, 100)
        const offset = Number(req.query.offset) || 0

        const { fromInterval, toInterval } = computerIntervals(timePeriod, false)
        const prices = await getPrices(networkConfig.network)

        // Build price lookup map
        const priceMap: Record<number, { price: number; deno: number; name: string }> = {}
        prices.forEach((p: any) => {
            priceMap[p.token_id] = {
                price: Number(p.price),
                deno: networkConfig.config.coins[p.token_id]?.deno || 1,
                name: networkConfig.config.coins[p.token_id]?.name || 'Unknown',
            }
        })

        // Build address type filter for WHERE clause
        const addressTypeFilter =
            addressType === 'all'
                ? db[networkConfig.network]``
                : addressType === 'sui'
                  ? db[
                        networkConfig.network
                    ]`AND t.destination_chain = ${networkConfig.config.networkId.ETH}`
                  : db[
                        networkConfig.network
                    ]`AND t.destination_chain = ${networkConfig.config.networkId.SUI}`

        const orderByClause =
            sortBy === 'volume'
                ? db[networkConfig.network]`total_volume_usd DESC NULLS LAST`
                : db[networkConfig.network]`transaction_count DESC`

        // Run both queries in parallel for better performance
        const [leaderboardQuery, globalStatsQuery] = await Promise.all([
            // Main leaderboard query
            db[networkConfig.network]`
                WITH base_transactions AS (
                    SELECT 
                        encode(t.sender_address, 'hex') as address,
                        t.destination_chain,
                        t.token_id,
                        t.amount,
                        t.timestamp_ms,
                        p.price,
                        p.denominator,
                        (t.amount::NUMERIC / p.denominator) * p.price::NUMERIC as amount_usd
                    FROM public.token_transfer_data t
                    JOIN public.prices p ON t.token_id = p.token_id
                    WHERE 
                        t.is_finalized = true
                        AND t.timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                        AND t.sender_address IS NOT NULL
                        ${addressTypeFilter}
                ),
                user_stats AS (
                    SELECT 
                        address,
                        COUNT(*) as transaction_count,
                        array_agg(DISTINCT token_id) as tokens_used,
                        MIN(timestamp_ms) as first_tx_date,
                        MAX(timestamp_ms) as last_tx_date,
                        SUM(amount_usd) as total_volume_usd,
                        -- Determine address type based on majority of transactions
                        CASE 
                            WHEN SUM(CASE WHEN destination_chain = ${networkConfig.config.networkId.SUI} THEN 1 ELSE 0 END) > 
                                 SUM(CASE WHEN destination_chain = ${networkConfig.config.networkId.ETH} THEN 1 ELSE 0 END)
                            THEN 'eth'
                            ELSE 'sui'
                        END as address_type
                    FROM base_transactions
                    GROUP BY address
                ),
                ranked_tokens AS (
                    SELECT 
                        address,
                        token_id,
                        COUNT(*) as token_count,
                        ROW_NUMBER() OVER (
                            PARTITION BY address 
                            ORDER BY COUNT(*) DESC
                        ) as rn
                    FROM base_transactions
                    GROUP BY address, token_id
                )
                SELECT 
                    us.address,
                    us.address_type,
                    us.transaction_count,
                    us.tokens_used,
                    us.first_tx_date,
                    us.last_tx_date,
                    COALESCE(us.total_volume_usd, 0) as total_volume_usd,
                    rt.token_id as most_used_token_id,
                    rt.token_count as most_used_token_count
                FROM user_stats us
                LEFT JOIN ranked_tokens rt ON us.address = rt.address AND rt.rn = 1
                ORDER BY ${orderByClause}
                LIMIT ${limit} OFFSET ${offset}
            `,
            // Global stats query - always calculates across ALL users (not affected by sort/pagination)
            db[networkConfig.network]`
                WITH base_transactions AS (
                    SELECT 
                        encode(t.sender_address, 'hex') as address,
                        t.token_id,
                        t.amount,
                        p.price,
                        p.denominator,
                        (t.amount::NUMERIC / p.denominator) * p.price::NUMERIC as amount_usd
                    FROM public.token_transfer_data t
                    JOIN public.prices p ON t.token_id = p.token_id
                    WHERE 
                        t.is_finalized = true
                        AND t.timestamp_ms BETWEEN ${fromInterval} AND ${toInterval}
                        AND t.sender_address IS NOT NULL
                        ${addressTypeFilter}
                ),
                user_volumes AS (
                    SELECT 
                        address,
                        SUM(amount_usd) as total_volume_usd
                    FROM base_transactions
                    GROUP BY address
                )
                SELECT 
                    COUNT(*) as total_users,
                    COALESCE(SUM(total_volume_usd), 0) as total_volume_usd,
                    COALESCE(AVG(total_volume_usd), 0) as avg_volume_per_user,
                    (SELECT address FROM user_volumes ORDER BY total_volume_usd DESC NULLS LAST LIMIT 1) as top_user_address,
                    (SELECT total_volume_usd FROM user_volumes ORDER BY total_volume_usd DESC NULLS LAST LIMIT 1) as top_user_volume
                FROM user_volumes
            `,
        ])

        // Transform results
        const users: LeaderboardUser[] = leaderboardQuery.map((row: any, index: number) => ({
            rank: offset + index + 1,
            address: row.address,
            address_type: row.address_type as 'sui' | 'eth',
            total_volume_usd: Number(row.total_volume_usd) || 0,
            transaction_count: Number(row.transaction_count),
            tokens_used: row.tokens_used || [],
            most_used_token: priceMap[row.most_used_token_id]?.name || 'Unknown',
            most_used_token_count: Number(row.most_used_token_count) || 0,
            first_tx_date: Number(row.first_tx_date),
            last_tx_date: Number(row.last_tx_date),
        }))

        // Use global stats from the dedicated query
        const globalStats = globalStatsQuery[0]

        const response: LeaderboardResponse = {
            users,
            total: Number(globalStats?.total_users) || 0,
            stats: {
                total_users: Number(globalStats?.total_users) || 0,
                total_volume_usd: Number(globalStats?.total_volume_usd) || 0,
                avg_volume_per_user: Number(globalStats?.avg_volume_per_user) || 0,
                top_user_address: globalStats?.top_user_address || '',
                top_user_volume: Number(globalStats?.top_user_volume) || 0,
            },
        }

        sendReply(res, response)
    } catch (error) {
        console.error('Leaderboard API error:', error)
        sendError(res, {
            code: 500,
            message: error instanceof Error ? error.message : 'Internal server error',
        })
    }
}
