'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { useDebounce } from 'use-debounce'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useTokenRegistry } from 'src/hooks/use-token-registry'
import type { SearchResponse } from 'src/pages/api/search'
import { endpoints, fetcher } from 'src/utils/axios'
import { cleanSearchQuery } from 'src/utils/search'
import {
    exactGuesses,
    hitToResult,
    isShortHex,
    localSearchResults,
    needsLookup,
    type SearchResult,
} from 'src/utils/search-results'

export type SearchState = {
    results: SearchResult[]
    /** Waiting for the database lookup */
    loading: boolean
    /** The lookup ran and found nothing for a value that needed it */
    notFound: boolean
    /** A partial hash/address that is too short to look up */
    tooShort: boolean
    /** The lookup failed or was refused: results fall back to local guesses */
    lookupError: 'limit' | 'unavailable' | null
    prefixWindowDays: number
    minPrefixChars: number
}

const ORDER: SearchResult['group'][] = ['Transfers', 'Addresses', 'Filters', 'Tokens', 'Pages']

/**
 * Everything the search box can offer for `query`: instant local results (tokens,
 * pages, status / amount filters) plus, for hashes / addresses / numbers, what the
 * bridge data actually contains.
 */
export function useSearch(query: string, enabled = true): SearchState {
    const network = getNetwork()
    // Dynamically listed tokens become searchable once the registry is loaded
    const registryVersion = useTokenRegistry()

    const [debounced] = useDebounce(query, 300)
    const lookupNeeded = enabled && needsLookup(query)
    // Only hit the API once typing pauses, and only for the settled value
    const settled = lookupNeeded && debounced === query ? cleanSearchQuery(query) : null

    const { data, error, isLoading } = useSWR<SearchResponse>(
        settled ? `${endpoints.search}?network=${network}&q=${encodeURIComponent(settled)}` : null,
        fetcher,
        { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 30000 },
    )

    return useMemo(() => {
        const local = enabled ? localSearchResults(query, network) : []
        const waiting = lookupNeeded && !data && !error
        const lookupError: SearchState['lookupError'] = error
            ? (error as { code?: number })?.code === 429
                ? 'limit'
                : 'unavailable'
            : null

        const remote = data ? data.hits.map(hitToResult) : []
        // If the lookup is down, a complete address / hash can still be opened directly
        const fallback = lookupError === 'unavailable' ? exactGuesses(query) : []

        const results = [...remote, ...fallback, ...local].sort(
            (a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group),
        )

        return {
            results,
            loading: waiting || (lookupNeeded && (isLoading || debounced !== query)),
            notFound: lookupNeeded && !!data && !data.tooShort && remote.length === 0,
            tooShort: isShortHex(query),
            lookupError,
            prefixWindowDays: data?.prefixWindowDays ?? 30,
            minPrefixChars: data?.minPrefixChars ?? 6,
        }
    }, [query, debounced, enabled, network, registryVersion, lookupNeeded, data, error, isLoading])
}
