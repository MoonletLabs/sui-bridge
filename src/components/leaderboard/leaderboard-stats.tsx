import { Grid, Card, Box, Typography, Skeleton } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Iconify } from 'src/components/iconify'
import AnimatedNumbers from 'react-animated-numbers'

interface LeaderboardStatsProps {
    totalUsers: number
    totalVolumeUsd: number
    avgVolumePerUser: number
    topUserVolume: number
    isLoading?: boolean
}

interface StatCardProps {
    title: string
    value: number | string
    icon: string
    color: string
    isDollar?: boolean
    isLoading?: boolean
}

function StatCard({ title, value, icon, color, isDollar, isLoading }: StatCardProps) {
    const textStyle = {
        fontSize: '1.5rem',
        fontWeight: 'bold',
        fontFamily: 'Barlow',
    }

    return (
        <Card
            elevation={2}
            sx={{
                p: 2.5,
                height: '100%',
                borderLeft: `4px solid ${color}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Iconify icon={icon} width={22} sx={{ color }} />
                <Typography variant="body2" color="text.secondary">
                    {title}
                </Typography>
            </Box>

            {isLoading ? (
                <Skeleton width="80%" height={36} />
            ) : typeof value === 'number' ? (
                <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                    {isDollar && <Typography sx={{ ...textStyle, mr: 0.5 }}>$</Typography>}
                    <AnimatedNumbers
                        includeComma
                        animateToNumber={Math.round(value)}
                        fontStyle={textStyle}
                    />
                </Box>
            ) : (
                <Typography variant="h5" fontWeight={600}>
                    {value}
                </Typography>
            )}
        </Card>
    )
}

export function LeaderboardStats({
    totalUsers,
    totalVolumeUsd,
    avgVolumePerUser,
    topUserVolume,
    isLoading,
}: LeaderboardStatsProps) {
    const theme = useTheme()

    const stats = [
        {
            title: 'Total Users',
            value: totalUsers,
            icon: 'solar:users-group-rounded-bold-duotone',
            color: theme.palette.info.main,
            isDollar: false,
        },
        {
            title: 'Total Volume',
            value: totalVolumeUsd,
            icon: 'solar:wallet-money-bold-duotone',
            color: theme.palette.success.main,
            isDollar: true,
        },
        {
            title: 'Avg Volume/User',
            value: avgVolumePerUser,
            icon: 'solar:chart-square-bold-duotone',
            color: theme.palette.warning.main,
            isDollar: true,
        },
        {
            title: 'Top User Volume',
            value: topUserVolume,
            icon: 'solar:crown-bold-duotone',
            color: '#FFD700',
            isDollar: true,
        },
    ]

    return (
        <Grid container spacing={2} sx={{ mb: 3 }}>
            {stats.map((stat, index) => (
                <Grid item xs={12} sm={6} md={3} key={stat.title}>
                    <StatCard
                        title={stat.title}
                        value={stat.value}
                        icon={stat.icon}
                        color={stat.color}
                        isDollar={stat.isDollar}
                        isLoading={isLoading}
                    />
                </Grid>
            ))}
        </Grid>
    )
}
