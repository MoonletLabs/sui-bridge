'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import {
    Box,
    Button,
    Collapse,
    IconButton,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    ListSubheader,
    Menu,
    MenuItem,
    Typography,
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

type NavItem = {
    label: string
    description: string
    path: string
    icon: React.ReactNode
    /** Extra path prefixes that should keep this item highlighted */
    alsoActiveFor?: string[]
}

type NavGroup = {
    label: string
    icon: React.ReactNode
    items: NavItem[]
}

/**
 * Pages are grouped so the header stays at three entries however many pages
 * we add. Address profiles (/profile) are reached through the search (⌘K) and
 * from address links, so they have no entry of their own: they highlight
 * "Activity", the group they belong to.
 */
const NAV_GROUPS: NavGroup[] = [
    {
        label: 'Overview',
        icon: icon('ic-analytics'),
        items: [
            {
                label: 'Dashboard',
                description: 'Volume, inflows and outflows at a glance',
                path: '/',
                icon: icon('ic-analytics'),
            },
            {
                label: 'Flows',
                description: 'Where value moves between chains and tokens',
                path: paths.flows.root,
                icon: icon('ic-ecommerce'),
            },
            {
                label: 'Tokens',
                description: 'Per-token volume and transfer sizes',
                path: paths.tokens.root,
                icon: icon('ic-label'),
            },
        ],
    },
    {
        label: 'Activity',
        icon: icon('ic-parameter'),
        items: [
            {
                label: 'Transactions',
                description: 'Every bridge transfer, searchable',
                path: paths.transactions.root,
                icon: icon('ic-parameter'),
            },
            {
                label: 'Leaderboard',
                description: 'Top bridge users by volume',
                path: paths.leaderboard.root,
                icon: icon('ic-tour'),
                alsoActiveFor: [paths.profile.root],
            },
        ],
    },
    {
        label: 'Bridge',
        icon: icon('ic-banking'),
        items: [
            {
                label: 'Health',
                description: 'Latency, unclaimed transfers and failures',
                path: paths.health.root,
                icon: icon('ic-banking'),
            },
            {
                label: 'Governance',
                description: 'Transfer limits and committee actions',
                path: paths.governance.root,
                icon: icon('ic-file'),
            },
        ],
    },
]

const matches = (pathname: string | null, path: string) =>
    path === '/' ? pathname === '/' : (pathname?.startsWith(path) ?? false)

const isItemActive = (pathname: string | null, item: NavItem) =>
    matches(pathname, item.path) || (item.alsoActiveFor ?? []).some(p => matches(pathname, p))

const isGroupActive = (pathname: string | null, group: NavGroup) =>
    group.items.some(item => isItemActive(pathname, item))

// Desktop navigation: one dropdown button per group
function NavGroupButton({ group }: { group: NavGroup }) {
    const theme = useTheme()
    const pathname = usePathname()
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
    const open = Boolean(anchorEl)
    const active = isGroupActive(pathname, group)

    return (
        <>
            <Button
                color="inherit"
                onClick={e => setAnchorEl(e.currentTarget)}
                aria-haspopup="menu"
                aria-expanded={open}
                startIcon={<Box sx={{ width: 22, height: 22, display: 'flex' }}>{group.icon}</Box>}
                endIcon={
                    <Iconify
                        icon="eva:arrow-ios-downward-fill"
                        width={16}
                        sx={{
                            transition: 'transform 150ms',
                            transform: open ? 'rotate(180deg)' : 'none',
                        }}
                    />
                }
                sx={{
                    position: 'relative',
                    minHeight: 48,
                    px: 2,
                    borderRadius: 0,
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    textTransform: 'none',
                    color: active ? theme.palette.primary.main : theme.palette.text.secondary,
                    '&:hover': {
                        color: theme.palette.primary.main,
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    },
                    // Same indicator the old tabs used, so the active group reads at a glance
                    '&::after': active
                        ? {
                              content: '""',
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              bottom: 0,
                              height: 3,
                              borderRadius: '3px 3px 0 0',
                              backgroundColor: theme.palette.primary.main,
                          }
                        : undefined,
                }}
            >
                {group.label}
            </Button>

            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={() => setAnchorEl(null)}
                slotProps={{ paper: { sx: { mt: 0.5, minWidth: 300, borderRadius: 1.5 } } }}
            >
                {group.items.map(item => {
                    const itemActive = isItemActive(pathname, item)
                    return (
                        <MenuItem
                            key={item.path}
                            component={RouterLink}
                            href={item.path}
                            selected={itemActive}
                            onClick={() => setAnchorEl(null)}
                            sx={{ gap: 1.5, py: 1.25, borderRadius: 1, mx: 0.5 }}
                        >
                            <Box
                                sx={{
                                    width: 24,
                                    height: 24,
                                    display: 'flex',
                                    color: itemActive
                                        ? theme.palette.primary.main
                                        : theme.palette.text.secondary,
                                }}
                            >
                                {item.icon}
                            </Box>
                            <Box>
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        color: itemActive ? theme.palette.primary.main : undefined,
                                    }}
                                >
                                    {item.label}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {item.description}
                                </Typography>
                            </Box>
                        </MenuItem>
                    )
                })}
            </Menu>
        </>
    )
}

// Desktop Navigation
export function NavTabs() {
    return (
        <Box component="nav" aria-label="Main" sx={{ display: 'flex', gap: 1 }}>
            {NAV_GROUPS.map(group => (
                <NavGroupButton key={group.label} group={group} />
            ))}
        </Box>
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
            aria-expanded={open}
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

// Mobile Navigation Menu (expandable content): the same groups, as sections
interface MobileNavMenuProps {
    open: boolean
    onClose: () => void
}

export function MobileNavMenu({ open, onClose }: MobileNavMenuProps) {
    const theme = useTheme()
    const pathname = usePathname()

    return (
        <Collapse in={open}>
            <Box
                component="nav"
                aria-label="Main"
                sx={{ maxHeight: 'calc(100vh - 56px)', overflowY: 'auto' }}
            >
                {NAV_GROUPS.map(group => (
                    <List
                        key={group.label}
                        disablePadding
                        subheader={
                            <ListSubheader
                                disableSticky
                                sx={{
                                    bgcolor: 'transparent',
                                    lineHeight: '32px',
                                    px: 3,
                                    pt: 1,
                                    typography: 'overline',
                                    color: 'text.disabled',
                                }}
                            >
                                {group.label}
                            </ListSubheader>
                        }
                    >
                        {group.items.map(item => {
                            const active = isItemActive(pathname, item)
                            return (
                                <ListItemButton
                                    key={item.path}
                                    component={RouterLink}
                                    href={item.path}
                                    onClick={onClose}
                                    sx={{
                                        py: 1.25,
                                        px: 2.5,
                                        borderRadius: 1,
                                        mx: 1,
                                        mb: 0.5,
                                        ...(active && {
                                            backgroundColor: alpha(
                                                theme.palette.primary.main,
                                                0.08,
                                            ),
                                            color: theme.palette.primary.main,
                                        }),
                                        '&:hover': {
                                            backgroundColor: alpha(
                                                theme.palette.primary.main,
                                                0.12,
                                            ),
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
                                        secondary={item.description}
                                        primaryTypographyProps={{
                                            fontWeight: active ? 700 : 600,
                                            fontSize: '0.875rem',
                                        }}
                                        secondaryTypographyProps={{ fontSize: '0.75rem' }}
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
                ))}
            </Box>
            {/* Bottom divider */}
            <Box sx={{ height: 2, backgroundColor: theme.palette.divider, mt: 1 }} />
        </Collapse>
    )
}
