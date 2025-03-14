'use client'
import { useState } from 'react'
import { TextField, Box } from '@mui/material'
import { TransactionsTable } from 'src/components/transactions/transactions-table'
import { DashboardContent } from 'src/layouts/dashboard'

export default function Page() {
    const [suiAddress, setSuiAddress] = useState('0x24089889eE9dc4C20Ab20C871686B03AF2D204c2')
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
            <TransactionsTable suiAddress={suiAddress} ethAddress={ethAddress} />
        </DashboardContent>
    )
}
