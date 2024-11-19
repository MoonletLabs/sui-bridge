'use client'

import type { NavSectionProps } from 'src/components/nav-section'
import type { Theme, SxProps, Breakpoint } from '@mui/material/styles'

import Alert from '@mui/material/Alert'
import { useTheme } from '@mui/material/styles'
import { iconButtonClasses } from '@mui/material/IconButton'

import { useBoolean } from 'src/hooks/use-boolean'

import { _contacts, _notifications } from 'src/_mock'

import { Logo } from 'src/components/logo'
import { useSettingsContext } from 'src/components/settings'

import { Main } from './main'
import { NavMobile } from './nav-mobile'
import { layoutClasses } from '../classes'
import { NavVertical } from './nav-vertical'
import { NavHorizontal } from './nav-horizontal'
import { _account } from '../config-nav-account'
import { _workspaces } from '../config-nav-workspace'
import { MenuButton } from '../components/menu-button'
import { LayoutSection } from '../core/layout-section'
import { HeaderSection } from '../core/header-section'
import { StyledDivider, useNavColorVars } from './styles'
import { navData as dashboardNavData } from '../config-nav-dashboard'
import { NetworkPopover } from '../components/network-popover'
import { Grid } from '@mui/material'
import { ChartSelect } from 'src/components/chart'
import { MultiSelect } from 'src/components/selectors/multi-select'
import { useGlobalContext } from 'src/provider/global-provider'
import { getNetwork } from 'src/hooks/get-network-storage'
import { getNetworkConfig } from 'src/config/helper'
// ----------------------------------------------------------------------

export type DashboardLayoutProps = {
    sx?: SxProps<Theme>
    children: React.ReactNode
    header?: {
        sx?: SxProps<Theme>
    }
    data?: {
        nav?: NavSectionProps['data']
    }
}

export function DashboardLayout({ sx, children, header, data }: DashboardLayoutProps) {
    const network = getNetwork()
    const networkConfig = getNetworkConfig({ network })

    const { timePeriod, setTimePeriod, selectedTokens, setSelectedTokens } = useGlobalContext()

    const theme = useTheme()

    const mobileNavOpen = useBoolean()

    const settings = useSettingsContext()

    const navColorVars = useNavColorVars(theme, settings)

    const layoutQuery: Breakpoint = 'lg'

    const navData = data?.nav ?? dashboardNavData

    const isNavMini = settings.navLayout === 'mini'
    const isNavHorizontal = settings.navLayout === 'horizontal'
    const isNavVertical = isNavMini || settings.navLayout === 'vertical'

    return (
        <LayoutSection
            /** **************************************
             * Header
             *************************************** */
            headerSection={
                <HeaderSection
                    layoutQuery={layoutQuery}
                    disableElevation={isNavVertical}
                    slotProps={{
                        toolbar: {
                            sx: {
                                ...(isNavHorizontal && {
                                    bgcolor: 'var(--layout-nav-bg)',
                                    [`& .${iconButtonClasses.root}`]: {
                                        color: 'var(--layout-nav-text-secondary-color)',
                                    },
                                    [theme.breakpoints.up(layoutQuery)]: {
                                        height: 'var(--layout-nav-horizontal-height)',
                                    },
                                }),
                            },
                        },
                        container: {
                            maxWidth: false,
                            sx: {
                                ...(isNavVertical && { px: { [layoutQuery]: 5 } }),
                            },
                        },
                    }}
                    sx={header?.sx}
                    slots={{
                        topArea: (
                            <Alert severity="info" sx={{ display: 'none', borderRadius: 0 }}>
                                This is an info Alert.
                            </Alert>
                        ),
                        bottomArea: isNavHorizontal ? (
                            <NavHorizontal
                                data={navData}
                                layoutQuery={layoutQuery}
                                cssVars={navColorVars.section}
                            />
                        ) : null,
                        leftArea: (
                            <>
                                {/* -- Nav mobile -- */}
                                <MenuButton
                                    onClick={mobileNavOpen.onTrue}
                                    sx={{
                                        mr: 0,
                                        ml: -1,
                                        [theme.breakpoints.up(layoutQuery)]: { display: 'none' },
                                    }}
                                />
                                <NavMobile
                                    data={navData}
                                    open={mobileNavOpen.value}
                                    onClose={mobileNavOpen.onFalse}
                                    cssVars={navColorVars.section}
                                />
                                {/* -- Logo -- */}
                                {isNavHorizontal && (
                                    <Logo
                                        sx={{
                                            display: 'none',
                                            [theme.breakpoints.up(layoutQuery)]: {
                                                display: 'inline-flex',
                                            },
                                        }}
                                    />
                                )}
                                {/* -- Divider -- */}
                                {/* {isNavHorizontal && (
                                    <StyledDivider
                                        sx={{
                                            [theme.breakpoints.up(layoutQuery)]: {
                                                display: 'flex',
                                            },
                                        }}
                                    />
                                )} */}
                            </>
                        ),
                        rightArea: (
                            <>
                                <ChartSelect
                                    options={[
                                        'Last 24h',
                                        'Last Week',
                                        'Last Month',
                                        'Year to date',
                                        'All time',
                                    ]}
                                    value={timePeriod}
                                    onChange={newVal => setTimePeriod(newVal)}
                                />
                                <MultiSelect
                                    options={[
                                        { name: 'All' },
                                        ...Object.values(networkConfig?.config?.coins),
                                    ]}
                                    allOption="All"
                                    value={selectedTokens}
                                    onChange={setSelectedTokens}
                                />
                                <NetworkPopover />
                            </>
                        ),
                    }}
                />
            }
            /** **************************************
             * Sidebar
             *************************************** */
            sidebarSection={
                isNavHorizontal ? null : (
                    <NavVertical
                        data={navData}
                        isNavMini={isNavMini}
                        layoutQuery={layoutQuery}
                        cssVars={navColorVars.section}
                        onToggleNav={() =>
                            settings.onUpdateField(
                                'navLayout',
                                settings.navLayout === 'vertical' ? 'mini' : 'vertical',
                            )
                        }
                    />
                )
            }
            /** **************************************
             * Footer
             *************************************** */
            footerSection={null}
            /** **************************************
             * Style
             *************************************** */
            cssVars={{
                ...navColorVars.layout,
                '--layout-transition-easing': 'linear',
                '--layout-transition-duration': '120ms',
                '--layout-nav-mini-width': '88px',
                '--layout-nav-vertical-width': '200px',
                '--layout-nav-horizontal-height': '64px',
                '--layout-dashboard-content-pt': theme.spacing(1),
                '--layout-dashboard-content-pb': theme.spacing(8),
                '--layout-dashboard-content-px': theme.spacing(5),
            }}
            sx={{
                [`& .${layoutClasses.hasSidebar}`]: {
                    [theme.breakpoints.up(layoutQuery)]: {
                        transition: theme.transitions.create(['padding-left'], {
                            easing: 'var(--layout-transition-easing)',
                            duration: 'var(--layout-transition-duration)',
                        }),
                        pl: isNavMini
                            ? 'var(--layout-nav-mini-width)'
                            : 'var(--layout-nav-vertical-width)',
                    },
                },
                ...sx,
            }}
        >
            <Main isNavHorizontal={isNavHorizontal}>{children}</Main>
        </LayoutSection>
    )
}
