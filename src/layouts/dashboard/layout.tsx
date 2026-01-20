'use client'

import { useState } from 'react'
import type { Theme, SxProps } from '@mui/material/styles'

import { useTheme } from '@mui/material/styles'
import { Box, AppBar, Toolbar, Container, useMediaQuery } from '@mui/material'

import { Logo } from 'src/components/logo'
import { NetworkPopover } from '../components/network-popover'
import { FilterPopover } from '../components/filter-popover'
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
    const theme = useTheme()
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
                            gap: { xs: 1, md: 2 },
                        }}
                    >
                        {/* Left section - fixed width */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                minWidth: { xs: 'auto', md: 160 },
                            }}
                        >
                            {isMobile && (
                                <MobileNavToggle
                                    open={mobileMenuOpen}
                                    onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
                                />
                            )}
                            <Logo single={isMobile} />
                        </Box>

                        {/* Center section - Navigation Tabs (desktop only) */}
                        {!isMobile && (
                            <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                <NavTabs />
                            </Box>
                        )}

                        {/* Spacer for mobile */}
                        {isMobile && <Box sx={{ flex: 1 }} />}

                        {/* Right section - fixed width */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                minWidth: { xs: 'auto', md: 160 },
                                justifyContent: 'flex-end',
                            }}
                        >
                            {!disableTimelines && <FilterPopover />}
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
                    display: 'flex',
                    flexDirection: 'column',
                    flexGrow: 1,
                    py: { xs: 2, md: 3 },
                    px: { xs: 1.5, sm: 2, lg: 5 },
                }}
            >
                <Container
                    maxWidth="xl"
                    disableGutters
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: '1 1 auto',
                    }}
                >
                    {children}
                </Container>
            </Box>
        </Box>
    )
}
