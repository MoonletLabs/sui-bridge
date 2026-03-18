'use client'

import { Box, Typography } from '@mui/material'
import { LeaderboardTable } from 'src/components/leaderboard'
import { DashboardContent } from 'src/layouts/dashboard'
import { Iconify } from 'src/components/iconify'

export default function LeaderboardPage() {
    return (
        <DashboardContent maxWidth="xl">
            {/* Page Header */}
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <Iconify
                        icon="solar:cup-star-bold-duotone"
                        width={28}
                        sx={{ color: 'warning.main' }}
                    />
                    <Typography variant="h4">Leaderboard</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    Top bridge users ranked by volume and transaction activity
                </Typography>
            </Box>

            {/* Leaderboard Table */}
            <LeaderboardTable />
        </DashboardContent>
    )
}
