'use client'

import { useEffect, useSyncExternalStore } from 'react'
import useSWR from 'swr'
import { getCoinsVersion, registerCoins, subscribeCoins } from 'src/config/helper'
import { getNetwork } from 'src/hooks/get-network-storage'
import { endpoints, fetcher } from 'src/utils/axios'
import type { TokenRegistryResponse } from 'src/pages/api/token/registry'

/**
 * Keeps the client's token config in sync with the tokens the bridge reports
 * (see `/api/token/registry`) and re-renders the caller when a token the
 * bundled config did not know about gets registered.
 */
export function useTokenRegistry() {
    const network = getNetwork()

    const { data } = useSWR<TokenRegistryResponse>(
        `${endpoints.token.registry}?network=${network}`,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 300000 },
    )

    useEffect(() => {
        if (data?.tokens?.length) {
            registerCoins(
                network,
                data.tokens.map(t => ({ token_id: t.id, name: t.name, denominator: t.deno })),
            )
        }
    }, [data, network])

    // Re-render when the registry changes
    return useSyncExternalStore(subscribeCoins, getCoinsVersion, getCoinsVersion)
}
