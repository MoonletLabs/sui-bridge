'use client'

import { useState } from 'react'
import { Box, IconButton, Popover, Typography, Badge, Divider, Stack } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { Iconify } from 'src/components/iconify'
import { ChartSelect } from 'src/components/chart'
import { MultiSelect } from 'src/components/selectors/multi-select'
import { getTokensList } from 'src/utils/types'
import { useGlobalContext } from 'src/provider/global-provider'
import { getNetwork } from 'src/hooks/get-network-storage'
import { TIME_PERIODS, TimePeriod } from 'src/config/helper'

export function FilterPopover() {
    const theme = useTheme()
    const network = getNetwork()
    const { timePeriod, setTimePeriod, selectedTokens, setSelectedTokens } = useGlobalContext()
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)

    const open = Boolean(anchorEl)

    const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget)
    }

    const handleClose = () => {
        setAnchorEl(null)
    }

    // Check if any non-default filters are applied
    const hasActiveFilters = timePeriod !== 'Last Week' || selectedTokens.length > 0

    return (
        <>
            <IconButton
                onClick={handleOpen}
                sx={{
                    width: 40,
                    height: 40,
                    border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
                    borderRadius: 1.5,
                    backgroundColor: open ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    },
                }}
            >
                <Badge
                    variant="dot"
                    color="primary"
                    invisible={!hasActiveFilters}
                    sx={{
                        '& .MuiBadge-dot': {
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                        },
                    }}
                >
                    <Iconify
                        icon="solar:filter-bold"
                        width={20}
                        sx={{
                            color: open ? theme.palette.primary.main : theme.palette.text.secondary,
                        }}
                    />
                </Badge>
            </IconButton>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 1.5,
                            p: 2.5,
                            width: 280,
                            borderRadius: 2,
                            boxShadow: theme.customShadows.dropdown,
                        },
                    },
                }}
            >
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                    Filters
                </Typography>

                <Stack spacing={2.5}>
                    {/* Time Period */}
                    <Box>
                        <Typography
                            variant="caption"
                            fontWeight={600}
                            color="text.secondary"
                            sx={{ mb: 1, display: 'block' }}
                        >
                            Time Period
                        </Typography>
                        <ChartSelect
                            options={TIME_PERIODS}
                            value={timePeriod}
                            onChange={newVal => setTimePeriod(newVal as TimePeriod)}
                            slotProps={{
                                button: { width: '100%', justifyContent: 'space-between' },
                            }}
                        />
                    </Box>

                    <Divider sx={{ borderStyle: 'dashed' }} />

                    {/* Token Filter */}
                    <Box>
                        <Typography
                            variant="caption"
                            fontWeight={600}
                            color="text.secondary"
                            sx={{ mb: 1, display: 'block' }}
                        >
                            Tokens
                        </Typography>
                        <MultiSelect
                            options={[
                                { name: 'All' },
                                ...getTokensList(network).map(i => ({
                                    name: i.ticker,
                                    icon: i.icon,
                                })),
                            ]}
                            allOption="All"
                            value={selectedTokens}
                            onChange={setSelectedTokens}
                            slotProps={{
                                button: { width: '100%', justifyContent: 'space-between', mr: 0 },
                            }}
                        />
                    </Box>
                </Stack>
            </Popover>
        </>
    )
}
