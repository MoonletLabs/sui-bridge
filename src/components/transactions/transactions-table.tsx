import { Box, Link, TableCell, TableRow, Typography } from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useState } from 'react'
import { formatExplorerUrl, truncateAddress } from 'src/config/helper'
import { getNetwork, NETWORK } from 'src/hooks/get-network-storage'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { getTokensList, TransactionType } from 'src/utils/types'
import useSWR from 'swr'
import { Iconify } from '../iconify'
import { CustomTable } from '../table/table'
import { useRouter } from 'src/routes/hooks'
import { paths } from 'src/routes/paths'

export function TransactionsTable({
    ethAddress,
    suiAddress,
}: {
    ethAddress?: string
    suiAddress?: string
}) {
    const network = getNetwork()
    const router = useRouter()
    const [page, setPage] = useState(0)
    const [totalItems, setTotalItems] = useState(0)
    const pageSize = 48

    // Fetch paginated data
    const { data, isLoading } = useSWR<{ transactions: TransactionType[]; total: number }>(
        `${endpoints.transactions}?network=${network}&offset=${pageSize * page}&limit=${pageSize}&ethAddress=${ethAddress || ''}&suiAddress=${suiAddress || ''} `,
        fetcher,
    )

    useEffect(() => {
        if (data?.total && totalItems !== data?.total) {
            setTotalItems(data?.total)
        }
    }, [data?.total])

    const onNavigateTx = (tx: string) => {
        router.push(`${paths.transactions.root}/${tx}`)
    }

    return (
        <Box>
            <CustomTable
                headLabel={[
                    { id: 'chain', label: 'Flow' },
                    { id: 'sender', label: 'Sender' },
                    { id: 'recipient', label: 'Recipient' },
                    { id: 'amount', label: 'Amount' },
                    { id: 'tx', label: 'Tx' },
                    { id: 'timestamp_ms', label: 'Date' },
                    { id: 'view', label: 'More details', align: 'center' },
                ]}
                tableData={data?.transactions || []}
                loading={isLoading}
                title={
                    (
                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Typography variant="h6" fontWeight="bold" color="primary">
                                Latest Transactions
                            </Typography>
                        </Box>
                    ) as any
                }
                rowHeight={85}
                RowComponent={props => (
                    <ActivitiesRow {...props} network={network} onNavigateTx={onNavigateTx} />
                )}
                pagination={{
                    count: totalItems,
                    page,
                    rowsPerPage: pageSize,
                    onPageChange: newPage => setPage(newPage),
                }}
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
                        alt={row.destination_chain}
                        style={{ width: 28, height: 28 }}
                    />
                </Box>
            </TableCell>

            {/* Sender with Improved Visibility */}
            <TableCell>
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
            </TableCell>

            {/* Recipient with Improved Visibility */}
            <TableCell>
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
            </TableCell>

            {/* Amount with Token Icon */}
            <TableCell>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'start',
                        padding: '4px 8px',
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
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        ≈ ${fNumber(row.amount_usd)}
                    </Typography>
                </Box>
            </TableCell>

            {/* Transaction Link */}
            <TableCell>
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
            </TableCell>

            {/* Timestamp */}
            <TableCell>
                <Typography variant="caption" fontWeight="bold" color="text.secondary">
                    {relativeTime}
                </Typography>
            </TableCell>
            <TableCell
                onClick={() => onNavigateTx(row.tx_hash)}
                style={{ cursor: 'pointer', textAlign: 'center', verticalAlign: 'middle' }}
            >
                <Box display="flex" alignItems="center" justifyContent="center">
                    <Iconify icon="solar:eye-bold" />
                </Box>
            </TableCell>
        </TableRow>
    )
}
