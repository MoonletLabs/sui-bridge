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
import { useTokenRegistry } from 'src/hooks/use-token-registry'
import type { PageFilters } from '../config-page-filters'

// Defaults of the global filters (see global-provider)
const DEFAULT_PERIOD: TimePeriod = 'Last Month'
const isAllTokens = (tokens: string[]) =>
    tokens.length === 0 || (tokens.length === 1 && tokens[0] === 'All')

/** "All tokens", "ETH", or "ETH +2" - short enough for the header */
const summarizeTokens = (tokens: string[]) => {
    if (isAllTokens(tokens)) return 'All tokens'
    if (tokens.length === 1) return tokens[0]
    return `${tokens[0]} +${tokens.length - 1}`
}

function useTokenOptions() {
    const network = getNetwork()
    // Include tokens listed after the bundled config was built
    useTokenRegistry()
    return [{ name: 'All' }, ...getTokensList(network).map(i => ({ name: i.ticker, icon: i.icon }))]
}

/**
 * Inline filters for wide screens: the current period and token selection are
 * always visible, and each opens its own menu.
 */
function InlineFilters({ filters }: { filters: PageFilters }) {
    const theme = useTheme()
    const { timePeriod, setTimePeriod, selectedTokens, setSelectedTokens } = useGlobalContext()
    const tokenOptions = useTokenOptions()

    // Tint the border of a filter that differs from its default, so a narrowed
    // view is noticeable at a glance
    const activeBorder = `1px solid ${alpha(theme.palette.primary.main, 0.6)}`

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {filters.period && (
                <ChartSelect
                    options={TIME_PERIODS}
                    value={timePeriod}
                    onChange={v => setTimePeriod(v as TimePeriod)}
                    slotProps={{
                        button: {
                            mr: 0,
                            height: 36,
                            gap: 0.75,
                            ...(timePeriod !== DEFAULT_PERIOD && { border: activeBorder }),
                        },
                    }}
                />
            )}
            {filters.tokens && (
                <MultiSelect
                    options={tokenOptions}
                    allOption="All"
                    value={selectedTokens}
                    onChange={setSelectedTokens}
                    renderValue={summarizeTokens}
                    slotProps={{
                        button: {
                            mr: 0,
                            width: 'auto',
                            height: 36,
                            gap: 0.75,
                            ...(!isAllTokens(selectedTokens) && { border: activeBorder }),
                        },
                    }}
                />
            )}
        </Box>
    )
}

/** Collapsed filters (small screens): one icon that opens a panel with only the relevant controls */
export function FilterPopover({ filters }: { filters: PageFilters }) {
    const theme = useTheme()
    const { timePeriod, setTimePeriod, selectedTokens, setSelectedTokens } = useGlobalContext()
    const tokenOptions = useTokenOptions()
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)

    const open = Boolean(anchorEl)

    const handleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget)
    }

    const handleClose = () => {
        setAnchorEl(null)
    }

    // Only filters that apply to this page count towards the "active" dot
    const hasActiveFilters =
        (filters.period && timePeriod !== DEFAULT_PERIOD) ||
        (filters.tokens && !isAllTokens(selectedTokens))

    return (
        <>
            <IconButton
                onClick={handleOpen}
                aria-label="Open filters"
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

                <Stack spacing={2.5} divider={<Divider sx={{ borderStyle: 'dashed' }} />}>
                    {filters.period && (
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
                    )}

                    {filters.tokens && (
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
                                options={tokenOptions}
                                allOption="All"
                                value={selectedTokens}
                                onChange={setSelectedTokens}
                                slotProps={{
                                    button: {
                                        width: '100%',
                                        justifyContent: 'space-between',
                                        mr: 0,
                                    },
                                }}
                            />
                        </Box>
                    )}
                </Stack>
            </Popover>
        </>
    )
}

/**
 * Header filters for the current page. Wide screens get inline selects, smaller
 * ones a single icon. Both are rendered and swapped with CSS (not a JS media
 * query) so server and client markup always match.
 */
export function HeaderFilters({ filters }: { filters: PageFilters }) {
    if (!filters.period && !filters.tokens) return null

    return (
        <>
            <Box sx={{ display: { xs: 'none', lg: 'flex' } }}>
                <InlineFilters filters={filters} />
            </Box>
            <Box sx={{ display: { xs: 'flex', lg: 'none' } }}>
                <FilterPopover filters={filters} />
            </Box>
        </>
    )
}
