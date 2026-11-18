'use client'

import { Box } from '@mui/material'
import { HashiHealthBanner, HashiHealthChecks } from 'src/components/hashi/hashi-health'
import { HashiShell } from 'src/components/hashi/hashi-shell'
import { useHashiHealth } from 'src/hooks/use-hashi'

export default function HashiHealthPage() {
    const { data, isLoading, error } = useHashiHealth()

    return (
        <HashiShell title="Hashi Health" error={error}>
            <HashiHealthBanner data={data} loading={isLoading} />
            <Box sx={{ mt: 3 }}>
                <HashiHealthChecks data={data} loading={isLoading} />
            </Box>
        </HashiShell>
    )
}
