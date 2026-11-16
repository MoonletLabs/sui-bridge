'use client'

import { Alert, Box } from '@mui/material'
import {
    HashiRecentRequests,
    HashiSpeedAndSize,
    HashiVolumeChart,
} from 'src/components/hashi/hashi-activity'
import { HashiShell } from 'src/components/hashi/hashi-shell'
import { useHashiActivity } from 'src/hooks/use-hashi'

export default function HashiActivityPage() {
    const { data, isLoading, error, network } = useHashiActivity()

    return (
        <HashiShell title="Hashi Activity" error={error}>
            {data?.tooLarge ? (
                <Alert severity="info">
                    This network has too many requests (over a thousand) to read directly from Sui.
                    Deposit and withdrawal history will be available once Hashi activity is stored
                    in a database. The live totals on the Overview tab still work.
                </Alert>
            ) : (
                <>
                    <HashiVolumeChart data={data} loading={isLoading} />
                    <Box sx={{ mt: 3 }}>
                        <HashiSpeedAndSize data={data} loading={isLoading} />
                    </Box>
                    <Box sx={{ mt: 3 }}>
                        <HashiRecentRequests data={data} loading={isLoading} network={network} />
                    </Box>
                </>
            )}
        </HashiShell>
    )
}
