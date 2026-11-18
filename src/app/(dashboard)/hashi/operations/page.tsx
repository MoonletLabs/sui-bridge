'use client'

import { Alert, Box, Typography } from '@mui/material'
import {
    HashiBatchChart,
    HashiBatchesTable,
    HashiBatchStats,
    HashiNetworkProgress,
} from 'src/components/hashi/hashi-operations'
import { HashiShell } from 'src/components/hashi/hashi-shell'
import { useHashiOperations } from 'src/hooks/use-hashi'

export default function HashiOperationsPage() {
    const { data, isLoading, error, network } = useHashiOperations()

    return (
        <HashiShell title="Hashi Operations" error={error}>
            {data?.tooLarge ? (
                <Alert severity="info">
                    This network has over a thousand withdrawal batches, too many to read from Sui
                    in full, so batch statistics are not shown. Sui progress and the committee
                    history below still work.
                </Alert>
            ) : (
                <>
                    <HashiBatchStats data={data} loading={isLoading} />
                    <Box sx={{ mt: 3 }}>
                        <HashiBatchChart data={data} loading={isLoading} />
                    </Box>
                    <Box sx={{ mt: 3 }}>
                        <HashiBatchesTable data={data} loading={isLoading} network={network} />
                    </Box>
                </>
            )}

            <Typography variant="h5" sx={{ mt: 5, mb: 2 }}>
                Network progress
            </Typography>
            <HashiNetworkProgress data={data} loading={isLoading} />
        </HashiShell>
    )
}
