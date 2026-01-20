'use client'

import { useState } from 'react'
import type { Theme, SxProps } from '@mui/material/styles'

import { useTheme } from '@mui/material/styles'
import { Box, AppBar, Toolbar, Container, useMediaQuery } from '@mui/material'

import { Logo } from 'src/components/logo'
import { ChartSelect } from 'src/components/chart'
import { MultiSelect } from 'src/components/selectors/multi-select'
import { getTokensList } from 'src/utils/types'
import { useGlobalContext } from 'src/provider/global-provider'
import { getNetwork } from 'src/hooks/get-network-storage'
import { TIME_PERIODS, TimePeriod } from 'src/config/helper'
import { NetworkPopover } from '../components/network-popover'
import { NavTabs, MobileNavToggle, MobileNavMenu } from '../components/nav-tabs'
import { layoutClasses } from '../classes'
import { varAlpha } from 'src/theme/styles'

// ----------------------------------------------------------------------

export type DashboardLayoutProps = {
    sx?: SxProps<Theme>
    children: React.ReactNode
    disableTimelines?: boolean
}

export function DashboardLayout({ sx, children, disableTimelines }: DashboardLayoutProps) {
    const network = getNetwork()
    const theme = useTheme()
    const { timePeriod, setTimePeriod, selectedTokens, setSelectedTokens } = useGlobalContext()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <Box
            id="root__layout"
            className={layoutClasses.root}
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                ...sx,
            }}
        >
            {/* Header */}
            <AppBar
                position="sticky"
                className={layoutClasses.header}
                sx={{
                    zIndex: theme.zIndex.appBar,
                    backgroundColor: theme.palette.background.default,
                    boxShadow: 'none',
                    borderBottom: mobileMenuOpen
                        ? 'none'
                        : `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.12)}`,
                }}
            >
                <Container maxWidth="xl" sx={{ px: { xs: 1.5, sm: 2, md: 3 } }}>
                    {/* Main toolbar row */}
                    <Toolbar
                        disableGutters
                        sx={{
                            minHeight: { xs: 56, md: 64 },
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: { xs: 1, md: 2 },
                        }}
                    >
                        {/* Left: Toggle (mobile) + Logo */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {isMobile && (
                                <MobileNavToggle
                                    open={mobileMenuOpen}
                                    onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
                                />
                            )}
                            <Logo single={isMobile} />
                        </Box>

                        {/* Center: Navigation Tabs (desktop only) */}
                        {!isMobile && <NavTabs />}

                        {/* Right: Filters & Network */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: { xs: 0.5, md: 1.5 },
                            }}
                        >
                            {!disableTimelines && (
                                <>
                                    <ChartSelect
                                        options={TIME_PERIODS}
                                        value={timePeriod}
                                        onChange={newVal => setTimePeriod(newVal as TimePeriod)}
                                    />
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
                                    />
                                </>
                            )}
                            <NetworkPopover />
                        </Box>
                    </Toolbar>
                </Container>

                {/* Mobile Navigation Menu (expandable) */}
                {isMobile && (
                    <MobileNavMenu open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
                )}
            </AppBar>

            {/* Main Content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    py: { xs: 2, md: 3 },
                    px: { xs: 1.5, sm: 2, lg: 5 },
                }}
            >
                <Container maxWidth="xl" disableGutters>
                    {children}
                </Container>
            </Box>
        </Box>
    )
}
