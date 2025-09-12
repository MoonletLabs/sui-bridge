import React from 'react'
import { Grid, Card, CardHeader, Skeleton } from '@mui/material'
import { Chart } from 'src/components/chart'

interface ChartSkeletonProps {
    title?: string
}

const ChartSkeleton: React.FC<ChartSkeletonProps> = ({ title = 'Chart Loading' }) => (
    <Grid container spacing={4} marginTop={2}>
        <Grid item xs={12}>
            <Card>
                <CardHeader
                    title={title}
                    subheader=""
                    action={
                        <Skeleton
                            variant="rectangular"
                            width={340}
                            height={32}
                            sx={{ borderRadius: 1 }}
                        />
                    }
                />
                <Chart
                    type="bar"
                    series={undefined}
                    height={370}
                    loadingProps={{ sx: { p: 2.5 } }}
                    forceLoading={true}
                    sx={{ py: 2.5, pl: { xs: 0, md: 1 }, pr: 2.5 }}
                    options={undefined}
                />
            </Card>
        </Grid>
    </Grid>
)

export default ChartSkeleton
