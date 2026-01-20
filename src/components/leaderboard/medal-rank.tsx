import { Box, Typography } from '@mui/material'
import { useTheme, alpha } from '@mui/material/styles'

interface MedalRankProps {
    rank: number
}

const MEDAL_COLORS = {
    1: { primary: '#FFD700', secondary: '#FFA500', label: '1st' }, // Gold
    2: { primary: '#C0C0C0', secondary: '#A8A8A8', label: '2nd' }, // Silver
    3: { primary: '#CD7F32', secondary: '#B87333', label: '3rd' }, // Bronze
}

export function MedalRank({ rank }: MedalRankProps) {
    const theme = useTheme()
    const medalConfig = MEDAL_COLORS[rank as keyof typeof MEDAL_COLORS]

    if (!medalConfig) {
        // Regular rank display for non-medal positions
        return (
            <Box
                sx={{
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.grey[500], 0.12),
                }}
            >
                <Typography variant="subtitle2" fontWeight={600}>
                    {rank}
                </Typography>
            </Box>
        )
    }

    // Medal display for top 3
    return (
        <Box
            sx={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${medalConfig.primary} 0%, ${medalConfig.secondary} 100%)`,
                boxShadow: `0 4px 12px ${alpha(medalConfig.primary, 0.4)}`,
                position: 'relative',
                '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 2,
                    left: 2,
                    right: 2,
                    bottom: 2,
                    borderRadius: '50%',
                    border: `2px solid ${alpha('#fff', 0.3)}`,
                },
            }}
        >
            <Typography
                variant="subtitle1"
                fontWeight={700}
                sx={{
                    color: rank === 1 ? '#5D4E00' : rank === 2 ? '#4A4A4A' : '#4A2C00',
                    textShadow: `0 1px 2px ${alpha('#fff', 0.3)}`,
                }}
            >
                {rank}
            </Typography>
        </Box>
    )
}
