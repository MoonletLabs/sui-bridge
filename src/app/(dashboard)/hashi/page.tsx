'use client'

import { Box, Typography } from '@mui/material'
import { HashiCommitteeSummary } from 'src/components/hashi/hashi-committee'
import { HashiOverviewCards } from 'src/components/hashi/hashi-overview'
import { HashiParameters } from 'src/components/hashi/hashi-parameters'
import { HashiShell } from 'src/components/hashi/hashi-shell'
import { useHashiCommittee, useHashiOverview } from 'src/hooks/use-hashi'

export default function HashiOverviewPage() {
    const overview = useHashiOverview()
    const committee = useHashiCommittee()

    return (
        <HashiShell title="Hashi" error={overview.error || committee.error}>
            <HashiOverviewCards
                data={overview.data}
                loading={overview.isLoading}
                committeeSize={committee.data?.members.filter(m => m.inCommittee).length}
            />

            <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
                Committee at a glance
            </Typography>
            <HashiCommitteeSummary data={committee.data} loading={committee.isLoading} />

            <Box sx={{ mt: 3 }}>
                <HashiParameters data={overview.data} loading={overview.isLoading} />
            </Box>
        </HashiShell>
    )
}
