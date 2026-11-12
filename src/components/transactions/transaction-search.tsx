'use client'

import { CircularProgress, IconButton, InputAdornment, TextField } from '@mui/material'
import { useState } from 'react'
import { Iconify } from 'src/components/iconify'
import type { NETWORK } from 'src/hooks/get-network-storage'
import { useTokenRegistry } from 'src/hooks/use-token-registry'
import type { SearchResponse } from 'src/pages/api/search'
import { endpoints, fetcher } from 'src/utils/axios'
import { cleanSearchQuery } from 'src/utils/search'
import { isShortHex, localSearchResults, needsLookup } from 'src/utils/search-results'

/** What the box can do to the transactions view */
export type SearchActions = {
    /** Show only transfers where this address is the sender or the recipient */
    filterAddress: (hexWithPrefix: string) => void
    /** Add a token chip (by ticker) */
    addToken: (ticker: string) => void
    /** Apply status / amount filters given as the query string of a transactions link */
    applyParams: (params: URLSearchParams) => void
    /** Open a transfer's detail page */
    openTx: (hash: string) => void
    /** Go to another page */
    go: (href: string) => void
}

/**
 * One box above the transactions table: paste a hash, an address (full or
 * partial), a token, a status or "over 100k", and the view applies it in place
 * (a transfer opens its page).
 */
export function TransactionSearch({
    network,
    actions,
}: {
    network: NETWORK
    actions: SearchActions
}) {
    useTokenRegistry()
    const [value, setValue] = useState('')
    const [busy, setBusy] = useState(false)
    const [note, setNote] = useState('')

    const submit = async (raw: string) => {
        const query = cleanSearchQuery(raw)
        if (!query) return
        setNote('')

        if (isShortHex(query)) {
            setNote('Type at least 6 characters to look up a partial hash or address')
            return
        }

        if (needsLookup(query)) {
            setBusy(true)
            try {
                const data: SearchResponse = await fetcher(
                    `${endpoints.search}?network=${network}&q=${encodeURIComponent(query)}`,
                )
                const txs = data.hits.filter(h => h.kind === 'tx')
                const addresses = data.hits.filter(h => h.kind !== 'tx')

                // A transfer by its hash opens directly; an address filters this table in place
                if (txs.length === 1 && addresses.length === 0) {
                    actions.openTx(txs[0].value)
                    return
                }
                if (addresses.length === 1) {
                    actions.filterAddress(addresses[0].value)
                    setValue('')
                    return
                }
                if (data.hits.length === 0) {
                    setNote(
                        `Nothing found. Partial values only search the last ${data.prefixWindowDays} days`,
                    )
                } else {
                    setNote(
                        `${data.hits.length} matches. Paste more of the hash or address, or use the search (⌘K) to pick one`,
                    )
                }
            } catch (error) {
                setNote(
                    (error as { code?: number })?.code === 429
                        ? 'Too many searches. Try again in a few seconds'
                        : 'Search is unavailable right now',
                )
            } finally {
                setBusy(false)
            }
            return
        }

        const [first] = localSearchResults(query, network)
        if (!first) {
            setNote('No match. Try a hash, an address, a token (ETH), a status, or "over 100k"')
            return
        }
        if (first.group === 'Tokens') {
            actions.addToken(first.label)
            setValue('')
        } else if (first.group === 'Filters') {
            actions.applyParams(new URLSearchParams(first.href.split('?')[1] || ''))
            setValue('')
        } else {
            actions.go(first.href)
        }
    }

    return (
        <TextField
            size="small"
            value={value}
            onChange={event => {
                setValue(event.target.value)
                if (note) setNote('')
            }}
            onKeyDown={event => {
                if (event.key === 'Enter') {
                    event.preventDefault()
                    submit(value)
                }
            }}
            onPaste={event => {
                // A pasted hash / address / link is a complete query: run it straight away
                const pasted = event.clipboardData.getData('text')
                if (pasted && needsLookup(pasted) && !isShortHex(pasted)) {
                    event.preventDefault()
                    setValue(pasted.trim())
                    submit(pasted)
                }
            }}
            placeholder="Find a transfer or address: paste a hash, address or link"
            error={!!note}
            helperText={note || undefined}
            inputProps={{ 'aria-label': 'Find a transfer or address' }}
            sx={{ width: { xs: '100%', md: 460 } }}
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        <Iconify
                            icon="eva:search-fill"
                            width={18}
                            sx={{ color: 'text.disabled' }}
                        />
                    </InputAdornment>
                ),
                endAdornment: (
                    <InputAdornment position="end">
                        {busy && <CircularProgress size={16} />}
                        {value && !busy && (
                            <IconButton
                                size="small"
                                aria-label="Clear"
                                onClick={() => {
                                    setValue('')
                                    setNote('')
                                }}
                            >
                                <Iconify icon="eva:close-fill" width={16} />
                            </IconButton>
                        )}
                    </InputAdornment>
                ),
            }}
        />
    )
}
