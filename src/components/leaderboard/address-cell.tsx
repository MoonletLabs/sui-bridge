import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { useState } from 'react'
import { Iconify } from 'src/components/iconify'
import { truncateAddress } from 'src/config/helper'

interface AddressCellProps {
    address: string
    addressType: 'sui' | 'eth'
    onClick?: () => void
}

export function AddressCell({ address, addressType, onClick }: AddressCellProps) {
    const theme = useTheme()
    const [copied, setCopied] = useState(false)

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation()
        try {
            // Format address with proper prefix
            const fullAddress = addressType === 'eth' ? `0x${address}` : `0x${address}`
            await navigator.clipboard.writeText(fullAddress)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy address:', err)
        }
    }

    const chainColor = addressType === 'sui' ? '#4DA2FF' : '#627EEA'
    const chainIcon =
        addressType === 'sui' ? '/assets/icons/brands/sui.svg' : '/assets/icons/brands/eth.svg'

    return (
        <Box
            onClick={onClick}
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                cursor: onClick ? 'pointer' : 'default',
                padding: '4px 8px',
                borderRadius: 1,
                transition: 'background-color 0.2s',
                '&:hover': onClick
                    ? {
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                      }
                    : {},
            }}
        >
            {/* Chain icon */}
            <Tooltip title={addressType === 'sui' ? 'SUI Address' : 'Ethereum Address'}>
                <Box
                    sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: alpha(chainColor, 0.12),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <img src={chainIcon} alt={addressType} style={{ width: 16, height: 16 }} />
                </Box>
            </Tooltip>

            {/* Address text */}
            <Typography
                variant="body2"
                sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    color: onClick ? theme.palette.primary.main : theme.palette.text.primary,
                    fontWeight: 500,
                }}
            >
                {truncateAddress(address, 6)}
            </Typography>

            {/* Copy button */}
            <Tooltip title={copied ? 'Copied!' : 'Copy address'}>
                <IconButton
                    size="small"
                    onClick={handleCopy}
                    sx={{
                        ml: 0.5,
                        p: 0.5,
                        color: copied ? 'success.main' : 'text.secondary',
                        '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                        },
                    }}
                >
                    <Iconify icon={copied ? 'eva:checkmark-fill' : 'eva:copy-fill'} width={16} />
                </IconButton>
            </Tooltip>
        </Box>
    )
}
