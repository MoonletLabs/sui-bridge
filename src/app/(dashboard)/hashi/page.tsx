'use client'

import { Box, Typography } from '@mui/material'
import { HashiAccounts } from 'src/components/hashi/hashi-accounts'
import { HashiCommitteeSummary } from 'src/components/hashi/hashi-committee'
import { HashiHistoryCard } from 'src/components/hashi/hashi-history'
import { HashiOverviewCards } from 'src/components/hashi/hashi-overview'
import { HashiParameters } from 'src/components/hashi/hashi-parameters'
import { HashiShell } from 'src/components/hashi/hashi-shell'
import {
    useHashiActivity,
    useHashiCommittee,
    useHashiHistory,
    useHashiOverview,
} from 'src/hooks/use-hashi'

export default function HashiOverviewPage() {
    const overview = useHashiOverview()
    const committee = useHashiCommittee()
    const activity = useHashiActivity()
    // Same 7 days as the trend lines on the cards (shared with the history chart below)
    const history = useHashiHistory(7)

    return (
        <HashiShell title="Hashi" error={overview.error || committee.error}>
            <HashiOverviewCards
                data={overview.data}
                loading={overview.isLoading}
                committeeSize={committee.data?.members.filter(m => m.inCommittee).length}
                history={history.data}
                activity={activity.data}
                activityLoading={activity.isLoading}
            />

            <Box sx={{ mt: 3 }}>
                <HashiHistoryCard />
            </Box>

            <Box sx={{ mt: 3 }}>
                <HashiAccounts
                    data={activity.data}
                    loading={activity.isLoading}
                    network={activity.network}
                />
            </Box>

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
