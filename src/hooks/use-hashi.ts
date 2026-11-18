import useSWR from 'swr'
import type { HashiHistoryResponse } from 'src/pages/api/hashi/history'
import { getNetwork } from 'src/hooks/get-network-storage'
import type { HashiActivityResponse } from 'src/pages/api/hashi/activity'
import type { HashiCommitteeResponse } from 'src/pages/api/hashi/committee'
import { endpoints, fetcher } from 'src/utils/axios'
import type {
    HashiGovernance,
    HashiHealth,
    HashiOperations,
    HashiOverview,
} from 'src/utils/hashi-chain'

// SWR dedupes by URL, so the shell and the page can both call these without extra requests.
// An open page refreshes on the same cadence as the API cache (paused while the tab is
// hidden), so status indicators such as "Running" and the Health checks do not go stale.
const useHashi = <T>(endpoint: string, refreshSeconds: number) => {
    const network = getNetwork()
    const swr = useSWR<T>(`${endpoint}?network=${network}`, fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 30000,
        refreshInterval: refreshSeconds * 1000,
    })
    return { ...swr, network }
}

export const useHashiOverview = () => useHashi<HashiOverview>(endpoints.hashi.overview, 60)
export const useHashiActivity = () => useHashi<HashiActivityResponse>(endpoints.hashi.activity, 120)
export const useHashiCommittee = () =>
    useHashi<HashiCommitteeResponse>(endpoints.hashi.committee, 600)
export const useHashiGovernance = () => useHashi<HashiGovernance>(endpoints.hashi.governance, 120)
export const useHashiOperations = () => useHashi<HashiOperations>(endpoints.hashi.operations, 120)
export const useHashiHealth = () => useHashi<HashiHealth>(endpoints.hashi.health, 60)

/** Stored history (needs the Hashi analytics store). `available` is false without one. */
export const useHashiHistory = (days: number) => {
    const network = getNetwork()
    return useSWR<HashiHistoryResponse>(
        `${endpoints.hashi.history}?network=${network}&days=${days}`,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000, refreshInterval: 60_000 },
    )
}
