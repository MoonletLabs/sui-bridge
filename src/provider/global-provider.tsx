'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { TimePeriod } from 'src/config/helper'
import { NETWORK } from 'src/hooks/get-network-storage'

interface GlobalContextProps {
    network: NETWORK
    timePeriod: TimePeriod
    selectedTokens: string[]
    setTimePeriod: (timePeriod: TimePeriod) => void
    setSelectedTokens: (tokens: string[]) => void
    toggleNetwork: () => void
    setNetwork: (network: NETWORK) => void
}

const GlobalContext = createContext<GlobalContextProps | undefined>(undefined)

export const GlobalProvider = ({ children }: { children: ReactNode }) => {
    const [network, setNetworkState] = useState<NETWORK>(NETWORK.MAINNET)
    const [isMounted, setIsMounted] = useState(false)
    const [timePeriod, setTimePeriodState] = useState<TimePeriod>('All time')
    const [selectedTokens, setSelectedTokensState] = useState<string[]>(['All'])

    // Update local storage and state when timePeriod changes
    const setTimePeriod = (newTimePeriod: TimePeriod) => {
        setTimePeriodState(newTimePeriod)
        localStorage.setItem('timePeriod', newTimePeriod)
    }

    // Update local storage and state when selectedTokens changes
    const setSelectedTokens = (newTokens: string[]) => {
        setSelectedTokensState(newTokens)
        localStorage.setItem('selectedTokens', JSON.stringify(newTokens))
    }

    useEffect(() => {
        // Load initial values from local storage when the component mounts
        const tokens = localStorage.getItem('selectedTokens')

        setTimePeriodState((localStorage.getItem('timePeriod') || 'All time') as TimePeriod)
        setSelectedTokensState(tokens ? JSON.parse(tokens) : ['All'])
    }, [])

    useEffect(() => {
        // Set mounted to true once component is mounted
        setIsMounted(true)
    }, [])

    useEffect(() => {
        if (isMounted) {
            const savedNetwork = localStorage.getItem('network') as NETWORK
            if (savedNetwork) {
                setNetworkState(savedNetwork)
            }
        }
    }, [isMounted])

    const toggleNetwork = () => {
        const newNetwork = network === NETWORK.MAINNET ? NETWORK.TESTNET : NETWORK.MAINNET
        setNetworkState(newNetwork)
        localStorage.setItem('network', newNetwork)
    }

    const setNetwork = (newNetwork: NETWORK) => {
        setNetworkState(newNetwork)
        localStorage.setItem('network', newNetwork)
    }

    return (
        <GlobalContext.Provider
            value={{
                network,
                toggleNetwork,
                setNetwork,
                timePeriod,
                setTimePeriod,
                selectedTokens,
                setSelectedTokens,
            }}
        >
            {children}
        </GlobalContext.Provider>
    )
}

export const useGlobalContext = (): GlobalContextProps => {
    const context = useContext(GlobalContext)
    if (!context) {
        throw new Error('useGlobalContext must be used within a GlobalProvider')
    }
    return context
}
