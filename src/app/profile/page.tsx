'use client'
import { useState } from 'react'
import { TextField, Box, Typography } from '@mui/material'
import { TransactionsTable } from 'src/components/transactions/transactions-table'
import { DashboardContent } from 'src/layouts/dashboard'
import { AllTxsResponse } from 'src/utils/types'
import UserStatsWidgets from 'src/components/widgets/user-stats-widgets'

export default function Page() {
    const [suiAddress, setSuiAddress] = useState(
        'f6e5199d2fa1ad3d1c7fbbdb8bab85acf094c4a83aac86eac0e74a201fa45cff',
    )
    const [ethAddress, setEthAddress] = useState('')

    return (
        <DashboardContent maxWidth="xl">
            <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                    label="Sui Address"
                    variant="outlined"
                    value={suiAddress}
                    onChange={e => setSuiAddress(e.target.value)}
                />
                <TextField
                    label="ETH Address"
                    variant="outlined"
                    value={ethAddress}
                    onChange={e => setEthAddress(e.target.value)}
                />
            </Box>
            {((suiAddress || ethAddress) && (
                <>
                    <UserStatsWidgets suiAddress={suiAddress} ethAddress={ethAddress} />
                    <TransactionsTable suiAddress={suiAddress} ethAddress={ethAddress} />
                </>
            )) || (
                <>
                    <Box
                        sx={{
                            alignContent: 'center',
                            alignItems: 'center',
                            display: 'flex',
                            flex: 1,
                            alignSelf: 'center',
                        }}
                    >
                        <Typography variant={'h4'}>
                            Please select an Ethereum / SUI address
                        </Typography>
                    </Box>
                </>
            )}
        </DashboardContent>
    )
}
