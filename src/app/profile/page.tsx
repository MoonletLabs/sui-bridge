'use client'
import { useState } from 'react'
import { TextField, Box, Typography, InputAdornment, IconButton, Grid } from '@mui/material'
import { TransactionsTable } from 'src/components/transactions/transactions-table'
import { DashboardContent } from 'src/layouts/dashboard'
import UserStatsWidgets from 'src/components/widgets/user-stats-widgets'
import { Iconify } from 'src/components/iconify'
import { useSearchParams } from 'next/navigation'

export default function Page() {
    const searchParams = useSearchParams()

    const [suiAddress, setSuiAddress] = useState(searchParams?.get('suiAddress') || '')
    const [ethAddress, setEthAddress] = useState(searchParams?.get('ethAddress') || '')

    const handlePasteSui = async () => {
        try {
            const text = await navigator.clipboard.readText()
            setSuiAddress(text)
        } catch (error) {
            console.error('Failed to read clipboard contents: ', error)
        }
    }

    const handleClearSui = () => {
        setSuiAddress('')
    }

    const handlePasteEth = async () => {
        try {
            const text = await navigator.clipboard.readText()
            setEthAddress(text)
        } catch (error) {
            console.error('Failed to read clipboard contents: ', error)
        }
    }

    const handleClearEth = () => {
        setEthAddress('')
    }

    return (
        <DashboardContent maxWidth="xl">
            <Grid container spacing={3} sx={{ marginBottom: 5 }}>
                {/* <Box sx={{ mb: 2, display: 'flex', flexDirection: 'row', gap: 2 }}> */}
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Sui Address"
                        variant="outlined"
                        value={suiAddress}
                        placeholder="6a44..."
                        onChange={e => setSuiAddress(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <img
                                        src="/assets/icons/brands/sui.svg"
                                        alt="SUI logo"
                                        style={{
                                            width: 24,
                                            height: 24,
                                            marginLeft: 1,
                                            marginRight: 1,
                                        }}
                                    />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={handlePasteSui} edge="end">
                                        <Iconify
                                            icon="mdi:content-paste"
                                            width={24}
                                            height={24}
                                            style={{ marginRight: 8 }}
                                        />
                                    </IconButton>
                                    <IconButton onClick={handleClearSui} edge="end">
                                        <Iconify
                                            icon="mdi:close-circle-outline"
                                            width={24}
                                            height={24}
                                        />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Ethereum Address"
                        variant="outlined"
                        placeholder="0x..."
                        value={ethAddress}
                        onChange={e => setEthAddress(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <img
                                        src="/assets/icons/brands/eth.svg"
                                        alt="ETH logo"
                                        style={{
                                            width: 24,
                                            height: 24,
                                            marginLeft: 1,
                                            marginRight: 1,
                                        }}
                                    />
                                </InputAdornment>
                            ),
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={handlePasteEth} edge="end">
                                        <Iconify
                                            icon="mdi:content-paste"
                                            width={24}
                                            height={24}
                                            style={{ marginRight: 8 }}
                                        />
                                    </IconButton>
                                    <IconButton onClick={handleClearEth} edge="end">
                                        <Iconify
                                            icon="mdi:close-circle-outline"
                                            width={24}
                                            height={24}
                                        />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                </Grid>
            </Grid>
            {suiAddress || ethAddress ? (
                <>
                    <UserStatsWidgets suiAddress={suiAddress} ethAddress={ethAddress} />
                    <TransactionsTable suiAddress={suiAddress} ethAddress={ethAddress} />
                </>
            ) : (
                <Box
                    sx={{
                        alignContent: 'center',
                        alignItems: 'center',
                        display: 'flex',
                        flex: 1,
                        alignSelf: 'center',
                        textAlign: 'center',
                    }}
                >
                    <Iconify
                        icon="solar:wallet-linear"
                        width={30}
                        height={30}
                        color={'#00c4e5'}
                        style={{ marginRight: 8 }}
                    />

                    <Typography variant="h4">
                        Please select a Sui address or an Ethereum address.
                    </Typography>
                </Box>
            )}
        </DashboardContent>
    )
}
