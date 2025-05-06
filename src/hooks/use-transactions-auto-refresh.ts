import { useEffect, useState } from 'react'

export function useTransactionsAutoRefresh(refreshInterval: number = 15000) {
    const [refreshCounter, setRefreshCounter] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setRefreshCounter(prev => prev + 1)
        }, refreshInterval)

        return () => clearInterval(interval)
    }, [refreshInterval])

    const forceRefresh = () => {
        setRefreshCounter(prev => prev + 1)
    }

    return {
        refreshCounter,
        forceRefresh,
    }
}
