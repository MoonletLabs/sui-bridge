import { Box, Link, TableCell, TableRow, Typography, keyframes } from '@mui/material'
import { formatDistanceToNow } from 'date-fns'
import { fNumber } from 'src/utils/format-number'
// import { truncateAddress, formatTransactionType } from 'src/utils/helper'
import { useRouter } from 'next/navigation'
import { formatExplorerUrl, truncateAddress } from 'src/config/helper'
import { getNetwork } from 'src/hooks/get-network-storage'
import { endpoints, fetcher } from 'src/utils/axios'
import { getTokensList, TransactionType } from 'src/utils/types'
import useSWR from 'swr'
import { CustomTable } from '../table/table'
import { Iconify } from '../iconify'

type RowComponentProps = {
    row: TransactionType
}

const blink = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0; }
  100% { opacity: 1; }
`

export function TransactionsTable() {
    const network = getNetwork()
    const { data, isLoading } = useSWR<TransactionType[]>(
        `${endpoints.transactions}?network=${network}`,
        fetcher,
    )

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
                tableData={data || []}
                loading={isLoading}
                title={
                    (
                        <Box
                            display="flex"
                            position={'relative'}
                            alignItems="center"
                            justifyContent="space-between"
                        >
                            {/* Main Title */}
                            <Typography variant="h6">Transactions</Typography>

                            {/* Blinking "Live" Indicator */}
                            {/* <Typography
                                variant="body2"
                                sx={{
                                    position: 'absolute',
                                    top: -10,
                                    left: 70,
                                    color: 'red', // You can choose any color you prefer
                                    fontWeight: 'bold',
                                    animation: `${blink} 1s infinite`, // Apply the blinking animation
                                }}
                            >
                                Live
                            </Typography> */}
                        </Box>
                    ) as any
                }
                rows={24}
                // hidePagination={true}
                rowHeight={77}
                RowComponent={ActivitiesRow}
            />
        </Box>
    )
}

const ActivitiesRow: React.FC<RowComponentProps> = ({ row }) => {
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
                        sx={{
                            flexShrink: 0,
                            color: isInflow ? '#38B137' : '#FA3913',
                            // marginRight: 1,
                            alignContent: 'center',
                            alignSelf: 'center',
                        }}
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
                    sx={
                        {
                            // textDecoration: truncatedBuyer && 'underline',
                            // color: truncatedBuyer && '#0294fd',
                        }
                    }
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
                    sx={
                        {
                            // textDecoration: truncateMint && 'underline',
                            // color: truncateMint && '#0294fd',
                        }
                    }
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
                    sx={
                        {
                            // textDecoration: 'underline', color: '#0294fd'
                        }
                    }
                >
                    {truncateAddress(row.tx_hash)}
                </Link>
            </TableCell>
            <TableCell>{relativeTime}</TableCell>
        </TableRow>
    )
}
