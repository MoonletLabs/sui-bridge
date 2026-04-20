'use client'

import { Grid, Skeleton } from '@mui/material'
import CardWidget from './card-widgets'
import { useLiquiditySnapshot } from 'src/hooks/use-liquidity-snapshot'

// Round for display; avoid "NaN%" when previous value was zero.
const round = (n: number) => Number((n || 0).toFixed(2))

export default function LiquidityKpiCards() {
    const { snapshot, isLoading } = useLiquiditySnapshot()

    if (isLoading || !snapshot) {
        return (
            <Grid container>
                {Array.from(new Array(4)).map((_, i) => (
                    <Grid xs={12} sm={6} md={4} lg={3} key={i} padding={1}>
                        <CardWidget
                            title={<Skeleton width={180} height={22} />}
                            total={<Skeleton width={140} height={48} />}
                            isLoader
                            color=""
                        />
                    </Grid>
                ))}
            </Grid>
        )
    }

    const largest = snapshot.largestToken

    const cards = [
        {
            title: 'Total Locked (USD)',
            value: snapshot.totalUsd,
            color: '#3780FF',
            dollars: true,
            icon: 'solar:wallet-money-bold-duotone',
            percentageChange: round(snapshot.delta7dPct),
        },
        {
            title: largest ? `Largest: ${largest.token}` : 'Largest Token',
            value: largest?.current.usd ?? 0,
            color: largest?.color || '#38B137',
            dollars: true,
            icon: 'solar:crown-star-bold-duotone',
            percentageChange: round(largest?.delta7d.pct ?? 0),
        },
        {
            title: '24h Change (USD)',
            value: snapshot.delta24hUsd,
            color: snapshot.delta24hUsd >= 0 ? '#38B137' : '#FA3913',
            dollars: true,
            icon:
                snapshot.delta24hUsd >= 0
                    ? 'solar:round-arrow-up-bold-duotone'
                    : 'solar:round-arrow-down-bold-duotone',
            percentageChange: round(snapshot.delta24hPct),
        },
        {
            title: '7d Change (USD)',
            value: snapshot.delta7dUsd,
            color: snapshot.delta7dUsd >= 0 ? '#38B137' : '#FA3913',
            dollars: true,
            icon:
                snapshot.delta7dUsd >= 0
                    ? 'solar:round-arrow-up-bold-duotone'
                    : 'solar:round-arrow-down-bold-duotone',
            percentageChange: round(snapshot.delta7dPct),
        },
    ]

    return (
        <Grid container>
            {cards.map((c, i) => (
                <Grid xs={12} sm={6} md={4} lg={3} key={`${c.title}-${i}`} padding={1}>
                    <CardWidget
                        title={c.title}
                        total={c.value}
                        isDollar={c.dollars}
                        color={c.color}
                        icon={c.icon}
                        percentageChange={c.percentageChange}
                        timePeriod={
                            i === 2
                                ? 'vs 24h ago'
                                : i === 0 || i === 1 || i === 3
                                  ? 'vs 7d ago'
                                  : ''
                        }
                    />
                </Grid>
            ))}
        </Grid>
    )
}
