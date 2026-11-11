'use client'

import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Grid,
    LinearProgress,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material'
import Link from 'next/link'
import { useMemo } from 'react'
import useSWR from 'swr'
import { Iconify } from 'src/components/iconify'
import { PageTitle } from 'src/components/page-title'
import { Sparkline } from 'src/components/token/sparkline'
import { DashboardContent } from 'src/layouts/dashboard'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useQueryParamState } from 'src/hooks/use-query-param-state'
import { useGlobalContext } from 'src/provider/global-provider'
import { useRouter } from 'src/routes/hooks'
import { paths } from 'src/routes/paths'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { fUsdCompact, pctChange } from 'src/utils/format-usd'
import { useTokenRegistry } from 'src/hooks/use-token-registry'
import { getTokenMetaList, TokenMeta } from 'src/utils/token-meta'
import type { TokenSummaryResponse, TokenSummaryRow } from 'src/pages/api/token/summary'

type SortKey = 'volume' | 'change' | 'transfers' | 'net' | 'senders'
type View = 'cards' | 'table'

type EnrichedRow = TokenSummaryRow & {
    meta: TokenMeta
    net_usd: number
    change: number | null
    /** Share of the volume of all listed tokens, 0-100 */
    share: number
}

const SORTERS: Record<SortKey, (r: EnrichedRow) => number> = {
    volume: r => r.total_volume_usd,
    // Tokens with nothing to compare to sort last
    change: r => r.change ?? Number.NEGATIVE_INFINITY,
    transfers: r => r.total_tx_count,
    net: r => r.net_usd,
    senders: r => r.unique_senders,
}

/** "▲ 62.8%" in green/red, or "New" when there was no activity in the previous period */
function ChangeBadge({ change, hasVolume }: { change: number | null; hasVolume: boolean }) {
    if (change === null) {
        return hasVolume ? (
            <Chip size="small" color="info" variant="outlined" label="New" sx={{ height: 22 }} />
        ) : null
    }
    const up = change > 0
    const flat = Math.abs(change) < 0.05
    const color = flat ? 'text.disabled' : up ? 'success.main' : 'error.main'
    return (
        <Tooltip title="Volume compared with the previous period of the same length">
            <Stack direction="row" alignItems="center" spacing={0.25} sx={{ color }}>
                <Iconify
                    icon={
                        flat
                            ? 'eva:minus-fill'
                            : up
                              ? 'eva:trending-up-fill'
                              : 'eva:trending-down-fill'
                    }
                    width={16}
                />
                <Typography variant="caption" fontWeight={700}>
                    {Math.abs(change).toFixed(1)}%
                </Typography>
            </Stack>
        </Tooltip>
    )
}

function TokenIcon({ meta, size }: { meta: TokenMeta; size: number }) {
    return (
        <Box
            sx={{
                width: size,
                height: size,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: meta.color,
                color: '#fff',
                fontWeight: 700,
                overflow: 'hidden',
                flexShrink: 0,
            }}
        >
            {meta.icon ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src={meta.icon}
                    alt={meta.ticker}
                    width={size * 0.66}
                    height={size * 0.66}
                    style={{ objectFit: 'contain' }}
                />
            ) : (
                meta.ticker.slice(0, 2).toUpperCase()
            )}
        </Box>
    )
}

/** Where the "View transfers" shortcut goes: the Transactions page, already filtered to the token */
const transfersHref = (ticker: string) =>
    `${paths.transactions.root}?tokens=${encodeURIComponent(ticker)}`

function TokenCard({ row, buckets }: { row: EnrichedRow; buckets: number[] }) {
    const inactive = row.total_tx_count === 0
    // Same colour logic as the change badge, so the line and the number agree
    const trendColor = row.change === null ? '#4DA2FF' : row.change >= 0 ? '#22C55E' : '#EF4444'

    return (
        <Card
            sx={{
                height: '100%',
                opacity: inactive ? 0.65 : 1,
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Box
                component={Link}
                href={paths.tokens.details(row.token_id)}
                sx={{
                    display: 'block',
                    color: 'inherit',
                    textDecoration: 'none',
                    flex: 1,
                    '&:hover': { bgcolor: 'action.hover' },
                }}
            >
                <CardContent sx={{ p: 2.5, pb: 1.5 }}>
                    {/* Header: icon + ticker + name, change on the right */}
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                        <TokenIcon meta={row.meta} size={48} />
                        <Stack spacing={0} sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
                                {row.meta.ticker}
                            </Typography>
                            <Tooltip title={row.meta.name}>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                    {row.meta.name}
                                </Typography>
                            </Tooltip>
                        </Stack>
                        {inactive ? (
                            <Chip size="small" variant="outlined" label="No activity" />
                        ) : (
                            <ChangeBadge change={row.change} hasVolume={row.total_volume_usd > 0} />
                        )}
                    </Stack>

                    {/* Volume + trend */}
                    <Stack direction="row" alignItems="flex-end" justifyContent="space-between">
                        <Stack spacing={0.25}>
                            <Typography variant="caption" color="text.secondary">
                                Total Volume
                            </Typography>
                            <Typography variant="h5">
                                {fUsdCompact(row.total_volume_usd)}
                            </Typography>
                        </Stack>
                        {buckets.length > 1 && (
                            <Sparkline values={row.spark} color={trendColor} width={110} />
                        )}
                    </Stack>

                    {/* Share of all tokens' volume */}
                    <Tooltip title={`${row.share.toFixed(1)}% of the volume of all tokens`}>
                        <Box sx={{ mt: 1.5 }}>
                            <LinearProgress
                                variant="determinate"
                                value={Math.min(100, row.share)}
                                sx={{ height: 6, borderRadius: 3 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                                {row.share.toFixed(1)}% of total volume
                            </Typography>
                        </Box>
                    </Tooltip>

                    {/* Mini metrics row */}
                    <Box
                        sx={{
                            display: 'grid',
                            // Wraps to 2 x 2 when the card is narrow instead of overflowing
                            gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))',
                            gap: 1.5,
                            borderTop: 1,
                            borderColor: 'divider',
                            pt: 1.5,
                            mt: 1.5,
                        }}
                    >
                        <Tooltip title="Bridged into Sui (ETH → SUI)">
                            <Stack spacing={0.25} sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Inflow
                                </Typography>
                                <Typography variant="body2" fontWeight={600} color="success.main">
                                    {fUsdCompact(row.inflow_usd)}
                                </Typography>
                            </Stack>
                        </Tooltip>
                        <Tooltip title="Bridged out of Sui (SUI → ETH)">
                            <Stack spacing={0.25} sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Outflow
                                </Typography>
                                <Typography variant="body2" fontWeight={600} color="error.main">
                                    {fUsdCompact(row.outflow_usd)}
                                </Typography>
                            </Stack>
                        </Tooltip>
                        <Tooltip title="Inflow minus outflow: positive means more value came into Sui">
                            <Stack spacing={0.25} sx={{ flex: 1 }}>
                                <Typography variant="caption" color="text.secondary">
                                    Net
                                </Typography>
                                <Typography
                                    variant="body2"
                                    fontWeight={600}
                                    color={row.net_usd >= 0 ? 'success.main' : 'error.main'}
                                >
                                    {row.net_usd > 0 ? '+' : ''}
                                    {fUsdCompact(row.net_usd)}
                                </Typography>
                            </Stack>
                        </Tooltip>
                        <Stack spacing={0.25} sx={{ flex: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                                Transfers
                            </Typography>
                            <Typography variant="body2" fontWeight={600}>
                                {fNumber(row.total_tx_count) || '0'}
                            </Typography>
                        </Stack>
                    </Box>
                </CardContent>
            </Box>

            {/* Outside the main link so the two actions don't nest */}
            <Stack
                direction="row"
                justifyContent="space-between"
                sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider' }}
            >
                <Button
                    size="small"
                    component={Link}
                    href={paths.tokens.details(row.token_id)}
                    endIcon={<Iconify icon="eva:arrow-ios-forward-fill" width={16} />}
                >
                    Details
                </Button>
                <Button
                    size="small"
                    color="inherit"
                    component={Link}
                    href={transfersHref(row.meta.ticker)}
                    disabled={inactive}
                >
                    View transfers
                </Button>
            </Stack>
        </Card>
    )
}

type Column = { key: SortKey | null; label: string; align?: 'left' | 'right' }

const COLUMNS: Column[] = [
    { key: null, label: 'Token' },
    { key: 'volume', label: 'Volume', align: 'right' },
    { key: 'change', label: 'Change', align: 'right' },
    { key: null, label: 'Share', align: 'right' },
    { key: null, label: 'Inflow', align: 'right' },
    { key: null, label: 'Outflow', align: 'right' },
    { key: 'net', label: 'Net', align: 'right' },
    { key: 'transfers', label: 'Transfers', align: 'right' },
    { key: 'senders', label: 'Senders', align: 'right' },
    { key: null, label: 'Avg / Largest', align: 'right' },
]

function TokenTable({
    rows,
    sortKey,
    onSort,
}: {
    rows: EnrichedRow[]
    sortKey: SortKey
    onSort: (key: SortKey) => void
}) {
    const router = useRouter()

    return (
        <Card>
            <TableContainer>
                <Table size="small" sx={{ minWidth: 900 }}>
                    <TableHead>
                        <TableRow>
                            {COLUMNS.map(c => (
                                <TableCell key={c.label} align={c.align ?? 'left'}>
                                    {c.key ? (
                                        <TableSortLabel
                                            active={sortKey === c.key}
                                            direction="desc"
                                            onClick={() => onSort(c.key as SortKey)}
                                        >
                                            {c.label}
                                        </TableSortLabel>
                                    ) : (
                                        c.label
                                    )}
                                </TableCell>
                            ))}
                            <TableCell />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map(r => (
                            <TableRow
                                key={r.token_id}
                                hover
                                sx={{
                                    cursor: 'pointer',
                                    opacity: r.total_tx_count === 0 ? 0.6 : 1,
                                }}
                                onClick={e => {
                                    if ((e.target as HTMLElement).closest('a, button')) return
                                    router.push(paths.tokens.details(r.token_id))
                                }}
                            >
                                <TableCell>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <TokenIcon meta={r.meta} size={32} />
                                        <Box>
                                            <Typography
                                                variant="subtitle2"
                                                component={Link}
                                                href={paths.tokens.details(r.token_id)}
                                                color="inherit"
                                                sx={{ textDecoration: 'none', display: 'block' }}
                                            >
                                                {r.meta.ticker}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {r.meta.name}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="body2" fontWeight={700}>
                                        {fUsdCompact(r.total_volume_usd)}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right">
                                    <Stack alignItems="flex-end">
                                        <ChangeBadge
                                            change={r.change}
                                            hasVolume={r.total_volume_usd > 0}
                                        />
                                    </Stack>
                                </TableCell>
                                <TableCell align="right">{r.share.toFixed(1)}%</TableCell>
                                <TableCell align="right" sx={{ color: 'success.main' }}>
                                    {fUsdCompact(r.inflow_usd)}
                                </TableCell>
                                <TableCell align="right" sx={{ color: 'error.main' }}>
                                    {fUsdCompact(r.outflow_usd)}
                                </TableCell>
                                <TableCell
                                    align="right"
                                    sx={{ color: r.net_usd >= 0 ? 'success.main' : 'error.main' }}
                                >
                                    {r.net_usd > 0 ? '+' : ''}
                                    {fUsdCompact(r.net_usd)}
                                </TableCell>
                                <TableCell align="right">
                                    {fNumber(r.total_tx_count) || '0'}
                                </TableCell>
                                <TableCell align="right">
                                    {fNumber(r.unique_senders) || '0'}
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="body2">
                                        {fUsdCompact(r.avg_tx_usd)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        max {fUsdCompact(r.max_tx_usd)}
                                    </Typography>
                                </TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                                    <Button
                                        size="small"
                                        color="inherit"
                                        component={Link}
                                        href={transfersHref(r.meta.ticker)}
                                        disabled={r.total_tx_count === 0}
                                    >
                                        Transfers
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Card>
    )
}

export default function TokensIndexPage() {
    const network = getNetwork()
    const { timePeriod } = useGlobalContext()
    // Re-derive the list when a newly listed token is registered
    const registryVersion = useTokenRegistry()

    const [sortKey, setSortKey] = useQueryParamState<SortKey>('tsort', {
        defaultValue: 'volume',
        deserialize: raw =>
            raw === 'change' || raw === 'transfers' || raw === 'net' || raw === 'senders'
                ? raw
                : null,
    })
    const [view, setView] = useQueryParamState<View>('tview', {
        defaultValue: 'cards',
        deserialize: raw => (raw === 'table' ? raw : null),
    })

    // Memoize tokens by network so it doesn't generate a new array reference each render
    const tokens = useMemo(() => getTokenMetaList(network), [network, registryVersion])

    const url = `${endpoints.token.summary}?network=${network}&period=${encodeURIComponent(
        timePeriod,
    )}`
    const { data, isLoading, error } = useSWR<TokenSummaryResponse>(url, fetcher, {
        revalidateOnFocus: false,
        // Avoid endless retries if the backend hangs / errors
        shouldRetryOnError: false,
        keepPreviousData: false,
    })

    const { rows, totals } = useMemo(() => {
        if (!data) return { rows: [] as EnrichedRow[], totals: null }

        const apiByToken = Object.fromEntries(data.rows.map(r => [r.token_id, r]))
        const empty = (id: number): TokenSummaryRow => ({
            spark: [],
            token_id: id,
            inflow_usd: 0,
            outflow_usd: 0,
            inflow_count: 0,
            outflow_count: 0,
            total_volume_usd: 0,
            total_tx_count: 0,
            unique_senders: 0,
            avg_tx_usd: 0,
            max_tx_usd: 0,
            prev_total_volume_usd: 0,
        })

        const base = tokens.map(meta => ({ meta, row: apiByToken[meta.id] ?? empty(meta.id) }))
        const totalVolume = base.reduce((s, b) => s + b.row.total_volume_usd, 0)
        const prevVolume = base.reduce((s, b) => s + b.row.prev_total_volume_usd, 0)
        const net = base.reduce((s, b) => s + (b.row.inflow_usd - b.row.outflow_usd), 0)

        const enriched: EnrichedRow[] = base.map(({ meta, row }) => ({
            ...row,
            meta,
            net_usd: row.inflow_usd - row.outflow_usd,
            change: pctChange(row.total_volume_usd, row.prev_total_volume_usd),
            share: totalVolume > 0 ? (row.total_volume_usd / totalVolume) * 100 : 0,
        }))

        return {
            rows: enriched,
            totals: {
                volume: totalVolume,
                change: pctChange(totalVolume, prevVolume),
                net,
                transfers: base.reduce((s, b) => s + b.row.total_tx_count, 0),
                active: base.filter(b => b.row.total_tx_count > 0).length,
            },
        }
    }, [data, tokens])

    const sortedRows = useMemo(() => {
        const get = SORTERS[sortKey]
        // Ties (e.g. several tokens with no activity) keep volume order
        return [...rows].sort((a, b) => {
            const ga = get(a)
            const gb = get(b)
            // -Infinity - -Infinity is NaN, so compare explicitly
            if (ga !== gb) return ga > gb ? -1 : 1
            return b.total_volume_usd - a.total_volume_usd
        })
    }, [rows, sortKey])

    const showSkeletons = !error && (isLoading || !data)

    return (
        <DashboardContent maxWidth="xl">
            <PageTitle title="Tokens" />
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <Iconify
                        icon="solar:wallet-bold-duotone"
                        width={28}
                        sx={{ color: 'primary.main' }}
                    />
                    <Typography variant="h4">Tokens</Typography>
                    <Chip size="small" variant="outlined" label={timePeriod} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                    Compare tokens at a glance, then drill into one for inflow/outflow, top senders
                    and transfer-size distribution.
                </Typography>
            </Box>

            {/* Summary + controls */}
            {totals && (
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    sx={{ mb: 2 }}
                >
                    <Typography variant="body2" color="text.secondary">
                        <b>{totals.active}</b> of {rows.length} tokens active ·{' '}
                        <b>{fUsdCompact(totals.volume)}</b> volume
                        {totals.change !== null && (
                            <>
                                {' '}
                                (
                                <Box
                                    component="span"
                                    sx={{
                                        color: totals.change >= 0 ? 'success.main' : 'error.main',
                                    }}
                                >
                                    {totals.change >= 0 ? '▲' : '▼'}{' '}
                                    {Math.abs(totals.change).toFixed(1)}%
                                </Box>{' '}
                                vs previous period)
                            </>
                        )}{' '}
                        · net{' '}
                        <Box
                            component="span"
                            sx={{
                                color: totals.net >= 0 ? 'success.main' : 'error.main',
                                fontWeight: 700,
                            }}
                        >
                            {totals.net > 0 ? '+' : ''}
                            {fUsdCompact(totals.net)}
                        </Box>{' '}
                        {totals.net >= 0 ? 'into Sui' : 'out of Sui'} · {fNumber(totals.transfers)}{' '}
                        transfers
                    </Typography>

                    <Stack direction="row" spacing={1}>
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={sortKey}
                            onChange={(_, v: SortKey | null) => v && setSortKey(v)}
                            aria-label="sort tokens"
                        >
                            <ToggleButton value="volume">Volume</ToggleButton>
                            <ToggleButton value="change">Change</ToggleButton>
                            <ToggleButton value="transfers">Transfers</ToggleButton>
                        </ToggleButtonGroup>
                        <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={view}
                            onChange={(_, v: View | null) => v && setView(v)}
                            aria-label="view"
                        >
                            <ToggleButton value="cards" aria-label="card view">
                                <Iconify icon="solar:widget-bold" width={18} />
                            </ToggleButton>
                            <ToggleButton value="table" aria-label="table view">
                                <Iconify icon="solar:list-bold" width={18} />
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>
                </Stack>
            )}

            <Grid container spacing={2}>
                {showSkeletons &&
                    Array.from({ length: tokens.length || 8 }).map((_, i) => (
                        <Grid key={`s-${i}`} item xs={12} sm={6} md={3}>
                            <Card sx={{ p: 2.5 }}>
                                <Skeleton variant="rectangular" height={200} />
                            </Card>
                        </Grid>
                    ))}

                {!!error && (
                    <Grid item xs={12}>
                        <Card sx={{ p: 4, textAlign: 'center' }}>
                            <Typography variant="body2" color="error.main">
                                Failed to load tokens. Please try again.
                            </Typography>
                        </Card>
                    </Grid>
                )}

                {!showSkeletons && !error && rows.length === 0 && (
                    <Grid item xs={12}>
                        <Card sx={{ p: 4, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                No tokens configured for this network.
                            </Typography>
                        </Card>
                    </Grid>
                )}

                {!showSkeletons &&
                    !error &&
                    view === 'cards' &&
                    sortedRows.map(row => (
                        <Grid key={row.token_id} item xs={12} sm={6} md={3}>
                            <TokenCard row={row} buckets={data?.buckets ?? []} />
                        </Grid>
                    ))}

                {!showSkeletons && !error && view === 'table' && rows.length > 0 && (
                    <Grid item xs={12}>
                        <TokenTable rows={sortedRows} sortKey={sortKey} onSort={setSortKey} />
                    </Grid>
                )}
            </Grid>
        </DashboardContent>
    )
}
