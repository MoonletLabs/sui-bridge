import useSWR from 'swr'
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

// SWR dedupes by URL, so the shell and the page can both call these without extra requests
const swrOptions = { revalidateOnFocus: false, dedupingInterval: 30000 }

const useHashi = <T>(endpoint: string) => {
    const network = getNetwork()
    const swr = useSWR<T>(`${endpoint}?network=${network}`, fetcher, swrOptions)
    return { ...swr, network }
}

export const useHashiOverview = () => useHashi<HashiOverview>(endpoints.hashi.overview)
export const useHashiActivity = () => useHashi<HashiActivityResponse>(endpoints.hashi.activity)
export const useHashiCommittee = () => useHashi<HashiCommitteeResponse>(endpoints.hashi.committee)
export const useHashiGovernance = () => useHashi<HashiGovernance>(endpoints.hashi.governance)
export const useHashiOperations = () => useHashi<HashiOperations>(endpoints.hashi.operations)
export const useHashiHealth = () => useHashi<HashiHealth>(endpoints.hashi.health)
