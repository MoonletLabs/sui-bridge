import {
    Timeline,
    TimelineConnector,
    TimelineContent,
    TimelineDot,
    TimelineItem,
    TimelineSeparator,
} from '@mui/lab'
import {
    Alert,
    Box,
    Breadcrumbs,
    Button,
    Card,
    CardHeader,
    Chip,
    Grid,
    Link,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { PageTitle } from 'src/components/page-title'
import { TransactionDetailSkeleton } from 'src/components/skeletons'
import { formatExplorerUrl, truncateAddress } from 'src/config/helper'
import { getNetwork, NETWORK } from 'src/hooks/get-network-storage'
import { useRouter } from 'src/routes/hooks'
import { paths } from 'src/routes/paths'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { fDateTime, fDateTimeUtc, fDurationMs } from 'src/utils/format-time'
import { buildProfileQuery } from 'src/utils/helper'
import { ChainType, getTokensList, TransactionHistoryType, TransactionType } from 'src/utils/types'
import useSWR from 'swr'
import { CopyButton } from '../copy-button'
import { Iconify } from '../iconify'

// ----------------------------------------------------------------------

type TypicalLatency = { approval_p50: number | null; claim_p50: number | null; sample: number }

type TransactionResponse = {
    tx: TransactionType
    history: TransactionHistoryType[]
    typical?: TypicalLatency
    sender?: {
        transfer_count: number
        total_usd: number
        recent: TransactionType[]
    }
}

type StepStatus = 'Deposited' | 'Approved' | 'Claimed'
const STEP_ORDER: StepStatus[] = ['Deposited', 'Approved', 'Claimed']

type Step = {
    status: StepStatus
    /** Missing when the step has not happened yet */
    item?: TransactionHistoryType
    /** Gap since the previous step that happened */
    gapMs?: number
    /** Happened in the very same transaction as the previous step */
    sameTxAsPrevious?: boolean
}

const CHAIN_NAME: Record<ChainType, string> = { ETH: 'Ethereum', SUI: 'Sui' }
const EXPLORER_NAME: Record<ChainType, string> = { ETH: 'Etherscan', SUI: 'Suiscan' }
const MS_PER_MIN = 60000

/**
 * The bridge records each lifecycle step once per transfer. Build the ordered
 * list of steps, including the ones still to come, so a transfer in progress
 * shows where it is rather than just what already happened.
 */
function buildSteps(history: TransactionHistoryType[]): Step[] {
    const steps: Step[] = []
    let previous: TransactionHistoryType | undefined

    for (const status of STEP_ORDER) {
        const candidates = history.filter(h => h.status === status)
        const item = candidates.find(h => h.is_finalized) ?? candidates[0]
        steps.push({
            status,
            item,
            gapMs: item && previous ? item.timestamp_ms - previous.timestamp_ms : undefined,
            sameTxAsPrevious: !!item && !!previous && item.tx_hash === previous.tx_hash,
        })
        if (item) previous = item
    }
    return steps
}

/** Gas is recorded raw: SUI in MIST (1e9 per SUI), Ethereum in gas units (no fee in ETH is stored) */
function formatGas(item: TransactionHistoryType) {
    if (item.data_source === 'SUI') {
        return {
            text: `${fNumber(item.gas_usage / 1e9, { maximumFractionDigits: 6 })} SUI`,
            hint: 'Transaction fee paid on Sui',
        }
    }
    return {
        text: `${Math.round(item.gas_usage).toLocaleString()} gas units`,
        hint: 'Gas units used. The fee in ETH depends on the gas price, which the bridge indexer does not record.',
    }
}

type Banner = {
    severity: 'success' | 'info' | 'warning'
    title: string
    body: string
    showHealthLink?: boolean
}

/** What state is this transfer in, in plain language */
function buildBanner(
    steps: Step[],
    isSuiToEth: boolean,
    typical: TypicalLatency | undefined,
    now: number,
): Banner {
    const [deposit, approved, claimed] = steps.map(s => s.item)
    const typicalApprovalMs = typical?.approval_p50 ? typical.approval_p50 * MS_PER_MIN : null
    const typicalText = typicalApprovalMs ? ` (typically ${fDurationMs(typicalApprovalMs)})` : ''

    if (deposit && !deposit.is_finalized) {
        return {
            severity: 'info',
            title: 'Deposit not finalized yet',
            body: 'The deposit was seen on-chain and is waiting for finality before the bridge committee can approve it.',
        }
    }

    if (claimed && deposit && !claimed.is_finalized) {
        return {
            severity: 'info',
            title: 'Claim submitted, waiting for finality',
            body: `The claim was seen on ${isSuiToEth ? 'Ethereum' : 'Sui'} and is waiting for finality before the transfer counts as complete.`,
        }
    }

    if (claimed && deposit) {
        const total = claimed.timestamp_ms - deposit.timestamp_ms
        const benchmark = typical?.claim_p50 ? typical.claim_p50 * MS_PER_MIN : null
        return {
            severity: 'success',
            title: `Completed in ${fDurationMs(total)}`,
            body: benchmark
                ? `Funds arrived on ${isSuiToEth ? 'Ethereum' : 'Sui'}. Transfers in this direction typically take ${fDurationMs(benchmark)} to be claimed.`
                : `Funds arrived on ${isSuiToEth ? 'Ethereum' : 'Sui'}.`,
        }
    }

    if (approved) {
        return {
            severity: 'info',
            title: 'Approved, waiting to be claimed',
            body: isSuiToEth
                ? 'The bridge committee approved this transfer. The recipient (or a relayer) still has to claim it on Ethereum.'
                : 'The bridge committee approved this transfer. It is waiting to be claimed on Sui.',
        }
    }

    const waited = deposit ? now - deposit.timestamp_ms : 0
    const slow = typicalApprovalMs ? waited > typicalApprovalMs * 2 : waited > 30 * MS_PER_MIN
    return slow
        ? {
              severity: 'warning',
              title: `Delayed: waiting ${fDurationMs(waited)} for committee approval`,
              body: `Approval usually takes much less${typicalText}. If this keeps growing, the transfer may be stuck.`,
              showHealthLink: true,
          }
        : {
              severity: 'info',
              title: `Waiting for committee approval (${fDurationMs(waited)} so far)`,
              body: `The bridge committee signs each transfer after finality${typicalText}.`,
          }
}

function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

// ----------------------------------------------------------------------

export function TransactionView({ tx }: { tx: string }) {
    const network = getNetwork()
    const router = useRouter()
    const [linkCopied, setLinkCopied] = useState(false)
    // Re-render periodically so the "delayed" banner appears even when polled data is unchanged
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30000)
        return () => clearInterval(id)
    }, [])

    const { data, isLoading } = useSWR<TransactionResponse>(
        `${endpoints.transaction}/${tx}?network=${network}`,
        fetcher,
        // A transfer in progress changes: keep refreshing until it is claimed
        {
            refreshInterval: current =>
                current && current.history.some(h => h.status === 'Claimed' && h.is_finalized)
                    ? 0
                    : 20000,
        },
    )

    const steps = useMemo(() => (data ? buildSteps(data.history) : []), [data])

    if (isLoading) {
        return <TransactionDetailSkeleton />
    }

    if (!isLoading && !data) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 1,
                    gap: 2,
                    py: 8,
                    textAlign: 'center',
                }}
            >
                <Iconify icon="eva:search-outline" width={64} sx={{ color: 'text.disabled' }} />
                <Typography variant="h4">Transaction not found</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
                    We couldn&apos;t find a bridge transaction with hash{' '}
                    <Box component="span" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {truncateAddress(tx, 8)}
                    </Box>
                    . Double-check the hash or try switching the network.
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<Iconify icon="eva:arrow-back-outline" />}
                    onClick={() => router.push(paths.transactions.root)}
                >
                    Back to transactions
                </Button>
            </Box>
        )
    }

    if (!data) return null

    const { tx: transfer, history, typical, sender } = data
    const isSuiToEth = transfer.from_chain === 'SUI'
    const ticker = transfer.token_info.name
    const banner = buildBanner(steps, isSuiToEth, typical, now)

    // Explorer links: the deposit, plus the approval/claim when it is a different transaction
    const depositItem = steps[0].item
    const finalItem = steps[2].item ?? steps[1].item
    const explorerLinks: { label: string; url: string }[] = []
    if (depositItem) {
        explorerLinks.push({
            label: `Deposit on ${EXPLORER_NAME[depositItem.data_source]}`,
            url: formatExplorerUrl({
                network,
                address: depositItem.tx_hash,
                isAccount: false,
                chain: depositItem.data_source,
            }),
        })
    }
    if (finalItem && finalItem.tx_hash !== depositItem?.tx_hash) {
        explorerLinks.push({
            label: `${steps[2].item ? 'Claim' : 'Approval'} on ${EXPLORER_NAME[finalItem.data_source]}`,
            url: formatExplorerUrl({
                network,
                address: finalItem.tx_hash,
                isAccount: false,
                chain: finalItem.data_source,
            }),
        })
    }

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href)
            setLinkCopied(true)
            setTimeout(() => setLinkCopied(false), 2000)
        } catch (error) {
            console.error('Failed to copy link:', error)
        }
    }

    return (
        <Box>
            <PageTitle title={`${fNumber(transfer.amount)} ${ticker} bridge transfer`} />

            {/* Header: where am I, what is this, what can I do */}
            <Breadcrumbs sx={{ mb: 1 }}>
                <Link
                    component="button"
                    underline="hover"
                    color="text.secondary"
                    onClick={() => router.push(paths.transactions.root)}
                >
                    Transactions
                </Link>
                <Typography color="text.primary" sx={{ fontFamily: 'monospace' }}>
                    {truncateAddress(transfer.tx_hash, 6)}
                </Typography>
            </Breadcrumbs>

            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
                sx={{ mb: 2 }}
            >
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography variant="h4">
                        {fNumber(transfer.amount)} {ticker}
                    </Typography>
                    <Chip
                        size="small"
                        label={isSuiToEth ? 'SUI → ETH' : 'ETH → SUI'}
                        sx={{
                            bgcolor: isSuiToEth ? '#627EEA' : '#16A34A',
                            fontWeight: 700,
                            '& .MuiChip-label': { color: '#fff' },
                        }}
                    />
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {explorerLinks.map(l => (
                        <Button
                            key={l.url}
                            size="small"
                            variant="outlined"
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            endIcon={<Iconify icon="solar:arrow-right-up-outline" width={16} />}
                        >
                            {l.label}
                        </Button>
                    ))}
                    <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        onClick={handleCopyLink}
                        startIcon={
                            <Iconify
                                icon={linkCopied ? 'eva:checkmark-fill' : 'eva:link-2-fill'}
                                width={16}
                            />
                        }
                    >
                        {linkCopied ? 'Link copied' : 'Copy link'}
                    </Button>
                    <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        onClick={() =>
                            downloadJson(`bridge-transfer-${network}-${transfer.nonce}.json`, {
                                network,
                                transfer,
                                history,
                            })
                        }
                        startIcon={<Iconify icon="solar:download-minimalistic-bold" width={16} />}
                    >
                        Export JSON
                    </Button>
                </Stack>
            </Stack>

            <Alert severity={banner.severity} sx={{ mb: 3 }}>
                <Typography variant="subtitle2">{banner.title}</Typography>
                <Typography variant="body2">
                    {banner.body}
                    {banner.showHealthLink && (
                        <>
                            {' '}
                            <Link href={`${paths.health.root}?ustage=pending_approval`}>
                                See all transfers awaiting approval
                            </Link>
                        </>
                    )}
                </Typography>
            </Alert>

            <Grid container spacing={3}>
                <Grid item xs={12} md={5} lg={4}>
                    <TransactionSummary tx={transfer} network={network} />
                </Grid>
                <Grid item xs={12} md={7} lg={8}>
                    <BridgeTimeline
                        steps={steps}
                        typical={typical}
                        isSuiToEth={isSuiToEth}
                        network={network}
                    />
                </Grid>
                {sender && sender.recent.length > 0 && (
                    <Grid item xs={12}>
                        <SenderActivity tx={transfer} sender={sender} />
                    </Grid>
                )}
            </Grid>
        </Box>
    )
}

// ----------------------------------------------------------------------

function ChainBadge({ chain }: { chain: ChainType }) {
    return (
        <Chip
            size="small"
            variant="outlined"
            label={CHAIN_NAME[chain]}
            icon={
                <img
                    src={`/assets/icons/brands/${chain.toLowerCase()}.svg`}
                    alt=""
                    style={{ width: 14, height: 14 }}
                />
            }
            sx={{ height: 22, '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' } }}
        />
    )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {label}
            </Typography>
            <Box sx={{ mt: 0.25 }}>{children}</Box>
        </Box>
    )
}

function AddressRow({
    label,
    address,
    chain,
    network,
}: {
    label: string
    address: string
    chain: ChainType
    network: NETWORK
}) {
    const profileHref = buildProfileQuery(
        chain === 'SUI' ? { suiAddress: address } : { ethAddress: address },
    )
    return (
        <SummaryRow label={label}>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <ChainBadge chain={chain} />
                <Link
                    href={formatExplorerUrl({ network, address, isAccount: true, chain })}
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="hover"
                    color="primary"
                    fontWeight="bold"
                    sx={{ fontFamily: 'monospace' }}
                >
                    {truncateAddress(address, 6)}
                </Link>
                <CopyButton
                    value={address}
                    title={`Copy ${label.toLowerCase()} address`}
                    size={14}
                />
                {profileHref && (
                    <Tooltip title="See this address's bridge history">
                        <Link href={profileHref} underline="hover" variant="caption">
                            History
                        </Link>
                    </Tooltip>
                )}
            </Stack>
        </SummaryRow>
    )
}

function TransactionSummary({ tx, network }: { tx: TransactionType; network: NETWORK }) {
    const isSuiToEth = tx.from_chain === 'SUI'
    const tokenIcon = getTokensList(network)?.find(
        token => token.ticker === tx.token_info.name,
    )?.icon
    const toChain: ChainType = isSuiToEth ? 'ETH' : 'SUI'

    return (
        <Card sx={{ boxShadow: 5, borderRadius: 2, height: '100%' }}>
            <CardHeader
                title="Bridge Summary"
                titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
                sx={{
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    py: 1,
                    px: 2,
                }}
            />
            <Stack spacing={2} sx={{ p: 2 }}>
                <SummaryRow label="Route">
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={600}>
                            {CHAIN_NAME[tx.from_chain]}
                        </Typography>
                        <Iconify
                            width={18}
                            icon="solar:round-arrow-right-bold-duotone"
                            sx={{ color: 'text.secondary' }}
                        />
                        <Typography variant="body2" fontWeight={600}>
                            {CHAIN_NAME[toChain]}
                        </Typography>
                    </Stack>
                </SummaryRow>

                <SummaryRow label="Amount">
                    <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                    >
                        {tokenIcon && (
                            <img src={tokenIcon} width={22} height={22} alt={tx.token_info.name} />
                        )}
                        <Typography variant="body1" fontWeight="bold">
                            {fNumber(tx.amount)} {tx.token_info.name}
                        </Typography>
                        <Tooltip title="Valued at today's token price, not the price when the transfer happened">
                            <Typography variant="caption" color="text.secondary">
                                ≈ ${fNumber(tx.amount_usd)} at current price
                            </Typography>
                        </Tooltip>
                    </Stack>
                </SummaryRow>

                <AddressRow
                    label="Sender"
                    address={tx.sender_address}
                    chain={tx.from_chain}
                    network={network}
                />
                <AddressRow
                    label="Recipient"
                    address={tx.recipient_address}
                    chain={toChain}
                    network={network}
                />

                <SummaryRow label="Deposit transaction">
                    <Stack direction="row" spacing={0.75} alignItems="center">
                        <Link
                            href={formatExplorerUrl({
                                network,
                                address: tx.tx_hash,
                                isAccount: false,
                                chain: tx.from_chain,
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            underline="hover"
                            color="primary"
                            fontWeight="bold"
                            sx={{ fontFamily: 'monospace' }}
                        >
                            {truncateAddress(tx.tx_hash, 6)}
                        </Link>
                        <CopyButton value={tx.tx_hash} title="Copy transaction hash" size={14} />
                    </Stack>
                </SummaryRow>

                <SummaryRow label="Date">
                    <Typography variant="body2">{fDateTimeUtc(tx.timestamp_ms)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(tx.timestamp_ms, { addSuffix: true })} ·{' '}
                        {fDateTime(tx.timestamp_ms)} your time
                    </Typography>
                </SummaryRow>

                <SummaryRow label="Bridge nonce">
                    <Typography variant="body2">{tx.nonce}</Typography>
                </SummaryRow>
            </Stack>
        </Card>
    )
}

// ----------------------------------------------------------------------

function InfoLine({
    icon,
    children,
    hint,
}: {
    icon: string
    children: React.ReactNode
    hint?: string
}) {
    const line = (
        <Stack direction="row" spacing={1} alignItems="center">
            <Iconify icon={icon} width={16} height={16} />
            <Typography variant="caption" component="div">
                {children}
            </Typography>
        </Stack>
    )
    return hint ? <Tooltip title={hint}>{line}</Tooltip> : line
}

function BridgeTimeline({
    steps,
    typical,
    isSuiToEth,
    network,
}: {
    steps: Step[]
    typical?: TypicalLatency
    isSuiToEth: boolean
    network: NETWORK
}) {
    return (
        <Card sx={{ boxShadow: 5, borderRadius: 2, height: '100%' }}>
            <CardHeader
                title="Bridge Timeline"
                titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
                sx={{
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    py: 1,
                    px: 2,
                }}
            />
            <Timeline
                sx={{
                    m: 0,
                    px: { xs: 0, sm: 2 },
                    '& .MuiTimelineItem-root:before': { flex: 0, p: 0 },
                }}
            >
                {steps.map((step, index) => {
                    const { item } = step
                    const isLast = index === steps.length - 1
                    const done = !!item?.is_finalized
                    const gas = item ? formatGas(item) : null

                    return (
                        <TimelineItem key={step.status}>
                            <TimelineSeparator>
                                <TimelineDot
                                    color={done ? 'success' : 'grey'}
                                    variant={item ? 'filled' : 'outlined'}
                                    sx={{
                                        p: 1,
                                        boxShadow: item ? '0 0 10px rgba(0,0,0,0.1)' : 'none',
                                    }}
                                >
                                    <Iconify
                                        icon={
                                            done
                                                ? 'eva:checkmark-outline'
                                                : item
                                                  ? 'eva:clock-outline'
                                                  : 'eva:more-horizontal-outline'
                                        }
                                        width={14}
                                        height={14}
                                    />
                                </TimelineDot>
                                {!isLast && <TimelineConnector sx={{ bgcolor: 'divider' }} />}
                            </TimelineSeparator>

                            <TimelineContent sx={{ pb: 2 }}>
                                <Box
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        bgcolor: 'background.paper',
                                        boxShadow: item ? 5 : 0,
                                        border: item ? 'none' : '1px dashed',
                                        borderColor: 'divider',
                                        opacity: item ? 1 : 0.7,
                                    }}
                                >
                                    <Stack
                                        direction="row"
                                        spacing={1}
                                        alignItems="center"
                                        flexWrap="wrap"
                                        useFlexGap
                                    >
                                        <Typography
                                            variant="subtitle1"
                                            fontWeight="bold"
                                            color={item ? 'primary' : 'text.secondary'}
                                        >
                                            {step.status}
                                        </Typography>
                                        {step.gapMs !== undefined && (
                                            <Chip
                                                size="small"
                                                variant="outlined"
                                                label={`+${fDurationMs(step.gapMs)}`}
                                                sx={{ height: 20, fontSize: '0.7rem' }}
                                            />
                                        )}
                                        {item && !item.is_finalized && (
                                            <Chip size="small" color="warning" label="Pending" />
                                        )}
                                    </Stack>

                                    {!item && (
                                        <PendingStepNote
                                            status={step.status}
                                            typical={typical}
                                            isSuiToEth={isSuiToEth}
                                        />
                                    )}

                                    {item && (
                                        <Grid container spacing={2} sx={{ mt: 0 }}>
                                            <Grid item xs={12} sm={6}>
                                                <Stack spacing={1}>
                                                    <InfoLine icon="eva:clock-outline">
                                                        {fDateTimeUtc(item.timestamp_ms)}
                                                    </InfoLine>
                                                    <InfoLine icon="mdi:database">
                                                        Chain: {CHAIN_NAME[item.data_source]}
                                                    </InfoLine>
                                                    <Stack
                                                        direction="row"
                                                        spacing={1}
                                                        alignItems="center"
                                                    >
                                                        <Iconify
                                                            icon="mdi:fingerprint"
                                                            width={16}
                                                            height={16}
                                                        />
                                                        <Typography variant="caption">
                                                            Tx:
                                                        </Typography>
                                                        <Link
                                                            href={formatExplorerUrl({
                                                                network,
                                                                address: item.tx_hash,
                                                                isAccount: false,
                                                                chain: item.data_source,
                                                            })}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            underline="hover"
                                                            color="primary"
                                                            style={{ fontSize: 13 }}
                                                        >
                                                            {truncateAddress(item.tx_hash)}
                                                        </Link>
                                                        <CopyButton
                                                            value={item.tx_hash}
                                                            title="Copy transaction hash"
                                                            size={14}
                                                        />
                                                    </Stack>
                                                    {step.sameTxAsPrevious && (
                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                        >
                                                            Same transaction as the previous step
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                                {/* Details repeated verbatim from the previous step are left out */}
                                                {!step.sameTxAsPrevious && (
                                                    <Stack spacing={1}>
                                                        <Stack
                                                            direction="row"
                                                            spacing={1}
                                                            alignItems="center"
                                                        >
                                                            <Iconify
                                                                icon="eva:person-outline"
                                                                width={16}
                                                                height={16}
                                                            />
                                                            <Typography variant="caption">
                                                                Sender:
                                                            </Typography>
                                                            <Link
                                                                href={formatExplorerUrl({
                                                                    network,
                                                                    address: item.txn_sender,
                                                                    isAccount: true,
                                                                    chain: item.data_source,
                                                                })}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                underline="hover"
                                                                color="primary"
                                                                style={{ fontSize: 13 }}
                                                            >
                                                                {truncateAddress(item.txn_sender)}
                                                            </Link>
                                                            <CopyButton
                                                                value={item.txn_sender}
                                                                title="Copy sender address"
                                                                size={14}
                                                            />
                                                        </Stack>
                                                        <InfoLine icon="mdi:code-block-tags">
                                                            Block height: {item.block_height}
                                                        </InfoLine>
                                                        {gas && (
                                                            <InfoLine
                                                                icon="mdi:gas-station"
                                                                hint={gas.hint}
                                                            >
                                                                Gas: {gas.text}
                                                            </InfoLine>
                                                        )}
                                                    </Stack>
                                                )}
                                            </Grid>
                                        </Grid>
                                    )}
                                </Box>
                            </TimelineContent>
                        </TimelineItem>
                    )
                })}
            </Timeline>
        </Card>
    )
}

/** What is still to come for a step that has not happened yet */
function PendingStepNote({
    status,
    typical,
    isSuiToEth,
}: {
    status: StepStatus
    typical?: TypicalLatency
    isSuiToEth: boolean
}) {
    let text = 'Not yet'
    if (status === 'Approved') {
        text = typical?.approval_p50
            ? `Waiting for the bridge committee. Typically ${fDurationMs(typical.approval_p50 * MS_PER_MIN)} after the deposit.`
            : 'Waiting for the bridge committee to approve.'
    } else if (status === 'Claimed') {
        text = isSuiToEth
            ? 'Waiting for the recipient (or a relayer) to claim on Ethereum.'
            : 'Waiting to be claimed on Sui.'
    }
    return (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {text}
        </Typography>
    )
}

// ----------------------------------------------------------------------

function SenderActivity({
    tx,
    sender,
}: {
    tx: TransactionType
    sender: NonNullable<TransactionResponse['sender']>
}) {
    const chain = tx.from_chain
    const profileHref = buildProfileQuery(
        chain === 'SUI' ? { suiAddress: tx.sender_address } : { ethAddress: tx.sender_address },
    )

    return (
        <Card sx={{ boxShadow: 5, borderRadius: 2 }}>
            <CardHeader
                title="More from this sender"
                subheader={`${sender.transfer_count.toLocaleString()} bridge transfers in total · $${fNumber(sender.total_usd)} volume (at current prices)`}
                titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
                action={
                    profileHref && (
                        <Button size="small" href={profileHref}>
                            View full history
                        </Button>
                    )
                }
            />
            <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>When</TableCell>
                            <TableCell>Direction</TableCell>
                            <TableCell align="right">Amount</TableCell>
                            <TableCell>Transaction</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sender.recent.map(r => (
                            <TableRow key={`${r.chain_id}-${r.nonce}`} hover>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                    <Typography variant="caption" color="text.secondary">
                                        {fDateTimeUtc(r.timestamp_ms)}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    {r.from_chain === 'SUI' ? 'SUI → ETH' : 'ETH → SUI'}
                                </TableCell>
                                <TableCell align="right">
                                    <Typography variant="body2" fontWeight={600}>
                                        {fNumber(r.amount)} {r.token_info.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        ≈ ${fNumber(r.amount_usd)}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Link
                                        href={`${paths.transactions.root}/${r.tx_hash}`}
                                        underline="hover"
                                        sx={{ fontFamily: 'monospace', fontSize: 13 }}
                                    >
                                        {truncateAddress(r.tx_hash, 6)}
                                    </Link>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>
        </Card>
    )
}
