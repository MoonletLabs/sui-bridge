import { Box, Link, TableCell, TableRow, Typography } from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { useEffect, useState } from 'react'
import { formatExplorerUrl, truncateAddress } from 'src/config/helper'
import { getNetwork } from 'src/hooks/get-network-storage'
import { endpoints, fetcher } from 'src/utils/axios'
import { fNumber } from 'src/utils/format-number'
import { getTokensList, TransactionType } from 'src/utils/types'
import useSWR from 'swr'
import { Iconify } from '../iconify'
import { CustomTable } from '../table/table'

export function TransactionsTable() {
    const network = getNetwork()
    const [page, setPage] = useState(0)
    const [totalItems, setTotalItems] = useState(0)
    const pageSize = 48

    // Fetch paginated data
    const { data, isLoading } = useSWR<{ transactions: TransactionType[]; total: number }>(
        `${endpoints.transactions}?network=${network}&offset=${pageSize * page}&limit=${pageSize}`,
        fetcher,
    )

    useEffect(() => {
        if (data?.total && totalItems !== data?.total) {
            setTotalItems(data?.total)
        }
    }, [data?.total])

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
                ]}
                tableData={data?.transactions || []}
                loading={isLoading}
                title={
                    (
                        <Box
                            display="flex"
                            position={'relative'}
                            alignItems="center"
                            justifyContent="space-between"
                        >
                            <Typography variant="h6">Transactions</Typography>
                        </Box>
                    ) as any
                }
                // rows={pageSize}
                rowHeight={77}
                RowComponent={ActivitiesRow}
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

const ActivitiesRow: React.FC<{ row: TransactionType }> = ({ row }) => {
    const network = getNetwork()
    const relativeTime = formatDistanceToNow(Number(row.timestamp_ms), { addSuffix: true })
    const isInflow = row.destination_chain === 'SUI'

    return (
        <TableRow hover sx={{ height: 77 }}>
            <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <img
                        src={`/assets/icons/brands/eth.svg`}
                        alt={row.from_chain}
                        style={{ width: 25, height: 25 }}
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
                        style={{ width: 25, height: 25 }}
                    />
                </Box>
            </TableCell>

            <TableCell>
                <Link
                    href={formatExplorerUrl({
                        network,
                        address: row.sender_address,
                        isAccount: true,
                        chain: isInflow ? 'ETH' : 'SUI',
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="hover"
                    color="inherit"
                >
                    {truncateAddress(row.sender_address)}
                </Link>
            </TableCell>

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
                    color="inherit"
                >
                    {truncateAddress(row.recipient_address)}
                </Link>
            </TableCell>

            <TableCell>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'start' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {row.token_info.name && (
                            <img
                                src={
                                    getTokensList(network)?.find(
                                        it => it.ticker === row.token_info.name,
                                    )?.icon
                                }
                                alt={row.token_info.name}
                                style={{ width: 16, height: 16, marginRight: 4 }}
                            />
                        )}
                        <Typography variant="body2">{fNumber(row.amount)}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        ${fNumber(row.amount_usd)}
                    </Typography>
                </Box>
            </TableCell>

            <TableCell>
                <Link
                    href={formatExplorerUrl({
                        network,
                        address: row.tx_hash,
                        isAccount: false,
                        chain: isInflow ? 'ETH' : 'SUI',
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="hover"
                    color="inherit"
                >
                    {truncateAddress(row.tx_hash)}
                </Link>
            </TableCell>

            <TableCell>{relativeTime}</TableCell>
        </TableRow>
    )
}
