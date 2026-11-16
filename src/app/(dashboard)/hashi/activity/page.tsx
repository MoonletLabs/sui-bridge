'use client'

import { Alert, Box } from '@mui/material'
import {
    HashiRecentRequests,
    HashiSpeedAndSize,
    HashiSupplyChart,
    HashiUsersAndStatus,
    HashiVolumeChart,
} from 'src/components/hashi/hashi-activity'
import { HashiShell } from 'src/components/hashi/hashi-shell'
import { useHashiActivity } from 'src/hooks/use-hashi'

export default function HashiActivityPage() {
    const { data, isLoading, error, network } = useHashiActivity()

    return (
        <HashiShell title="Hashi Activity" error={error}>
            {data?.tooLarge && (
                <Alert severity="info" sx={{ mb: 3 }}>
                    This network has over a thousand requests, too many to read from Sui in full.
                    Showing the latest requests only, counted when they were made. Full history and
                    completion times will come once Hashi activity is stored in a database.
                </Alert>
            )}
            <HashiVolumeChart data={data} loading={isLoading} />
            {data?.mode === 'full' && (
                <Box sx={{ mt: 3 }}>
                    <HashiSupplyChart data={data} loading={isLoading} />
                </Box>
            )}
            <Box sx={{ mt: 3 }}>
                <HashiSpeedAndSize data={data} loading={isLoading} />
            </Box>
            {data?.mode === 'full' && (
                <Box sx={{ mt: 3 }}>
                    <HashiUsersAndStatus data={data} loading={isLoading} />
                </Box>
            )}
            <Box sx={{ mt: 3 }}>
                <HashiRecentRequests data={data} loading={isLoading} network={network} />
            </Box>
        </HashiShell>
    )
}
