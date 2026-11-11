import {
    Box,
    Button,
    Card,
    Chip,
    FormControl,
    IconButton,
    InputLabel,
    Link,
    MenuItem,
    Select,
    Stack,
    Switch,
    TableCell,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatExplorerUrl, truncateAddress } from 'src/config/helper'
import { getNetwork, NETWORK } from 'src/hooks/get-network-storage'
import { useRouter } from 'src/routes/hooks'
import { paths } from 'src/routes/paths'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { fDateTimeUtc } from 'src/utils/format-time'
import { buildProfileQuery } from 'src/utils/helper'
import { AllTxsResponse, getTokensList, TransactionType } from 'src/utils/types'
import useSWR from 'swr'
import { Iconify } from '../iconify'
import { CustomTable } from '../table/table'
import { InputAdornment } from '@mui/material'
import { MultiAddressAutocomplete } from './multi-address'
import { useDebounce } from 'use-debounce'
import CloseIcon from '@mui/icons-material/Close'
import { downloadCsv } from 'src/utils/csv'
import { readQueryParam, writeQueryParams } from 'src/hooks/use-query-param-state'
import { CopyButton } from '../copy-button'

// ----------------------------------------------------------------------

type Flow = 'all' | 'inflow' | 'outflow'
type TxStatus = 'all' | 'completed' | 'awaiting_claim' | 'pending_approval'
type AmountPreset = 'any' | 'low' | 'medium' | 'large' | 'custom'
type SortBy = 'date' | 'amount'
type SortOrder = 'asc' | 'desc'
type Density = 'comfortable' | 'compact'

type Filters = {
    flow: Flow
    senders: string[]
    recipients: string[]
    amountFrom: string
    amountTo: string
    tokens: string[]
    status: TxStatus
}

type RowStatus = Exclude<TxStatus, 'all'>
type TxRow = TransactionType & { status?: RowStatus }
type TxResponse = Omit<AllTxsResponse, 'transactions'> & {
    transactions: TxRow[]
    total_usd?: number
}

const EMPTY_FILTERS: Filters = {
    flow: 'all',
    senders: [],
    recipients: [],
    amountFrom: '',
    amountTo: '',
    tokens: [],
    status: 'all',
}

const STATUS_CONFIG: Record<
    RowStatus,
    { label: string; color: 'success' | 'info' | 'warning'; hint: string }
> = {
    completed: {
        label: 'Completed',
        color: 'success',
        hint: 'The funds arrived on the destination chain.',
    },
    awaiting_claim: {
        label: 'Awaiting claim',
        color: 'info',
        hint: 'Approved by the bridge committee, waiting to be claimed on the destination chain.',
    },
    pending_approval: {
        label: 'Awaiting approval',
        color: 'warning',
        hint: 'Waiting for the bridge committee to approve this transfer.',
    },
}

/** Same chain identity colours as the Health page, so a direction is never red/green */
const routeColor = (isInflow: boolean) => (isInflow ? '#16A34A' : '#627EEA')

const MAX_EXPORT = 5000
const LARGE_AMOUNT = '100000'

const filtersKey = (f: Filters) =>
    [
        f.flow,
        f.senders.join(','),
        f.recipients.join(','),
        f.amountFrom,
        f.amountTo,
        f.tokens.join(','),
        f.status,
    ].join('|')

const amountPresetOf = (f: Filters): AmountPreset => {
    if (!f.amountFrom && !f.amountTo) return 'any'
    if (!f.amountFrom && f.amountTo === '10000') return 'low'
    if (f.amountFrom === '10000' && f.amountTo === '100000') return 'medium'
    if (f.amountFrom === LARGE_AMOUNT && !f.amountTo) return 'large'
    return 'custom'
}

const fUsdCompact = (n: number) => {
    if (!Number.isFinite(n)) return '$0'
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
    return `$${n.toFixed(0)}`
}

// ----------------------------------------------------------------------

export function TransactionsTable({
    ethAddress,
    suiAddress,
    limit = 48,
    hidePagination = false,
    showTitleLink = false,
    minHeight = 800,
    autoRefreshIntervalMs = 30000,
    autoRefreshEnabledDefault = true,
    syncFiltersToUrl = false,
    fixedTokens,
    title = 'Latest Bridge Transactions',
    viewAllHref = paths.transactions.root,
}: {
    ethAddress?: string
    suiAddress?: string
    limit?: number
    hidePagination?: boolean
    showTitleLink?: boolean
    minHeight?: number
    autoRefreshIntervalMs?: number
    autoRefreshEnabledDefault?: boolean
    /** Mirror filters into the URL query string so the view is shareable */
    syncFiltersToUrl?: boolean
    /** Always restrict to these token tickers (e.g. on a token's own page) */
    fixedTokens?: string[]
    /** Heading of the table */
    title?: string
    /** Where the heading links to when `showTitleLink` is set */
    viewAllHref?: string
}) {
    const network = getNetwork()
    const router = useRouter()
    // The full Transactions page gets the richer toolbar (summary, quick filters,
    // sorting, density); the embedded tables on the dashboard/profile stay lean
    const fullPage = syncFiltersToUrl

    const [totalItems, setTotalItems] = useState(0)
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(autoRefreshEnabledDefault)
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
    const [exporting, setExporting] = useState(false)

    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
    const [sort, setSort] = useState<{ by: SortBy; order: SortOrder }>({
        by: 'date',
        order: 'desc',
    })
    const [density, setDensity] = useState<Density>('comfortable')
    const [page, setPage] = useState(0)
    const [showFilters, setShowFilters] = useState(false)
    const pageSize = limit

    const viewKey = (f: Filters, s: { by: SortBy; order: SortOrder }) =>
        `${filtersKey(f)}|${s.by}|${s.order}`

    // Hydrate filters/page from the URL after mount (shareable links).
    // `urlHydrated` is state (not a ref) so the write/reset effects below only
    // activate once the hydrated values have actually been committed —
    // otherwise they'd run with stale defaults and wipe the shared URL.
    const [urlHydrated, setUrlHydrated] = useState(!syncFiltersToUrl)
    const prevViewKey = useRef<string>(viewKey(filters, sort))
    useEffect(() => {
        if (!syncFiltersToUrl) {
            return
        }
        // Only accept finite, non-negative numbers for amounts — a malformed
        // shared link (?amountFrom=abc) would otherwise push NaN into the API
        const readAmountParam = (key: string): string => {
            const raw = readQueryParam(key)
            if (!raw) {
                return ''
            }
            const parsed = Number(raw)
            return Number.isFinite(parsed) && parsed >= 0 ? raw : ''
        }
        const flowParam = readQueryParam('flow')
        const statusParam = readQueryParam('status')
        const urlFilters: Filters = {
            flow: flowParam === 'inflow' || flowParam === 'outflow' ? (flowParam as Flow) : 'all',
            senders: (readQueryParam('senders') || '').split(',').filter(Boolean),
            recipients: (readQueryParam('recipients') || '').split(',').filter(Boolean),
            amountFrom: readAmountParam('amountFrom'),
            amountTo: readAmountParam('amountTo'),
            tokens: (readQueryParam('tokens') || '').split(',').filter(Boolean),
            status:
                statusParam === 'completed' ||
                statusParam === 'awaiting_claim' ||
                statusParam === 'pending_approval'
                    ? statusParam
                    : 'all',
        }
        const urlSort: { by: SortBy; order: SortOrder } = {
            by: readQueryParam('sort') === 'amount' ? 'amount' : 'date',
            order: readQueryParam('order') === 'asc' ? 'asc' : 'desc',
        }
        const rawPage = Number(readQueryParam('page'))
        const urlPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 0

        const hasUrlFilters = filtersKey(urlFilters) !== filtersKey(EMPTY_FILTERS)
        const hasUrlSort = urlSort.by !== 'date' || urlSort.order !== 'desc'

        if (hasUrlFilters || hasUrlSort) {
            prevViewKey.current = viewKey(urlFilters, urlSort)
            setFilters(urlFilters)
            setSort(urlSort)
            // Only the address / custom range fields live in the collapsible panel
            if (
                urlFilters.senders.length ||
                urlFilters.recipients.length ||
                amountPresetOf(urlFilters) === 'custom'
            ) {
                setShowFilters(true)
            }
        }
        if (urlPage > 0) {
            setPage(urlPage)
        }

        try {
            const stored = localStorage.getItem('txDensity')
            if (stored === 'compact' || stored === 'comfortable') setDensity(stored)
        } catch {
            // storage can be unavailable (private mode): keep the default
        }
        setUrlHydrated(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [syncFiltersToUrl])

    // Mirror filters/sort/page into the URL so the current view is shareable
    useEffect(() => {
        if (!syncFiltersToUrl || !urlHydrated) {
            return
        }
        writeQueryParams({
            flow: filters.flow === 'all' ? null : filters.flow,
            senders: filters.senders.length ? filters.senders.join(',') : null,
            recipients: filters.recipients.length ? filters.recipients.join(',') : null,
            amountFrom: filters.amountFrom || null,
            amountTo: filters.amountTo || null,
            tokens: filters.tokens.length ? filters.tokens.join(',') : null,
            status: filters.status === 'all' ? null : filters.status,
            sort: sort.by === 'date' ? null : sort.by,
            order: sort.order === 'desc' ? null : sort.order,
            page: page > 0 ? String(page) : null,
        })
    }, [syncFiltersToUrl, urlHydrated, filters, sort, page])

    // Reset page when the view actually changes (compare serialized values —
    // StrictMode-safe, and URL hydration doesn't count as a change)
    useEffect(() => {
        if (!urlHydrated) {
            return
        }
        const key = viewKey(filters, sort)
        if (prevViewKey.current === key) {
            return
        }
        prevViewKey.current = key
        setPage(0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [urlHydrated, filters, sort])

    const [debouncedFilters] = useDebounce(filters, 500)

    const buildQuery = useCallback(
        (extra?: Record<string, string>) =>
            new URLSearchParams({
                flow: debouncedFilters.flow,
                senders: debouncedFilters.senders.join(','),
                recipients: debouncedFilters.recipients.join(','),
                amount_from: debouncedFilters.amountFrom,
                amount_to: debouncedFilters.amountTo,
                tokens: (fixedTokens ?? debouncedFilters.tokens).join(','),
                status: debouncedFilters.status,
                sort: sort.by,
                order: sort.order,
                ...extra,
            }).toString(),
        [debouncedFilters, sort, fixedTokens],
    )

    const requestUrl = `${endpoints.transactions}?network=${network}&${buildQuery({
        offset: String(page * pageSize),
        limit: String(pageSize),
    })}&ethAddress=${ethAddress || ''}&suiAddress=${suiAddress || ''}`

    const { data, isLoading, mutate, isValidating } = useSWR<TxResponse>(requestUrl, fetcher)

    // What is on screen. A background refresh that brings new transfers to the
    // top of the live feed is held back behind a "N new" pill, so rows don't
    // jump under the cursor; any change the user makes applies immediately.
    const [shown, setShown] = useState<{ url: string; data: TxResponse } | null>(null)
    const [pendingNew, setPendingNew] = useState<{
        url: string
        data: TxResponse
        count: number
    } | null>(null)
    const liveFeed = fullPage && page === 0 && sort.by === 'date' && sort.order === 'desc'

    useEffect(() => {
        if (!data) {
            setPendingNew(null)
            return
        }
        if (shown && shown.url === requestUrl && liveFeed) {
            // New transfers are the rows above the first row we already show. A row
            // that disappeared (e.g. got approved under the "awaiting" filter) or
            // older rows entering at the bottom are not new: apply those at once.
            const known = new Set(shown.data.transactions.map(t => t.tx_hash))
            const firstKnown = data.transactions.findIndex(t => known.has(t.tx_hash))
            const count = firstKnown === -1 ? data.transactions.length : firstKnown
            if (shown.data.transactions.length > 0 && count > 0) {
                setPendingNew({ url: requestUrl, data, count })
                return
            }
        }
        setShown({ url: requestUrl, data })
        setPendingNew(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, requestUrl])

    // A pill that belongs to a previous filter/page/sort must never be shown or applied
    const pendingForView = pendingNew && pendingNew.url === requestUrl ? pendingNew : null

    const view = shown && shown.url === requestUrl ? shown.data : data

    // Auto refresh at the configured interval (toggleable)
    useEffect(() => {
        if (!autoRefreshEnabled) {
            return
        }

        const interval = setInterval(() => {
            mutate()
        }, autoRefreshIntervalMs)

        return () => clearInterval(interval)
    }, [autoRefreshEnabled, autoRefreshIntervalMs, mutate])

    useEffect(() => {
        if (view?.total !== undefined && totalItems !== view.total) {
            setTotalItems(view.total)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view?.total])

    useEffect(() => {
        if (!isValidating && data) {
            setLastUpdatedAt(new Date())
        }
    }, [isValidating, data])

    const onNavigateTx = (tx: string) => {
        router.push(`${paths.transactions.root}/${tx}`)
    }

    const handleFilterChange = <K extends keyof Filters>(key: K, value: Filters[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }))
    }

    const applyAmountPreset = (preset: Exclude<AmountPreset, 'custom'>) => {
        const ranges = {
            any: ['', ''],
            low: ['', '10000'],
            medium: ['10000', '100000'],
            large: [LARGE_AMOUNT, ''],
        } as const
        const [from, to] = ranges[preset]
        setFilters(prev => ({ ...prev, amountFrom: from, amountTo: to }))
    }

    const amountPreset = amountPresetOf(filters)

    const handleSort = (id: string) => {
        const by: SortBy = id === 'amount' ? 'amount' : 'date'
        setSort(prev =>
            prev.by === by
                ? { by, order: prev.order === 'desc' ? 'asc' : 'desc' }
                : { by, order: 'desc' },
        )
    }

    const handleDensity = (next: Density) => {
        setDensity(next)
        try {
            localStorage.setItem('txDensity', next)
        } catch {
            // ignore: the preference just won't persist
        }
    }

    // Exports every row matching the current filters (up to MAX_EXPORT), not just the visible page
    const handleExport = async () => {
        setExporting(true)
        try {
            const all = await fetcher(
                `${endpoints.transactions}?network=${network}&${buildQuery({
                    export: '1',
                    limit: String(MAX_EXPORT),
                })}&ethAddress=${ethAddress || ''}&suiAddress=${suiAddress || ''}`,
            )
            const rows = ((all?.transactions as TxRow[]) || []).map(tx => ({
                tx_hash: tx.tx_hash,
                status: tx.status,
                from_chain: tx.from_chain,
                destination_chain: tx.destination_chain,
                sender_address: tx.sender_address,
                recipient_address: tx.recipient_address,
                token: tx.token_info?.name,
                amount: tx.amount,
                amount_usd: tx.amount_usd,
                nonce: tx.nonce,
                timestamp: new Date(tx.timestamp_ms).toISOString(),
            }))
            downloadCsv('bridge-transactions', rows)
        } catch (error) {
            console.error('Failed to export transactions:', error)
        } finally {
            setExporting(false)
        }
    }

    const hasActiveFilters = filtersKey(filters) !== filtersKey(EMPTY_FILTERS)
    const rowHeight = density === 'compact' ? 52 : 85
    const rows = view?.transactions || []

    return (
        <Box>
            <CustomTable
                headLabel={[
                    { id: 'chain', label: 'Route', width: 120, sortable: false },
                    { id: 'status', label: 'Status', width: 150, sortable: false },
                    { id: 'sender', label: 'Sender', width: 175, sortable: false },
                    { id: 'recipient', label: 'Recipient', width: 175, sortable: false },
                    {
                        id: 'amount',
                        label: 'Amount',
                        width: 240,
                        sortable: fullPage ? true : false,
                    },
                    { id: 'tx', label: 'Tx', width: 160, sortable: false },
                    {
                        id: 'timestamp_ms',
                        label: 'Date',
                        width: 130,
                        sortable: fullPage ? true : false,
                    },
                    { id: 'view', label: '', align: 'center', width: 56, sortable: false },
                ]}
                sort={
                    fullPage
                        ? {
                              orderBy: sort.by === 'amount' ? 'amount' : 'timestamp_ms',
                              order: sort.order,
                              onSort: handleSort,
                          }
                        : undefined
                }
                tableData={rows}
                loading={isLoading && !view}
                handleExport={showTitleLink ? undefined : handleExport}
                exporting={exporting}
                headerActions={
                    fullPage ? (
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={density}
                            onChange={(_, v: Density | null) => v && handleDensity(v)}
                            aria-label="row density"
                            // Phones show cards, so row density doesn't apply there
                            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                        >
                            <ToggleButton value="comfortable" aria-label="comfortable rows">
                                <Tooltip title="Comfortable rows">
                                    <Iconify icon="solar:hamburger-menu-bold" width={18} />
                                </Tooltip>
                            </ToggleButton>
                            <ToggleButton value="compact" aria-label="compact rows">
                                <Tooltip title="Compact rows: see more transfers at once">
                                    <Iconify icon="solar:list-bold" width={18} />
                                </Tooltip>
                            </ToggleButton>
                        </ToggleButtonGroup>
                    ) : undefined
                }
                titleContent={
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        {showTitleLink ? (
                            <Link
                                href={viewAllHref}
                                rel="noopener noreferrer"
                                underline="hover"
                                color="inherit"
                                fontWeight="bold"
                                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                            >
                                <Typography variant="h6" fontWeight="bold" sx={{ mr: 1 }}>
                                    {title}
                                </Typography>
                                <Iconify icon="solar:arrow-right-up-outline" />
                            </Link>
                        ) : (
                            <Typography variant="h6" fontWeight="bold">
                                {title}
                            </Typography>
                        )}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                flexWrap: 'wrap',
                            }}
                        >
                            <Typography variant="caption" color="text.secondary">
                                Last updated:{' '}
                                {lastUpdatedAt
                                    ? formatDistanceToNow(lastUpdatedAt, { addSuffix: true })
                                    : '—'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Auto-refresh
                                </Typography>
                                <Switch
                                    size="small"
                                    checked={autoRefreshEnabled}
                                    onChange={event => setAutoRefreshEnabled(event.target.checked)}
                                />
                                <Typography variant="caption" color="text.secondary">
                                    {autoRefreshEnabled
                                        ? `Every ${Math.round(autoRefreshIntervalMs / 1000)}s`
                                        : 'Paused'}
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                }
                toolbar={
                    fullPage ? (
                        <TransactionsToolbar
                            network={network}
                            filters={filters}
                            setFilters={setFilters}
                            amountPreset={amountPreset}
                            applyAmountPreset={applyAmountPreset}
                            hasActiveFilters={hasActiveFilters}
                            total={view?.total}
                            totalUsd={view?.total_usd}
                            pendingNew={pendingForView?.count}
                            onShowNew={() => {
                                if (pendingForView) {
                                    setShown({ url: requestUrl, data: pendingForView.data })
                                    setPendingNew(null)
                                }
                            }}
                        />
                    ) : undefined
                }
                filters={
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 2,
                            padding: 2,
                            pt: 0,
                            alignItems: 'end',
                        }}
                    >
                        <FormControl size="medium" sx={{ minWidth: 140 }}>
                            <InputLabel id="flow-filter-label">Flow</InputLabel>
                            <Select
                                labelId="flow-filter-label"
                                label="Flow"
                                value={filters.flow}
                                onChange={e => handleFilterChange('flow', e.target.value as Flow)}
                            >
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="inflow">Inflow</MenuItem>
                                <MenuItem value="outflow">Outflow</MenuItem>
                            </Select>
                        </FormControl>
                        <MultiAddressAutocomplete
                            label="Sender Address"
                            values={filters.senders}
                            onChange={newSenders =>
                                setFilters(f => ({ ...f, senders: newSenders }))
                            }
                        />
                        <MultiAddressAutocomplete
                            label="Recipient Address"
                            values={filters.recipients}
                            onChange={newRecipients =>
                                setFilters(f => ({ ...f, recipients: newRecipients }))
                            }
                        />
                        <FormControl size="medium" sx={{ minWidth: 180 }}>
                            <InputLabel id="amount-preset-label">Amount range</InputLabel>
                            <Select
                                labelId="amount-preset-label"
                                label="Amount range"
                                value={amountPreset}
                                onChange={e =>
                                    applyAmountPreset(
                                        e.target.value as Exclude<AmountPreset, 'custom'>,
                                    )
                                }
                            >
                                <MenuItem value="any">Any</MenuItem>
                                <MenuItem value="low">Low (&lt; $10k)</MenuItem>
                                <MenuItem value="medium">Medium ($10k–$100k)</MenuItem>
                                <MenuItem value="large">Large (&gt; $100k)</MenuItem>
                                <MenuItem value="custom" sx={{ display: 'none' }}>
                                    Custom
                                </MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl component="fieldset" sx={{ minWidth: 240 }}>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <TextField
                                    label="Amount from"
                                    size="medium"
                                    type="number"
                                    value={filters.amountFrom}
                                    onChange={e => handleFilterChange('amountFrom', e.target.value)}
                                    placeholder="min"
                                    fullWidth
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">$</InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={() =>
                                                        handleFilterChange('amountFrom', '')
                                                    }
                                                    sx={{
                                                        visibility: filters.amountFrom
                                                            ? 'visible'
                                                            : 'hidden',
                                                    }}
                                                >
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                                <TextField
                                    label="Amount to"
                                    size="medium"
                                    type="number"
                                    value={filters.amountTo}
                                    onChange={e => handleFilterChange('amountTo', e.target.value)}
                                    placeholder="max"
                                    fullWidth
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">$</InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={() =>
                                                        handleFilterChange('amountTo', '')
                                                    }
                                                    sx={{
                                                        visibility: filters.amountTo
                                                            ? 'visible'
                                                            : 'hidden',
                                                    }}
                                                >
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Box>
                        </FormControl>
                    </Box>
                }
                rowHeight={rowHeight}
                minTableWidth={1200}
                minHeight={minHeight}
                setShowFilters={setShowFilters}
                showFilters={showFilters}
                RowComponent={props => (
                    <ActivitiesRow
                        {...props}
                        network={network}
                        onNavigateTx={onNavigateTx}
                        compact={density === 'compact'}
                    />
                )}
                MobileRowComponent={props => (
                    <TransactionCard {...props} network={network} onNavigateTx={onNavigateTx} />
                )}
                pagination={
                    !hidePagination
                        ? {
                              count: totalItems,
                              page,
                              rowsPerPage: pageSize,
                              onPageChange: newPage => setPage(newPage),
                          }
                        : undefined
                }
            />
        </Box>
    )
}

// ----------------------------------------------------------------------

/**
 * Always-visible controls above the table: how many transfers match, one-click
 * filters for the things people filter by most, and chips for the filters that
 * live in the collapsed panel so they are never applied invisibly.
 */
function TransactionsToolbar({
    network,
    filters,
    setFilters,
    amountPreset,
    applyAmountPreset,
    hasActiveFilters,
    total,
    totalUsd,
    pendingNew,
    onShowNew,
}: {
    network: NETWORK
    filters: Filters
    setFilters: React.Dispatch<React.SetStateAction<Filters>>
    amountPreset: AmountPreset
    applyAmountPreset: (p: Exclude<AmountPreset, 'custom'>) => void
    hasActiveFilters: boolean
    total?: number
    totalUsd?: number
    pendingNew?: number
    onShowNew: () => void
}) {
    const tokens = getTokensList(network)

    const toggleToken = (ticker: string) =>
        setFilters(f => ({
            ...f,
            tokens: f.tokens.includes(ticker)
                ? f.tokens.filter(t => t !== ticker)
                : [...f.tokens, ticker],
        }))

    // Filters that only exist in the collapsible panel get a chip here
    const panelChips: { key: string; label: string; onDelete: () => void }[] = []
    filters.senders.forEach(s =>
        panelChips.push({
            key: `s-${s}`,
            label: `Sender ${truncateAddress(s)}`,
            onDelete: () => setFilters(f => ({ ...f, senders: f.senders.filter(x => x !== s) })),
        }),
    )
    filters.recipients.forEach(r =>
        panelChips.push({
            key: `r-${r}`,
            label: `Recipient ${truncateAddress(r)}`,
            onDelete: () =>
                setFilters(f => ({ ...f, recipients: f.recipients.filter(x => x !== r) })),
        }),
    )
    if (amountPreset === 'custom') {
        const from = filters.amountFrom ? `$${fNumber(Number(filters.amountFrom))}` : ''
        const to = filters.amountTo ? `$${fNumber(Number(filters.amountTo))}` : ''
        panelChips.push({
            key: 'amount',
            label: `Amount ${from || '$0'} – ${to || '∞'}`,
            onDelete: () => setFilters(f => ({ ...f, amountFrom: '', amountTo: '' })),
        })
    }

    return (
        <Stack spacing={1.5} sx={{ px: 2, pb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="body2" color="text.secondary">
                    {total === undefined ? (
                        '—'
                    ) : (
                        <>
                            <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>
                                {total.toLocaleString()}
                            </Box>{' '}
                            {hasActiveFilters ? 'matching transfers' : 'transfers'}
                            {totalUsd !== undefined && (
                                <>
                                    {' · '}
                                    <Box
                                        component="span"
                                        sx={{ color: 'text.primary', fontWeight: 700 }}
                                    >
                                        {fUsdCompact(totalUsd)}
                                    </Box>{' '}
                                    volume (at current prices)
                                </>
                            )}
                        </>
                    )}
                </Typography>

                {!!pendingNew && (
                    <Button
                        size="small"
                        variant="contained"
                        onClick={onShowNew}
                        startIcon={<Iconify icon="eva:arrow-upward-fill" width={16} />}
                    >
                        {pendingNew} new {pendingNew === 1 ? 'transfer' : 'transfers'} · Show
                    </Button>
                )}

                {hasActiveFilters && (
                    <Button
                        size="small"
                        color="inherit"
                        onClick={() => setFilters(EMPTY_FILTERS)}
                        sx={{ ml: 'auto' }}
                    >
                        Clear all filters
                    </Button>
                )}
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    flexWrap: 'wrap',
                }}
            >
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={filters.flow}
                    onChange={(_, v: Flow | null) => v && setFilters(f => ({ ...f, flow: v }))}
                    aria-label="direction"
                >
                    <ToggleButton value="all">All</ToggleButton>
                    <ToggleButton value="inflow">ETH → SUI</ToggleButton>
                    <ToggleButton value="outflow">SUI → ETH</ToggleButton>
                </ToggleButtonGroup>

                <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={filters.status}
                    onChange={(_, v: TxStatus | null) =>
                        v && setFilters(f => ({ ...f, status: v }))
                    }
                    aria-label="status"
                >
                    <ToggleButton value="all">Any status</ToggleButton>
                    <ToggleButton value="completed">Completed</ToggleButton>
                    <ToggleButton value="awaiting_claim">Awaiting claim</ToggleButton>
                    <ToggleButton value="pending_approval">Awaiting approval</ToggleButton>
                </ToggleButtonGroup>

                <Chip
                    label="≥ $100k"
                    clickable
                    variant={amountPreset === 'large' ? 'filled' : 'outlined'}
                    color={amountPreset === 'large' ? 'primary' : 'default'}
                    onClick={() => applyAmountPreset(amountPreset === 'large' ? 'any' : 'large')}
                />

                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {tokens.map(t => {
                        const active = filters.tokens.includes(t.ticker)
                        return (
                            <Chip
                                key={t.ticker}
                                label={t.ticker}
                                clickable
                                variant={active ? 'filled' : 'outlined'}
                                color={active ? 'primary' : 'default'}
                                onClick={() => toggleToken(t.ticker)}
                                avatar={
                                    t.icon ? (
                                        <img
                                            src={t.icon}
                                            alt=""
                                            style={{ width: 18, height: 18 }}
                                        />
                                    ) : undefined
                                }
                            />
                        )
                    })}
                </Box>
            </Box>

            {panelChips.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {panelChips.map(c => (
                        <Chip
                            key={c.key}
                            size="small"
                            label={c.label}
                            onDelete={c.onDelete}
                            variant="outlined"
                        />
                    ))}
                </Box>
            )}
        </Stack>
    )
}

// ----------------------------------------------------------------------

const AMOUNT_TIERS = {
    low: { label: 'Low', color: 'success', bg: 'rgba(56, 177, 55, 0.08)' },
    medium: { label: 'Medium', color: 'info', bg: 'rgba(0, 184, 217, 0.08)' },
    large: { label: 'Large', color: 'warning', bg: 'rgba(250, 57, 19, 0.08)' },
} as const

const tierOf = (usd: number) =>
    AMOUNT_TIERS[usd < 10000 ? 'low' : usd <= 100000 ? 'medium' : 'large']

function RouteChip({ isInflow }: { isInflow: boolean }) {
    return (
        <Chip
            label={isInflow ? 'ETH → SUI' : 'SUI → ETH'}
            size="small"
            sx={{
                bgcolor: routeColor(isInflow),
                fontWeight: 700,
                fontSize: '0.7rem',
                // The dark theme forces grey[800] on filled default chips
                '& .MuiChip-label': { color: '#fff' },
            }}
        />
    )
}

function StatusChip({ status }: { status?: RowStatus }) {
    if (!status) return null
    const cfg = STATUS_CONFIG[status]
    return (
        <Tooltip title={cfg.hint}>
            <Chip label={cfg.label} size="small" color={cfg.color} variant="outlined" />
        </Tooltip>
    )
}

/** Open the row's transfer unless the click was on a link/button inside it */
const rowClick =
    (onNavigateTx: (tx: string) => void, txHash: string) => (event: React.MouseEvent) => {
        if ((event.target as HTMLElement).closest('a, button')) return
        onNavigateTx(txHash)
    }

function AddressCell({
    address,
    chain,
    network,
    label,
    compact,
}: {
    address: string
    chain: 'ETH' | 'SUI'
    network: NETWORK
    label: string
    compact?: boolean
}) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CopyButton value={address} title={`Copy ${label} address`} />
            <Link
                href={formatExplorerUrl({ network, address, isAccount: true, chain })}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                color="primary"
                fontWeight="bold"
                sx={{ fontFamily: 'monospace', fontSize: compact ? 13 : undefined }}
            >
                {truncateAddress(address)}
            </Link>
            <Tooltip title={`See this ${label}'s bridge history`}>
                <Link
                    color="inherit"
                    sx={{ ml: 0.5, display: 'inline-flex' }}
                    aria-label={`${label} bridge history`}
                    href={buildProfileQuery(
                        chain === 'SUI' ? { suiAddress: address } : { ethAddress: address },
                    )}
                >
                    <Iconify icon="solar:arrow-right-up-outline" />
                </Link>
            </Tooltip>
        </Box>
    )
}

const ActivitiesRow: React.FC<{
    row: TxRow
    network: NETWORK
    onNavigateTx: (tx: string) => void
    compact?: boolean
}> = ({ row, network, onNavigateTx, compact }) => {
    const relativeTime = formatDistanceToNow(Number(row.timestamp_ms), { addSuffix: true })
    const isInflow = row.destination_chain === 'SUI'
    const amountUsd = Number(row.amount_usd) || 0
    const tierConfig = tierOf(amountUsd)
    const tokenIcon = getTokensList(network)?.find(it => it.ticker === row.token_info.name)?.icon
    const detailHref = `${paths.transactions.root}/${row.tx_hash}`

    return (
        <TableRow
            hover
            onClick={rowClick(onNavigateTx, row.tx_hash)}
            sx={{
                height: compact ? 52 : 85,
                cursor: 'pointer',
                '& td': compact ? { py: 0.5 } : undefined,
            }}
        >
            <TableCell>
                <RouteChip isInflow={isInflow} />
            </TableCell>

            <TableCell>
                <StatusChip status={row.status} />
            </TableCell>

            <TableCell sx={{ paddingY: { xs: 0, sm: compact ? 0.5 : 2 } }}>
                <AddressCell
                    address={row.sender_address}
                    chain={row.from_chain}
                    network={network}
                    label="sender"
                    compact={compact}
                />
            </TableCell>

            <TableCell>
                <AddressCell
                    address={row.recipient_address}
                    chain={isInflow ? 'SUI' : 'ETH'}
                    network={network}
                    label="recipient"
                    compact={compact}
                />
            </TableCell>

            {/* Amount with token icon and ticker */}
            <TableCell>
                {compact ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        {tokenIcon && (
                            <img src={tokenIcon} alt="" style={{ width: 18, height: 18 }} />
                        )}
                        <Typography variant="subtitle2" fontWeight="bold">
                            {fNumber(row.amount)} {row.token_info.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            ≈ ${fNumber(row.amount_usd)}
                        </Typography>
                    </Box>
                ) : (
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'start',
                            padding: '4px 8px',
                            borderRadius: 1,
                            backgroundColor: tierConfig.bg,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {tokenIcon && (
                                <img
                                    src={tokenIcon}
                                    alt={row.token_info.name}
                                    style={{ width: 20, height: 20, marginRight: 6 }}
                                />
                            )}
                            <Typography variant="h6" fontWeight="bold">
                                {fNumber(row.amount)}
                            </Typography>
                            <Typography
                                variant="subtitle2"
                                color="text.secondary"
                                sx={{ ml: 0.75 }}
                            >
                                {row.token_info.name}
                            </Typography>
                            <Chip
                                label={tierConfig.label}
                                size="small"
                                color={tierConfig.color}
                                sx={{ ml: 1, height: 20 }}
                            />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                            ≈ ${fNumber(row.amount_usd)}
                        </Typography>
                    </Box>
                )}
            </TableCell>

            {/* Transaction Link */}
            <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CopyButton value={row.tx_hash} title="Copy transaction hash" />
                    <Link
                        href={formatExplorerUrl({
                            network,
                            address: row.tx_hash,
                            isAccount: false,
                            chain: row.from_chain,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        color="primary"
                        fontWeight="bold"
                        sx={{ fontFamily: 'monospace', fontSize: compact ? 13 : undefined }}
                    >
                        {truncateAddress(row.tx_hash)}
                    </Link>
                </Box>
            </TableCell>

            {/* Timestamp: relative in the cell, exact UTC on hover */}
            <TableCell>
                <Tooltip title={fDateTimeUtc(row.timestamp_ms) ?? ''}>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary">
                        {relativeTime}
                    </Typography>
                </Tooltip>
            </TableCell>

            <TableCell sx={{ textAlign: 'center', verticalAlign: 'middle' }}>
                <Tooltip title="View transfer details">
                    <Link
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        color="inherit"
                        href={detailHref}
                        aria-label="View transfer details"
                    >
                        <Iconify icon="eva:chevron-right-fill" width={22} />
                    </Link>
                </Tooltip>
            </TableCell>
        </TableRow>
    )
}

// ----------------------------------------------------------------------

/** Phone layout: one card per transfer instead of an 8-column table */
const TransactionCard: React.FC<{
    row: TxRow
    network: NETWORK
    onNavigateTx: (tx: string) => void
}> = ({ row, network, onNavigateTx }) => {
    const isInflow = row.destination_chain === 'SUI'
    const tokenIcon = getTokensList(network)?.find(it => it.ticker === row.token_info.name)?.icon

    return (
        <Card
            variant="outlined"
            onClick={rowClick(onNavigateTx, row.tx_hash)}
            sx={{ p: 1.5, cursor: 'pointer' }}
        >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <RouteChip isInflow={isInflow} />
                <StatusChip status={row.status} />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                    {formatDistanceToNow(Number(row.timestamp_ms), { addSuffix: true })}
                </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                {tokenIcon && <img src={tokenIcon} alt="" style={{ width: 22, height: 22 }} />}
                <Link
                    href={`${paths.transactions.root}/${row.tx_hash}`}
                    color="inherit"
                    underline="none"
                    aria-label={`View transfer details: ${fNumber(row.amount)} ${row.token_info.name}`}
                >
                    <Typography variant="h6" fontWeight="bold" component="span">
                        {fNumber(row.amount)} {row.token_info.name}
                    </Typography>
                </Link>
                <Typography variant="caption" color="text.secondary">
                    ≈ ${fNumber(row.amount_usd)}
                </Typography>
            </Stack>

            <Stack spacing={0.25}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ width: 20 }}>
                        From
                    </Typography>
                    <AddressCell
                        address={row.sender_address}
                        chain={row.from_chain}
                        network={network}
                        label="sender"
                        compact
                    />
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ width: 20 }}>
                        To
                    </Typography>
                    <AddressCell
                        address={row.recipient_address}
                        chain={isInflow ? 'SUI' : 'ETH'}
                        network={network}
                        label="recipient"
                        compact
                    />
                </Stack>
            </Stack>
        </Card>
    )
}
