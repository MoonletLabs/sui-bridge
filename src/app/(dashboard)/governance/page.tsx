'use client'

import { Box, Typography } from '@mui/material'
import { GovernanceTimeline, LimitCards } from 'src/components/governance'
import { Iconify } from 'src/components/iconify'
import { PageTitle } from 'src/components/page-title'
import { DashboardContent } from 'src/layouts/dashboard'

export default function GovernancePage() {
    return (
        <DashboardContent maxWidth="xl">
            <PageTitle title="Bridge Governance" />

            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <Iconify
                        icon="solar:shield-check-bold-duotone"
                        width={28}
                        sx={{ color: 'primary.main' }}
                    />
                    <Typography variant="h4">Bridge Governance</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    Transfer limits, emergency pauses, token listings and other committee decisions
                    that change how the bridge behaves.
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <LimitCards />
                <GovernanceTimeline />
            </Box>
        </DashboardContent>
    )
}
