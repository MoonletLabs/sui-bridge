import {
    Box,
    Chip,
    FormControl,
    IconButton,
    InputLabel,
    Link,
    MenuItem,
    Select,
    Switch,
    TableCell,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useState } from 'react'
import { formatExplorerUrl, truncateAddress } from 'src/config/helper'
import { getNetwork, NETWORK } from 'src/hooks/get-network-storage'
import { useRouter } from 'src/routes/hooks'
import { paths } from 'src/routes/paths'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { buildProfileQuery } from 'src/utils/helper'
import { AllTxsResponse, getTokensList, TransactionType } from 'src/utils/types'
import useSWR from 'swr'
import { Iconify } from '../iconify'
import { CustomTable } from '../table/table'
import { InputAdornment } from '@mui/material'
import { MultiAddressAutocomplete } from './multi-address'
import { useDebounce } from 'use-debounce'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import { downloadCsv } from 'src/utils/csv'

export function TransactionsTable({
    ethAddress,
    suiAddress,
    limit = 48,
    hidePagination = false,
    showTitleLink = false,
    minHeight = 800,
    autoRefreshIntervalMs = 30000,
    autoRefreshEnabledDefault = true,
}: {
    ethAddress?: string
    suiAddress?: string
    limit?: number
    hidePagination?: boolean
    showTitleLink?: boolean
    minHeight?: number
    autoRefreshIntervalMs?: number
    autoRefreshEnabledDefault?: boolean
}) {
    const network = getNetwork()
    const router = useRouter()
    const [page, setPage] = useState(0)
    const [totalItems, setTotalItems] = useState(0)
    const [showFilters, setShowFilters] = useState(false)
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(autoRefreshEnabledDefault)
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
    const [filters, setFilters] = useState<{
        flow: 'all' | 'inflow' | 'outflow'
        senders: string[]
        recipients: string[]
        amountFrom: string
        amountTo: string
    }>({
        flow: 'all',
        senders: [],
        recipients: [],
        amountFrom: '',
        amountTo: '',
    })
    const [amountPreset, setAmountPreset] = useState<'any' | 'low' | 'medium' | 'large'>('any')
    const pageSize = limit

    const [debouncedFilters] = useDebounce(filters, 500)
    // Fetch paginated data
    const debouncedQuery = new URLSearchParams({
        offset: String(page * pageSize),
        limit: String(pageSize),
        flow: debouncedFilters.flow,
        senders: debouncedFilters.senders.join(','),
        recipients: debouncedFilters.recipients.join(','),
        amount_from: debouncedFilters.amountFrom,
        amount_to: debouncedFilters.amountTo,
    }).toString()

    const { data, isLoading, mutate, isValidating } = useSWR<AllTxsResponse>(
        `${endpoints.transactions}?network=${network}&${debouncedQuery}&ethAddress=${ethAddress || ''}&suiAddress=${suiAddress || ''}`,
        fetcher,
    )

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
        if (data?.total && totalItems !== data?.total) {
            setTotalItems(data?.total)
        }
    }, [data?.total])

    useEffect(() => {
        if (!isValidating && data) {
            setLastUpdatedAt(new Date())
        }
    }, [isValidating, data])

    const onNavigateTx = (tx: string) => {
        router.push(`${paths.transactions.root}/${tx}`)
    }

    const handleFilterChange = <K extends keyof typeof filters>(
        key: K,
        value: (typeof filters)[K],
    ) => {
        setFilters(prev => ({ ...prev, [key]: value }))
    }

    const applyAmountPreset = (preset: 'any' | 'low' | 'medium' | 'large') => {
        setAmountPreset(preset)
        if (preset === 'any') {
            setFilters(prev => ({ ...prev, amountFrom: '', amountTo: '' }))
            return
        }
        if (preset === 'low') {
            setFilters(prev => ({ ...prev, amountFrom: '', amountTo: '10000' }))
            return
        }
        if (preset === 'medium') {
            setFilters(prev => ({ ...prev, amountFrom: '10000', amountTo: '100000' }))
            return
        }
        setFilters(prev => ({ ...prev, amountFrom: '100000', amountTo: '' }))
    }

    const handleExport = () => {
        const rows = (data?.transactions || []).map(tx => ({
            tx_hash: tx.tx_hash,
            from_chain: tx.from_chain,
            destination_chain: tx.destination_chain,
            sender_address: tx.sender_address,
            recipient_address: tx.recipient_address,
            token: tx.token_info?.name,
            amount: tx.amount,
            amount_usd: tx.amount_usd,
            timestamp_ms: tx.timestamp_ms,
        }))
        downloadCsv('latest-bridge-transactions', rows)
    }

    return (
        <Box>
            <CustomTable
                headLabel={[
                    { id: 'chain', label: 'Flow', minWidth: 100 },
                    { id: 'sender', label: 'Sender', minWidth: 150 },
                    { id: 'recipient', label: 'Recipient', minWidth: 150 },
                    { id: 'amount', label: 'Amount', minWidth: 150 },
                    { id: 'tx', label: 'Tx', minWidth: 150 },
                    { id: 'timestamp_ms', label: 'Date', minWidth: 100 },
                    { id: 'view', label: 'More details', align: 'center', minWidth: 120 },
                ]}
                tableData={data?.transactions || []}
                loading={isLoading}
                handleExport={showTitleLink ? undefined : handleExport}
                titleContent={
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        {showTitleLink ? (
                            <Link
                                href={paths.transactions.root}
                                rel="noopener noreferrer"
                                underline="hover"
                                color="inherit"
                                fontWeight="bold"
                                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                            >
                                <Typography variant="h6" fontWeight="bold" sx={{ mr: 1 }}>
                                    Latest Bridge Transactions
                                </Typography>
                                <Iconify icon="solar:arrow-right-up-outline" />
                            </Link>
                        ) : (
                            <Typography variant="h6" fontWeight="bold">
                                Latest Bridge Transactions
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
                                onChange={e =>
                                    handleFilterChange(
                                        'flow',
                                        e.target.value as 'all' | 'inflow' | 'outflow',
                                    )
                                }
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
                                        e.target.value as 'any' | 'low' | 'medium' | 'large',
                                    )
                                }
                            >
                                <MenuItem value="any">Any</MenuItem>
                                <MenuItem value="low">Low (&lt; $10k)</MenuItem>
                                <MenuItem value="medium">Medium ($10k–$100k)</MenuItem>
                                <MenuItem value="large">Large (&gt; $100k)</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl component="fieldset" sx={{ minWidth: 240 }}>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <TextField
                                    label="Amount from"
                                    size="medium"
                                    type="number"
                                    value={filters.amountFrom}
                                    onChange={e => {
                                        setAmountPreset('any')
                                        handleFilterChange('amountFrom', e.target.value)
                                    }}
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
                                    onChange={e => {
                                        setAmountPreset('any')
                                        handleFilterChange('amountTo', e.target.value)
                                    }}
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
                rowHeight={85}
                minHeight={minHeight}
                setShowFilters={setShowFilters}
                showFilters={showFilters}
                RowComponent={props => (
                    <ActivitiesRow {...props} network={network} onNavigateTx={onNavigateTx} />
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

const ActivitiesRow: React.FC<{
    row: TransactionType
    network: NETWORK
    onNavigateTx: (tx: string) => void
}> = ({ row, network, onNavigateTx }) => {
    const relativeTime = formatDistanceToNow(Number(row.timestamp_ms), { addSuffix: true })
    const isInflow = row.destination_chain === 'SUI'
    const amountUsd = Number(row.amount_usd) || 0
    const amountTier = amountUsd < 10000 ? 'low' : amountUsd <= 100000 ? 'medium' : 'large'
    const amountTierConfig: Record<
        typeof amountTier,
        { label: string; color: 'success' | 'info' | 'warning'; bg: string }
    > = {
        low: { label: 'Low', color: 'success', bg: 'rgba(56, 177, 55, 0.08)' },
        medium: { label: 'Medium', color: 'info', bg: 'rgba(0, 184, 217, 0.08)' },
        large: { label: 'Large', color: 'warning', bg: 'rgba(250, 57, 19, 0.08)' },
    }
    const tierConfig = amountTierConfig[amountTier]

    return (
        <TableRow
            hover
            sx={{
                height: 85,
                borderRadius: 2,
                transition: 'all 0.3s ease-in-out',
                '&:hover': {
                    transform: 'scale(1.01)',
                },
            }}
        >
            {/* Flow Column with Icons & Stylish Arrow */}
            <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <img
                        src={`/assets/icons/brands/eth.svg`}
                        alt={row.from_chain}
                        style={{ width: 24, height: 24 }}
                    />

                    <Iconify
                        width={20}
                        icon={
                            isInflow
                                ? 'solar:round-arrow-right-bold-duotone'
                                : 'solar:round-arrow-left-bold-duotone'
                        }
                        sx={{ flexShrink: 0, color: isInflow ? '#38B137' : '#FA3913' }}
                    />

                    <img
                        src={`/assets/icons/brands/sui.svg`}
                        alt={row.destination_chain}
                        style={{ width: 24, height: 24 }}
                    />
                </Box>
            </TableCell>

            {/* Sender with Improved Visibility */}
            <TableCell sx={{ paddingY: { xs: 0, sm: 2 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Tooltip title="Copy sender address">
                        <IconButton
                            size="small"
                            onClick={() => navigator.clipboard.writeText(row.sender_address)}
                        >
                            <ContentCopyOutlinedIcon fontSize="small" sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                    <Link
                        href={formatExplorerUrl({
                            network,
                            address: row.sender_address,
                            isAccount: true,
                            chain: row.from_chain,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        color="primary"
                        fontWeight="bold"
                    >
                        {truncateAddress(row.sender_address)}
                    </Link>
                    <Link
                        color="inherit"
                        href={buildProfileQuery(
                            !isInflow
                                ? { suiAddress: row.sender_address }
                                : { ethAddress: row.sender_address },
                        )}
                    >
                        <Iconify icon="solar:arrow-right-up-outline" />
                    </Link>
                </Box>
            </TableCell>

            {/* Recipient with Improved Visibility */}
            <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Tooltip title="Copy recipient address">
                        <IconButton
                            size="small"
                            onClick={() => navigator.clipboard.writeText(row.recipient_address)}
                        >
                            <ContentCopyOutlinedIcon fontSize="small" sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                    <Link
                        href={formatExplorerUrl({
                            network,
                            address: row.recipient_address,
                            isAccount: true,
                            chain: isInflow ? 'SUI' : 'ETH',
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        color="primary"
                        fontWeight="bold"
                    >
                        {truncateAddress(row.recipient_address)}
                    </Link>

                    <Link
                        color="inherit"
                        href={buildProfileQuery(
                            isInflow
                                ? { suiAddress: row.recipient_address }
                                : { ethAddress: row.recipient_address },
                        )}
                    >
                        <Iconify icon="solar:arrow-right-up-outline" />
                    </Link>
                </Box>
            </TableCell>

            {/* Amount with Token Icon */}
            <TableCell>
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
                        {row.token_info.name && (
                            <img
                                src={
                                    getTokensList(network)?.find(
                                        it => it.ticker === row.token_info.name,
                                    )?.icon
                                }
                                alt={row.token_info.name}
                                style={{ width: 20, height: 20, marginRight: 6 }}
                            />
                        )}
                        <Typography variant="h6" fontWeight="bold">
                            {fNumber(row.amount)}
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
            </TableCell>

            {/* Transaction Link */}
            <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Tooltip title="Copy transaction hash">
                        <IconButton
                            size="small"
                            onClick={() => navigator.clipboard.writeText(row.tx_hash)}
                        >
                            <ContentCopyOutlinedIcon fontSize="small" sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
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
                    >
                        {truncateAddress(row.tx_hash)}
                    </Link>
                </Box>
            </TableCell>

            {/* Timestamp */}
            <TableCell>
                <Typography variant="caption" fontWeight="bold" color="text.secondary">
                    {relativeTime}
                </Typography>
            </TableCell>
            <TableCell style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                <Link
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    sx={{ marginLeft: 1 }}
                    color="inherit"
                    href={`${paths.transactions.root}/${row.tx_hash}`}
                >
                    <Iconify icon="solar:eye-bold" />
                </Link>
            </TableCell>
        </TableRow>
    )
}
