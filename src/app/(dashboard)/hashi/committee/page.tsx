'use client'

import { Grid } from '@mui/material'
import {
    HashiCommitteeSummary,
    HashiConcentrationChart,
    HashiOperatorsTable,
} from 'src/components/hashi/hashi-committee'
import { HashiShell } from 'src/components/hashi/hashi-shell'
import { useHashiCommittee } from 'src/hooks/use-hashi'

export default function HashiCommitteePage() {
    const { data, isLoading, error } = useHashiCommittee()

    return (
        <HashiShell title="Hashi Committee" error={error}>
            <HashiCommitteeSummary data={data} loading={isLoading} />
            <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                <Grid item xs={12} lg={7}>
                    <HashiOperatorsTable data={data} loading={isLoading} />
                </Grid>
                <Grid item xs={12} lg={5}>
                    <HashiConcentrationChart data={data} loading={isLoading} />
                </Grid>
            </Grid>
        </HashiShell>
    )
}
