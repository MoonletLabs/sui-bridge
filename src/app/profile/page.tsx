'use client'
import { useState } from 'react'
import { TextField, Box } from '@mui/material'
import { TransactionsTable } from 'src/components/transactions/transactions-table'
import { DashboardContent } from 'src/layouts/dashboard'
import { AllTxsResponse } from 'src/utils/types'
import UserStatsWidgets from 'src/components/widgets/user-stats-widgets'

export default function Page() {
    const [suiAddress, setSuiAddress] = useState(
        'f6e5199d2fa1ad3d1c7fbbdb8bab85acf094c4a83aac86eac0e74a201fa45cff',
    )
    const [ethAddress, setEthAddress] = useState('')
    const [data, setData] = useState<AllTxsResponse | undefined>()

    console.log(data)

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
            {(data?.transactions?.length && (
                <UserStatsWidgets transactions={data?.transactions || []} />
            )) || <></>}
            <TransactionsTable
                suiAddress={suiAddress}
                ethAddress={ethAddress}
                onDataChange={setData}
            />
        </DashboardContent>
    )
}
