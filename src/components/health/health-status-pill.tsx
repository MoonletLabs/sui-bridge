'use client'

import { Box, ButtonBase, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import useSWR from 'swr'
import { getNetwork } from 'src/hooks/get-network-storage'
import { RouterLink } from 'src/routes/components'
import { paths } from 'src/routes/paths'
import { endpoints, fetcher } from 'src/utils/axios'
import type { HealthSummaryResponse } from 'src/pages/api/health/summary'

type Status = 'loading' | 'ok' | 'attention'

/**
 * Compact bridge status for the header. Green when nothing is currently
 * delayed, amber when transfers are waiting on committee approval longer than
 * usual. Links to the Health page. On small screens only the dot is shown.
 */
export function HealthStatusPill() {
    const theme = useTheme()
    const network = getNetwork()

    const { data, error } = useSWR<HealthSummaryResponse>(
        `${endpoints.health.summary}?network=${network}`,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 60000, refreshInterval: 120000 },
    )

    // A failed status check must not read as "healthy"
    if (error) return null

    const delayed = data?.unclaimed.delayed_recent ?? 0
    const status: Status = !data ? 'loading' : delayed > 0 ? 'attention' : 'ok'

    const color =
        status === 'attention'
            ? theme.palette.warning.main
            : status === 'ok'
              ? theme.palette.success.main
              : theme.palette.text.disabled

    const label =
        status === 'attention' ? `${delayed} delayed` : status === 'ok' ? 'Healthy' : 'Status'

    const legacy = data?.unclaimed.pending_approval ?? 0
    const tooltip =
        status === 'loading'
            ? 'Checking bridge status…'
            : status === 'attention'
              ? `${delayed} transfer${delayed === 1 ? ' has' : 's have'} been waiting for committee approval for over 30 minutes. Click for details.`
              : `No transfers are delayed.${
                    legacy > 0 ? ` ${legacy} older transfers are still awaiting approval.` : ''
                } Click for details.`

    return (
        <Tooltip title={tooltip}>
            <ButtonBase
                component={RouterLink}
                href={paths.health.root}
                aria-label={`Bridge status: ${label}`}
                sx={{
                    height: 32,
                    px: { xs: 1, md: 1.25 },
                    gap: 0.75,
                    borderRadius: 1,
                    color,
                    bgcolor: alpha(color, 0.12),
                    '&:hover': { bgcolor: alpha(color, 0.2) },
                }}
            >
                <Box
                    sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: color,
                        // Gentle pulse only when something needs attention
                        ...(status === 'attention' && {
                            animation: 'health-pulse 1.8s ease-in-out infinite',
                            '@keyframes health-pulse': {
                                '0%, 100%': { opacity: 1 },
                                '50%': { opacity: 0.35 },
                            },
                        }),
                    }}
                />
                <Typography
                    variant="caption"
                    fontWeight={700}
                    sx={{ display: { xs: 'none', md: 'block' }, color: 'inherit' }}
                >
                    {label}
                </Typography>
            </ButtonBase>
        </Tooltip>
    )
}
