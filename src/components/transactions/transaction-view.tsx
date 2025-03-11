import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineDot,
    TimelineConnector,
    TimelineContent,
} from '@mui/lab'
import { Card, CardHeader, Box, Typography, Stack, Divider, Link, Grid } from '@mui/material'
import { getNetwork, NETWORK } from 'src/hooks/get-network-storage'
import { endpoints, fetcher } from 'src/utils/axios'
import { fDateTime } from 'src/utils/format-time'
import { TransactionType, TransactionHistoryType, getTokensList } from 'src/utils/types'
import useSWR from 'swr'
import { Iconify } from '../iconify'
import { formatExplorerUrl, truncateAddress } from 'src/config/helper'
import { fNumber } from 'src/utils/format-number'
import { formatDistanceToNow } from 'date-fns'
import Loading from 'src/app/loading'
import { NotFoundView } from 'src/sections/error'

export function TransactionView({ tx }: { tx: string }) {
    const network = getNetwork()

    const { data, isLoading } = useSWR<{
        tx: TransactionType
        history: TransactionHistoryType[]
    }>(`${endpoints.transaction}/${tx}?network=${network}`, fetcher)

    if (isLoading) {
        return <Loading />
    }

    if (!isLoading && !data) {
        return (
            <Box
                sx={{
                    alignContent: 'center',
                    alignItems: 'center',
                    display: 'flex',
                    flex: 1,
                    alignSelf: 'center',
                }}
            >
                <Typography variant={'h4'}>Could not find the transaction</Typography>
            </Box>
        )
    }

    return (
        <Card sx={{ boxShadow: 3, borderRadius: 2 }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                }}
            >
                {/* Transaction Summary Column */}
                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 2 }}>
                    {data?.tx && <TransactionSummary tx={data.tx} network={network} />}
                </Box>

                {/* Vertical divider on medium+ screens */}
                <Divider
                    orientation="vertical"
                    flexItem
                    sx={{ display: { xs: 'none', md: 'block' } }}
                />

                {/* Timeline Column */}
                <Box sx={{ width: { xs: '100%', md: '70%' }, p: 2 }}>
                    <CardHeader
                        title="Transaction Timeline"
                        titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
                        sx={{
                            backgroundColor: 'primary.main',
                            color: 'primary.contrastText',
                            py: 1,
                            px: 2,
                            borderTopLeftRadius: 10,
                            borderTopRightRadius: 10,
                        }}
                    />
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: { md: 'center' },
                            flexDirection: 'column',
                            width: '100%',
                            overflow: 'scroll',
                            flex: 1,
                        }}
                    >
                        <Timeline sx={{ '& .MuiTimelineItem-root': { minHeight: '120px' } }}>
                            {data?.history.map((item, index) => {
                                const isLast = index === data.history.length - 1
                                return (
                                    <TimelineItem key={item.tx_hash + index}>
                                        <TimelineSeparator>
                                            <TimelineDot
                                                color={item.is_finalized ? 'success' : 'grey'}
                                                sx={{
                                                    p: 1,
                                                    boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                                                }}
                                            >
                                                {(item.is_finalized && (
                                                    <Iconify
                                                        icon="eva:checkmark-outline"
                                                        width={14}
                                                        height={14}
                                                        color="success"
                                                    />
                                                )) || (
                                                    <Iconify
                                                        icon="eva:close-outline"
                                                        width={14}
                                                        height={14}
                                                    />
                                                )}
                                            </TimelineDot>
                                            {!isLast && (
                                                <TimelineConnector sx={{ bgcolor: 'grey.300' }} />
                                            )}
                                        </TimelineSeparator>
                                        <TimelineContent>
                                            <Box
                                                sx={{
                                                    backgroundColor: 'background.paper',
                                                    p: 2,
                                                    borderRadius: 2,
                                                    boxShadow: 5,
                                                    transition: 'box-shadow 0.3s ease-in-out',
                                                    '&:hover': { boxShadow: 10 },
                                                    minWidth: 500,
                                                    mx: 'auto', // centers the card horizontally
                                                }}
                                            >
                                                <Typography
                                                    variant="subtitle1"
                                                    fontWeight="bold"
                                                    color={'primary'}
                                                    gutterBottom
                                                >
                                                    {item.status}
                                                </Typography>
                                                <Grid container spacing={2}>
                                                    {/* Left Column */}
                                                    <Grid item xs={6}>
                                                        <Stack spacing={1}>
                                                            <Stack
                                                                direction="row"
                                                                spacing={1}
                                                                alignItems="center"
                                                            >
                                                                <Iconify
                                                                    icon="eva:clock-outline"
                                                                    width={16}
                                                                    height={16}
                                                                />
                                                                <Typography variant="caption">
                                                                    {fDateTime(item.timestamp_ms)}
                                                                </Typography>
                                                            </Stack>
                                                            <Stack
                                                                direction="row"
                                                                spacing={1}
                                                                alignItems="center"
                                                            >
                                                                <Iconify
                                                                    icon="mdi:database"
                                                                    width={16}
                                                                    height={16}
                                                                />
                                                                <Typography variant="caption">
                                                                    <Box
                                                                        sx={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: 1,
                                                                        }}
                                                                    >
                                                                        Chain:
                                                                        <img
                                                                            src={`/assets/icons/brands/${item.data_source?.toLocaleLowerCase()}.svg`}
                                                                            alt={item.data_source}
                                                                            style={{
                                                                                width: 15,
                                                                                height: 15,
                                                                            }}
                                                                        />
                                                                    </Box>
                                                                </Typography>
                                                            </Stack>

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
                                                            </Stack>

                                                            <Stack
                                                                direction="row"
                                                                spacing={1}
                                                                alignItems="center"
                                                            >
                                                                {item.is_finalized ? (
                                                                    <>
                                                                        <Iconify
                                                                            icon="eva:checkmark-circle-2-outline"
                                                                            width={16}
                                                                            height={16}
                                                                            color="#22C55E"
                                                                        />
                                                                        <Typography variant="caption">
                                                                            Finalized
                                                                        </Typography>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Iconify
                                                                            icon="eva:alert-circle-outline"
                                                                            width={16}
                                                                            height={16}
                                                                            color="#FA3913"
                                                                        />
                                                                        <Typography variant="caption">
                                                                            Pending
                                                                        </Typography>
                                                                    </>
                                                                )}
                                                            </Stack>
                                                        </Stack>
                                                    </Grid>
                                                    {/* Right Column */}
                                                    <Grid item xs={6}>
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
                                                                    {truncateAddress(
                                                                        item.txn_sender,
                                                                    )}
                                                                </Link>
                                                            </Stack>

                                                            <Stack
                                                                direction="row"
                                                                spacing={1}
                                                                alignItems="center"
                                                            >
                                                                <Iconify
                                                                    icon="mdi:format-list-numbered"
                                                                    width={16}
                                                                    height={16}
                                                                />
                                                                <Typography variant="caption">
                                                                    Nonce: {item.nonce}
                                                                </Typography>
                                                            </Stack>
                                                            <Stack
                                                                direction="row"
                                                                spacing={1}
                                                                alignItems="center"
                                                            >
                                                                <Iconify
                                                                    icon="mdi:code-block-tags"
                                                                    width={16}
                                                                    height={16}
                                                                />
                                                                <Typography variant="caption">
                                                                    Block Height:{' '}
                                                                    {item.block_height}
                                                                </Typography>
                                                            </Stack>
                                                            <Stack
                                                                direction="row"
                                                                spacing={1}
                                                                alignItems="center"
                                                            >
                                                                <Iconify
                                                                    icon="mdi:gas-station"
                                                                    width={16}
                                                                    height={16}
                                                                />
                                                                <Typography variant="caption">
                                                                    Gas Usage:{' '}
                                                                    {fNumber(
                                                                        item.gas_usage /
                                                                            Math.pow(10, 9),
                                                                        {
                                                                            maximumFractionDigits: 7,
                                                                        },
                                                                    )}
                                                                </Typography>
                                                            </Stack>
                                                        </Stack>
                                                    </Grid>
                                                </Grid>
                                            </Box>
                                        </TimelineContent>
                                    </TimelineItem>
                                )
                            })}
                        </Timeline>
                    </Box>
                </Box>
            </Box>
        </Card>
    )
}

function TransactionSummary({ tx, network }: { tx: TransactionType; network: NETWORK }) {
    const isInflow = tx.destination_chain === 'SUI'
    const tokenIcon = getTokensList(network)?.find(
        token => token.ticker === tx.token_info.name,
    )?.icon

    return (
        <Card sx={{ boxShadow: 5, borderRadius: 2 }}>
            <CardHeader
                title="Transaction Summary"
                titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
                sx={{
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    py: 1,
                    px: 2,
                }}
            />
            <Box sx={{ p: 2 }}>
                {/* Flow Section */}
                <Stack direction="row" spacing={1} sx={{ marginBottom: 2 }} alignItems="center">
                    <Typography variant="subtitle1">
                        {isInflow
                            ? 'Transfer assets from Ethereum to SUI'
                            : 'Transfer assets from SUI to Ethereum'}
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <img
                            src={`/assets/icons/brands/eth.svg`}
                            alt={tx.from_chain}
                            style={{ width: 28, height: 28 }}
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
                            alt={tx.destination_chain}
                            style={{ width: 28, height: 28 }}
                        />
                    </Box>
                </Stack>

                <Box mt={2}>
                    <Stack spacing={2}>
                        {/* Sender */}
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" fontWeight="bold">
                                Sender:
                            </Typography>
                            <Link
                                href={formatExplorerUrl({
                                    network,
                                    address: tx.sender_address,
                                    isAccount: true,
                                    chain: tx.from_chain,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                underline="hover"
                                color="primary"
                                fontWeight="bold"
                            >
                                {truncateAddress(tx.sender_address)}
                            </Link>
                        </Stack>
                        {/* Recipient */}
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" fontWeight="bold">
                                Recipient:
                            </Typography>
                            <Link
                                href={formatExplorerUrl({
                                    network,
                                    address: tx.recipient_address,
                                    isAccount: true,
                                    chain: isInflow ? 'SUI' : 'ETH',
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                underline="hover"
                                color="primary"
                                fontWeight="bold"
                            >
                                {truncateAddress(tx.recipient_address)}
                            </Link>
                        </Stack>
                        {/* Amount */}
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" fontWeight="bold">
                                Amount:
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                {tokenIcon && (
                                    <img
                                        src={tokenIcon}
                                        width={20}
                                        height={20}
                                        style={{ marginRight: 6 }}
                                    />
                                )}
                                <Typography variant="body2" fontWeight="bold">
                                    {fNumber(tx.amount)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                    ≈ ${fNumber(tx.amount_usd)}
                                </Typography>
                            </Box>
                        </Stack>

                        {/* Transaction Hash */}
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" fontWeight="bold">
                                Tx:
                            </Typography>
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
                            >
                                {truncateAddress(tx.tx_hash)}
                            </Link>
                        </Stack>
                        {/* Date */}
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" fontWeight="bold">
                                Date:
                            </Typography>
                            <Typography variant="body2">{fDateTime(tx.timestamp_ms)}</Typography>
                        </Stack>

                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" fontWeight="bold">
                                Relative:
                            </Typography>
                            <Typography variant="body2">
                                {formatDistanceToNow(tx.timestamp_ms, { addSuffix: true })}
                            </Typography>
                        </Stack>
                    </Stack>
                </Box>
            </Box>
        </Card>
    )
}
