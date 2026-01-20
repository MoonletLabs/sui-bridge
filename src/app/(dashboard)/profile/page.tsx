'use client'

import { Suspense } from 'react'
import {
    Box,
    Button,
    Grid,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
    Typography,
} from '@mui/material'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Iconify } from 'src/components/iconify'
import { TransactionsTable } from 'src/components/transactions/transactions-table'
import UserStatsWidgets from 'src/components/widgets/user-stats-widgets'
import { DashboardContent } from 'src/layouts/dashboard'
// Ethereum
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount as useEthAccount, useDisconnect as useEthDisconnect } from 'wagmi'
// Sui
import { useTheme } from '@mui/material/styles'
import {
    ConnectModal,
    useDisconnectWallet,
    useCurrentAccount as useSuiAccount,
} from '@mysten/dapp-kit'
import '@mysten/dapp-kit/dist/index.css'
import '@rainbow-me/rainbowkit/styles.css'
import { useState as useReactState } from 'react'
import { SplashScreen } from 'src/components/loading-screen'

type WalletActionButtonProps = {
    label: string
    color: 'info' | 'error'
    onClick?: () => void
    icon?: string
    disabled?: boolean
    sx?: any
}

function WalletActionButton({
    label,
    color,
    onClick,
    icon,
    disabled,
    sx,
}: WalletActionButtonProps) {
    const theme = useTheme()
    return (
        <Button
            variant="contained"
            color={color}
            onClick={onClick}
            disabled={disabled}
            startIcon={
                icon ? (
                    <img
                        src={icon}
                        alt="logo"
                        width={24}
                        height={24}
                        style={{ display: 'block' }}
                    />
                ) : undefined
            }
            sx={{
                minWidth: 140,
                height: 48,
                borderRadius: 2.5,
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: 0.5,
                px: 3,
                background: color === 'info' ? theme.palette.info.main : '#9a331f',
                color:
                    color === 'info'
                        ? theme.palette.info.contrastText
                        : color === 'error'
                          ? theme.palette.error.contrastText
                          : undefined,
                transition: 'background 0.2s',
                ml: color === 'info' ? 1 : 2,
                textTransform: 'none',
                ...sx,
            }}
        >
            {label}
        </Button>
    )
}

const SUI_LOGO_PATH = '/assets/icons/brands/sui.svg'
const ETH_LOGO_PATH = '/assets/icons/brands/eth.svg'

function ProfileContent() {
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

    const ethAccount = useEthAccount()
    const { disconnect: disconnectEth } = useEthDisconnect()
    const suiAccount = useSuiAccount()
    const { mutate: disconnectSui } = useDisconnectWallet()
    const [suiModalOpen, setSuiModalOpen] = useReactState(false)
    const { openConnectModal } = useConnectModal()

    // Autofill when connected
    useEffect(() => {
        if (ethAccount.address) setEthAddress(ethAccount.address)
    }, [ethAccount.address])

    useEffect(() => {
        if (suiAccount?.address) setSuiAddress(suiAccount.address)
    }, [suiAccount?.address])

    return (
        <DashboardContent maxWidth="xl">
            <Grid container spacing={3} sx={{ marginBottom: 5 }}>
                {/* Sui Address Field and Connect Button */}
                <Grid item xs={12} md={6}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
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
                        <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ width: { xs: '100%', sm: 'auto' }, mt: { xs: 1, sm: 0 } }}
                        >
                            {!suiAccount?.address && <Typography variant="body2">OR</Typography>}
                            {!suiAccount?.address && (
                                <>
                                    <WalletActionButton
                                        label="Connect"
                                        color="info"
                                        onClick={() => setSuiModalOpen(!suiModalOpen)}
                                        icon={SUI_LOGO_PATH}
                                        disabled={!!suiAccount?.address}
                                    />
                                    <ConnectModal
                                        open={suiModalOpen}
                                        onOpenChange={setSuiModalOpen}
                                        trigger={<></>}
                                    />
                                </>
                            )}
                            {suiAccount?.address && (
                                <WalletActionButton
                                    label="Disconnect"
                                    color="error"
                                    onClick={() => {
                                        disconnectSui()
                                        setSuiAddress('')
                                        setSuiModalOpen(false)
                                    }}
                                />
                            )}
                        </Stack>
                    </Stack>
                </Grid>
                {/* Ethereum Address Field and Connect Button */}
                <Grid item xs={12} md={6}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
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
                        <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ width: { xs: '100%', sm: 'auto' }, mt: { xs: 1, sm: 0 } }}
                        >
                            {!ethAccount.isConnected && <Typography variant="body2">OR</Typography>}
                            {!ethAccount.isConnected && (
                                <WalletActionButton
                                    label="Connect"
                                    color="info"
                                    onClick={openConnectModal || (() => {})}
                                    icon={ETH_LOGO_PATH}
                                />
                            )}
                            {ethAccount.isConnected && (
                                <WalletActionButton
                                    label="Disconnect"
                                    color="error"
                                    onClick={() => {
                                        disconnectEth()
                                        setEthAddress('')
                                    }}
                                />
                            )}
                        </Stack>
                    </Stack>
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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '60vh',
                        width: '100%',
                        flexDirection: 'column',
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
                        Connect a Sui or Ethereum wallet to view the history.
                    </Typography>
                </Box>
            )}
        </DashboardContent>
    )
}

export default function Page() {
    return (
        <Suspense fallback={<SplashScreen />}>
            <ProfileContent />
        </Suspense>
    )
}
