'use client'
import { createContext, useContext, useEffect } from 'react'
import { TOKEN_LIST_TESTNET } from 'src/config/helper'

const PriceUpdateContext = createContext(null)

export const PriceUpdateProvider = ({ children }: { children: React.ReactNode }) => {
    useEffect(() => {
        const fetchAndUpdatePrices = async () => {
            try {
                await fetch('/api/update-token-prices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tokenList: Object.values(TOKEN_LIST_TESTNET) }),
                })
            } catch (error) {
                console.error('Failed to update token prices:', error)
            }
        }

        fetchAndUpdatePrices()
        const intervalId = setInterval(fetchAndUpdatePrices, 60 * 60 * 1000)

        return () => clearInterval(intervalId)
    }, [])

    return <PriceUpdateContext.Provider value={null}>{children}</PriceUpdateContext.Provider>
}

export const usePriceUpdater = () => useContext(PriceUpdateContext)
