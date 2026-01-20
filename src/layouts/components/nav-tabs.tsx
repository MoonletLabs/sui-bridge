'use client'

import { usePathname } from 'next/navigation'
import {
    Tab,
    Tabs,
    Box,
    Collapse,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
} from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'
import { RouterLink } from 'src/routes/components'
import { paths } from 'src/routes/paths'
import { SvgColor } from 'src/components/svg-color'
import { CONFIG } from 'src/config-global'
import { Iconify } from 'src/components/iconify'

// Use the same icon helper as config-nav-dashboard
const icon = (name: string) => (
    <SvgColor src={`${CONFIG.assetsDir}/assets/icons/navbar/${name}.svg`} />
)

const NAV_ITEMS = [
    {
        label: 'Bridge Dashboard',
        path: '/',
        icon: icon('ic-analytics'),
    },
    {
        label: 'Bridge Transactions',
        path: paths.transactions.root,
        icon: icon('ic-parameter'),
    },
    {
        label: 'Profile',
        path: paths.profile.root,
        icon: icon('ic-course'),
    },
]

// Desktop Navigation Tabs
export function NavTabs() {
    const theme = useTheme()
    const pathname = usePathname()

    // Determine active tab based on pathname
    const activeTab = NAV_ITEMS.findIndex(item => {
        if (item.path === '/') {
            return pathname === '/'
        }
        return pathname?.startsWith(item.path) ?? false
    })

    return (
        <Tabs
            value={activeTab === -1 ? 0 : activeTab}
            sx={{
                minHeight: 48,
                '& .MuiTabs-indicator': {
                    backgroundColor: theme.palette.primary.main,
                    height: 3,
                    borderRadius: '3px 3px 0 0',
                },
                '& .MuiTabs-flexContainer': {
                    gap: 1,
                },
                '& .MuiTab-root': {
                    minHeight: 48,
                    minWidth: 120,
                    px: 2.5,
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    textTransform: 'none',
                    color: theme.palette.text.secondary,
                    '&.Mui-selected': {
                        color: theme.palette.primary.main,
                    },
                    '&:hover': {
                        color: theme.palette.primary.main,
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    },
                },
            }}
        >
            {NAV_ITEMS.map(item => (
                <Tab
                    key={item.path}
                    label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                                sx={{
                                    width: 22,
                                    height: 22,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {item.icon}
                            </Box>
                            {item.label}
                        </Box>
                    }
                    component={RouterLink}
                    href={item.path}
                />
            ))}
        </Tabs>
    )
}

// Mobile Navigation Toggle Button
interface MobileNavToggleProps {
    open: boolean
    onToggle: () => void
}

export function MobileNavToggle({ open, onToggle }: MobileNavToggleProps) {
    const theme = useTheme()

    return (
        <IconButton
            onClick={onToggle}
            aria-label="Toggle navigation menu"
            sx={{
                width: 36,
                height: 36,
                color: alpha(theme.palette.text.secondary, 0.7),
            }}
        >
            <Iconify
                icon={open ? 'solar:close-circle-bold' : 'solar:hamburger-menu-bold'}
                width={24}
            />
        </IconButton>
    )
}

// Mobile Navigation Menu (expandable content)
interface MobileNavMenuProps {
    open: boolean
    onClose: () => void
}

export function MobileNavMenu({ open, onClose }: MobileNavMenuProps) {
    const theme = useTheme()
    const pathname = usePathname()

    const isActive = (path: string) => {
        if (path === '/') {
            return pathname === '/'
        }
        return pathname?.startsWith(path) ?? false
    }

    return (
        <Collapse in={open}>
            <List
                disablePadding
                sx={{
                    py: 1,
                }}
            >
                {NAV_ITEMS.map(item => {
                    const active = isActive(item.path)
                    return (
                        <ListItemButton
                            key={item.path}
                            component={RouterLink}
                            href={item.path}
                            onClick={onClose}
                            sx={{
                                py: 1.5,
                                px: 2.5,
                                borderRadius: 1,
                                mx: 1,
                                mb: 0.5,
                                ...(active && {
                                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                    color: theme.palette.primary.main,
                                }),
                                '&:hover': {
                                    backgroundColor: alpha(theme.palette.primary.main, 0.12),
                                },
                            }}
                        >
                            <ListItemIcon
                                sx={{
                                    minWidth: 40,
                                    color: active
                                        ? theme.palette.primary.main
                                        : theme.palette.text.secondary,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 24,
                                        height: 24,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    {item.icon}
                                </Box>
                            </ListItemIcon>
                            <ListItemText
                                primary={item.label}
                                primaryTypographyProps={{
                                    fontWeight: active ? 700 : 600,
                                    fontSize: '0.875rem',
                                }}
                            />
                            {active && (
                                <Box
                                    sx={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        backgroundColor: theme.palette.primary.main,
                                    }}
                                />
                            )}
                        </ListItemButton>
                    )
                })}
            </List>
            {/* Bottom divider */}
            <Box
                sx={{
                    height: 2,
                    backgroundColor: theme.palette.divider,
                    mt: 1,
                }}
            />
        </Collapse>
    )
}
