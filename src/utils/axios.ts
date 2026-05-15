import type { AxiosRequestConfig } from 'axios'

import axios from 'axios'
import { CONFIG } from 'src/config'

// ----------------------------------------------------------------------

const axiosInstance = axios.create({ baseURL: CONFIG.apiBaseUrl })

axiosInstance.interceptors.response.use(
    response => response,
    error => Promise.reject((error.response && error.response.data) || 'Something went wrong!'),
)

export default axiosInstance

// ----------------------------------------------------------------------

export const fetcher = async (args: string | [string, AxiosRequestConfig]) => {
    try {
        const [url, config] = Array.isArray(args) ? args : [args]

        const res = await axiosInstance.get(url, { ...config })

        return res.data
    } catch (error) {
        console.error('Failed to fetch:', error)
        throw error
    }
}

// ----------------------------------------------------------------------

export const endpoints = {
    cards: '/api/cards',
    inflows: '/api/inflows',
    transactions: '/api/transactions',
    userStats: '/api/user-stats',
    transaction: '/api/transaction',
    outflows: '/api/outflows',
    bridgeMetrics: '/api/bridge-metrics', // Add this line
    fees: '/api/fees',
    leaderboard: '/api/leaderboard',
    leaderboardSparklines: '/api/leaderboard-sparklines',
    volume: {
        daily: '/api/volume/daily',
        hourly: '/api/volume/hourly',
        monthly: '/api/volume/monthly',
        weekly: '/api/volume/weekly',
    },
    cumulative_inflow: {
        daily: '/api/cumulative_inflow/daily',
        hourly: '/api/cumulative_inflow/hourly',
    },
    flows: '/api/flows',
    sizeHistogram: '/api/size-histogram',
    token: {
        summary: '/api/token/summary',
        overview: (id: number) => `/api/token/${id}/overview`,
        volume: (id: number) => `/api/token/${id}/volume`,
        holders: (id: number) => `/api/token/${id}/holders`,
        sizeHistogram: (id: number) => `/api/token/${id}/size-histogram`,
    },
}
