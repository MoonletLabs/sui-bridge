'use client'

import { Box, Card, Chip, Divider, Skeleton, Stack, Typography } from '@mui/material'
import dayjs from 'dayjs'
import { Iconify } from 'src/components/iconify'
import type { HashiCheckStatus, HashiHealth, HashiHealthCheck } from 'src/utils/hashi-chain'

const STATUS: Record<
    HashiCheckStatus,
    { label: string; color: 'success' | 'warning' | 'info' | 'default' }
> = {
    healthy: { label: 'Normal', color: 'success' },
    watch: { label: 'Watch', color: 'warning' },
    info: { label: 'Informational', color: 'info' },
    unavailable: { label: 'Not checked', color: 'default' },
}

const GROUPS: HashiHealthCheck['group'][] = [
    'Protocol state',
    'Bridge progression',
    'Request outcomes',
]

export function HashiHealthBanner({ data, loading }: { data?: HashiHealth; loading: boolean }) {
    if (loading || !data) return <Skeleton variant="rounded" height={88} />
    const ok = data.status === 'healthy'
    const checked = data.checks.filter(c => c.status !== 'unavailable').length
    return (
        <Card sx={{ p: 2.5 }}>
            <Stack direction="row" spacing={2} alignItems="center">
                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'background.neutral',
                        color: ok ? 'success.main' : 'warning.main',
                    }}
                >
                    <Iconify
                        icon={
                            ok
                                ? 'solar:shield-check-bold-duotone'
                                : 'solar:danger-triangle-bold-duotone'
                        }
                        width={28}
                    />
                </Box>
                <Box>
                    <Typography variant="h6">
                        {ok
                            ? 'No protocol issues detected'
                            : `${data.watchCount} ${data.watchCount === 1 ? 'check needs' : 'checks need'} attention`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {checked} of {data.checks.length} checks run from on-chain data · updated{' '}
                        {dayjs(data.checkedAt).format('HH:mm:ss')}
                    </Typography>
                </Box>
            </Stack>
        </Card>
    )
}

export function HashiHealthChecks({ data, loading }: { data?: HashiHealth; loading: boolean }) {
    return (
        <Stack spacing={3}>
            {GROUPS.map(group => {
                const checks = data?.checks.filter(c => c.group === group) ?? []
                return (
                    <Box key={group}>
                        <Typography variant="h6" sx={{ mb: 1.5 }}>
                            {group}
                        </Typography>
                        <Card>
                            {loading && (
                                <Box sx={{ p: 2.5 }}>
                                    <Skeleton variant="rounded" height={90} />
                                </Box>
                            )}
                            {checks.map((c, i) => (
                                <Box key={c.key}>
                                    {i > 0 && <Divider />}
                                    <Stack
                                        direction="row"
                                        spacing={2}
                                        alignItems="flex-start"
                                        sx={{ p: 2.5 }}
                                    >
                                        <Chip
                                            size="small"
                                            color={STATUS[c.status].color}
                                            variant={
                                                c.status === 'unavailable' ? 'outlined' : 'filled'
                                            }
                                            label={STATUS[c.status].label}
                                            sx={{ minWidth: 104 }}
                                        />
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography variant="subtitle2">{c.label}</Typography>
                                            <Typography variant="body2">{c.summary}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {c.detail}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Box>
                            ))}
                        </Card>
                    </Box>
                )
            })}
        </Stack>
    )
}
