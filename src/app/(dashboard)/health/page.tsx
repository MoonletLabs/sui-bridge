'use client'

import { Box, Divider, Typography } from '@mui/material'
import useSWR from 'swr'
import { FailuresPanel, HealthStats, UnclaimedTable } from 'src/components/health'
import { Iconify } from 'src/components/iconify'
import { PageTitle } from 'src/components/page-title'
import { getNetwork } from 'src/hooks/get-network-storage'
import { DashboardContent } from 'src/layouts/dashboard'
import { endpoints, fetcher } from 'src/utils/axios'
import type { HealthSummaryResponse } from 'src/pages/api/health/summary'

export default function HealthPage() {
    const network = getNetwork()

    const { data, isLoading } = useSWR<HealthSummaryResponse>(
        `${endpoints.health.summary}?network=${network}`,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 30000 },
    )

    return (
        <DashboardContent maxWidth="xl">
            <PageTitle title="Bridge Health" />

            {/* Page header */}
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <Iconify
                        icon="solar:health-bold-duotone"
                        width={28}
                        sx={{ color: 'success.main' }}
                    />
                    <Typography variant="h4">Bridge Health</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    Reliability of the Sui bridge: transfers that were never claimed, and why
                    transactions fail.
                </Typography>
            </Box>

            <HealthStats data={data} isLoading={isLoading} />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <UnclaimedTable />
                <Divider sx={{ borderStyle: 'dashed' }} />
                <FailuresPanel />
            </Box>
        </DashboardContent>
    )
}
