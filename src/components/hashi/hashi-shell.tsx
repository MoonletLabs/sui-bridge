'use client'

import { Alert, Box, Tab, Tabs, Typography } from '@mui/material'
import { usePathname } from 'next/navigation'
import { Iconify } from 'src/components/iconify'
import { PageTitle } from 'src/components/page-title'
import { useHashiOverview } from 'src/hooks/use-hashi'
import { DashboardContent } from 'src/layouts/dashboard'
import { RouterLink } from 'src/routes/components'
import { paths } from 'src/routes/paths'
import { HashiStatusChips } from './hashi-overview'

const TABS = [
    { label: 'Overview', path: paths.hashi.root },
    { label: 'Activity', path: paths.hashi.activity },
    { label: 'Committee', path: paths.hashi.committee },
    { label: 'Governance', path: paths.hashi.governance },
]

const activeTab = (pathname: string | null) =>
    TABS.find(t => t.path !== paths.hashi.root && pathname?.startsWith(t.path))?.path ??
    paths.hashi.root

/**
 * Shared frame of every Hashi page: title, live status and the sub-tabs. Each page
 * passes the title of the section it shows and any load error.
 */
export function HashiShell({
    title,
    error,
    children,
}: {
    title: string
    error?: unknown
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const { data } = useHashiOverview()

    return (
        <DashboardContent maxWidth="xl">
            <PageTitle title={title} />

            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <Iconify icon="mdi:bitcoin" width={30} sx={{ color: '#F7931A' }} />
                    <Typography variant="h4">Hashi</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, maxWidth: 720 }}>
                    Hashi is Sui&apos;s native Bitcoin orchestrator: a committee of Sui validators
                    holds BTC with threshold signatures and mints hBTC on Sui against confirmed
                    deposits. Everything here is read directly from Sui.
                </Typography>
                <HashiStatusChips data={data} />
            </Box>

            <Tabs
                value={activeTab(pathname)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
            >
                {TABS.map(tab => (
                    <Tab
                        key={tab.path}
                        value={tab.path}
                        label={tab.label}
                        component={RouterLink}
                        href={tab.path}
                    />
                ))}
            </Tabs>

            {Boolean(error) && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    Some Hashi data could not be loaded from Sui right now. Try again in a moment.
                </Alert>
            )}

            {children}
        </DashboardContent>
    )
}
