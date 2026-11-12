'use client'

import {
    Box,
    Breadcrumbs,
    Button,
    Card,
    Chip,
    Link as MuiLink,
    MenuItem,
    Select,
    Stack,
    Typography,
} from '@mui/material'
import Link from 'next/link'
import useSWR from 'swr'
import { CopyButton } from 'src/components/copy-button'
import { Iconify } from 'src/components/iconify'
import { PageTitle } from 'src/components/page-title'
import {
    TokenOverview,
    TokenVolumeChart,
    TokenTopHolders,
    TokenSizeHistogram,
} from 'src/components/token'
import { TransactionsTable } from 'src/components/transactions/transactions-table'
import { formatExplorerUrl, truncateAddress } from 'src/config/helper'
import { DashboardContent } from 'src/layouts/dashboard'
import { getNetwork } from 'src/hooks/get-network-storage'
import { useGlobalContext } from 'src/provider/global-provider'
import { useRouter } from 'src/routes/hooks'
import { paths } from 'src/routes/paths'
import { NotFoundView } from 'src/sections/error'
import { endpoints, fetcher } from 'src/utils/axios'
import { useTokenRegistry } from 'src/hooks/use-token-registry'
import { getTokenMeta, getTokenMetaList } from 'src/utils/token-meta'
import type { TokenOverviewResponse } from 'src/pages/api/token/[id]/overview'

interface PageProps {
    params: { id: string }
}

const fPrice = (n: number) =>
    n >= 1
        ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        : `$${n.toLocaleString(undefined, { maximumSignificantDigits: 3 })}`

export default function TokenDetailPage({ params: { id } }: PageProps) {
    const network = getNetwork()
    const router = useRouter()
    const { timePeriod } = useGlobalContext()

    // Pick up tokens listed after the bundled config was built
    useTokenRegistry()

    const numericId = Number(id)
    const meta = getTokenMeta(network, numericId)

    const url = Number.isFinite(numericId)
        ? `${endpoints.token.overview(numericId)}?network=${network}&period=${encodeURIComponent(
              timePeriod,
          )}`
        : null

    const { data, isLoading } = useSWR<TokenOverviewResponse>(url, fetcher, {
        revalidateOnFocus: false,
    })

    if (!Number.isFinite(numericId) || !meta) {
        return <NotFoundView />
    }

    // Token switcher options (the current token is always selectable)
    const tokens = getTokenMetaList(network)
    const options = tokens.some(t => t.id === meta.id) ? tokens : [meta, ...tokens]
    const transfersHref = `${paths.transactions.root}?tokens=${encodeURIComponent(meta.ticker)}`
    const contracts = data?.contracts

    return (
        <DashboardContent maxWidth="xl">
            <PageTitle title={`${meta.ticker} · Token`} />

            <Breadcrumbs sx={{ mb: 1.5 }}>
                <MuiLink
                    component={Link}
                    href={paths.tokens.root}
                    underline="hover"
                    color="text.secondary"
                >
                    Tokens
                </MuiLink>
                <Typography color="text.primary">{meta.ticker}</Typography>
            </Breadcrumbs>

            {/* Header */}
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
                sx={{ mb: 3 }}
            >
                <Stack direction="row" spacing={2} alignItems="center">
                    <Box
                        sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: meta.color,
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 20,
                            overflow: 'hidden',
                            flexShrink: 0,
                        }}
                    >
                        {meta.icon ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={meta.icon}
                                alt={meta.ticker}
                                width={36}
                                height={36}
                                style={{ objectFit: 'contain' }}
                            />
                        ) : (
                            meta.ticker.slice(0, 2).toUpperCase()
                        )}
                    </Box>
                    <Box>
                        <Stack
                            direction="row"
                            spacing={1.5}
                            alignItems="center"
                            flexWrap="wrap"
                            useFlexGap
                        >
                            <Typography variant="h4" sx={{ lineHeight: 1.1 }}>
                                {meta.ticker}
                            </Typography>
                            {data && data.price_usd > 0 && (
                                <Chip
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    label={fPrice(data.price_usd)}
                                />
                            )}
                            <Chip size="small" variant="outlined" label={timePeriod} />
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                            {meta.name} · Token #{meta.id} · {meta.decimals.toFixed(0)} decimals
                        </Typography>
                    </Box>
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                    <Select
                        size="small"
                        value={meta.id}
                        onChange={e => router.push(paths.tokens.details(Number(e.target.value)))}
                        inputProps={{ 'aria-label': 'switch token' }}
                        sx={{ minWidth: 130 }}
                    >
                        {options.map(t => (
                            <MenuItem key={t.id} value={t.id}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    {t.icon && (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={t.icon} alt="" width={18} height={18} />
                                    )}
                                    <span>{t.ticker}</span>
                                </Stack>
                            </MenuItem>
                        ))}
                    </Select>
                    <Button
                        variant="outlined"
                        component={Link}
                        href={transfersHref}
                        endIcon={<Iconify icon="solar:arrow-right-up-outline" width={16} />}
                    >
                        View all transfers
                    </Button>
                </Stack>
            </Stack>

            {/* Contracts, when the bridge's listing record carries them */}
            {contracts && (contracts.eth || contracts.sui) && (
                <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap sx={{ mb: 3 }}>
                    {contracts.eth && (
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <Typography variant="caption" color="text.secondary">
                                Ethereum contract
                            </Typography>
                            <MuiLink
                                href={formatExplorerUrl({
                                    network,
                                    address: contracts.eth,
                                    isAccount: true,
                                    chain: 'ETH',
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                underline="hover"
                                sx={{ fontFamily: 'monospace', fontSize: 13 }}
                            >
                                {truncateAddress(contracts.eth, 6)}
                            </MuiLink>
                            <CopyButton
                                value={contracts.eth}
                                title="Copy Ethereum contract address"
                                size={14}
                            />
                        </Stack>
                    )}
                    {contracts.sui && (
                        <Stack direction="row" spacing={0.75} alignItems="center">
                            <Typography variant="caption" color="text.secondary">
                                Sui coin type
                            </Typography>
                            <MuiLink
                                href={formatExplorerUrl({
                                    network,
                                    address: `0x${contracts.sui.split('::')[0]}`,
                                    isAccount: false,
                                    chain: 'SUI',
                                }).replace('/tx/', '/object/')}
                                target="_blank"
                                rel="noopener noreferrer"
                                underline="hover"
                                sx={{ fontFamily: 'monospace', fontSize: 13 }}
                            >
                                {`0x${contracts.sui.split('::')[0].slice(0, 6)}…::${contracts.sui
                                    .split('::')
                                    .slice(1)
                                    .join('::')}`}
                            </MuiLink>
                            <CopyButton
                                value={`0x${contracts.sui}`}
                                title="Copy Sui coin type"
                                size={14}
                            />
                        </Stack>
                    )}
                </Stack>
            )}

            {/* Stat tiles */}
            <TokenOverview data={data} isLoading={isLoading} />

            {/* Inflow / outflow chart */}
            <TokenVolumeChart tokenId={numericId} tokenColor={meta.color} />

            {/* Holders & size distribution side-by-side on desktop */}
            <TokenTopHolders tokenId={numericId} />
            <TokenSizeHistogram tokenId={numericId} tokenColor={meta.color} />

            {/* The most recent transfers of this token, same table as the Transactions page */}
            <TransactionsTable
                fixedTokens={[meta.ticker]}
                limit={10}
                hidePagination
                showTitleLink
                title={`Latest ${meta.ticker} transfers`}
                viewAllHref={transfersHref}
                minHeight={400}
            />

            {!isLoading && data && data.totals.total_tx_count === 0 && (
                <Card sx={{ mt: 3, p: 4, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                        No bridge activity for {meta.ticker} in the selected period.
                    </Typography>
                </Card>
            )}
        </DashboardContent>
    )
}
