'use client'

import { Card, CardHeader, Link as MuiLink, Skeleton, Stack, Typography } from '@mui/material'
import type { HashiOverview } from 'src/utils/hashi-chain'
import { fBtc, fDuration, shortAddress } from './format'

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.75 }}>
            <Typography variant="body2" color="text.secondary">
                {label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
                {value}
            </Typography>
        </Stack>
    )
}

export function HashiParameters({ data, loading }: { data?: HashiOverview; loading: boolean }) {
    const c = data?.config
    const explorer = (id: string) =>
        `https://suiscan.xyz/${data?.network === 'testnet' ? 'testnet' : 'mainnet'}/object/${id}`
    return (
        <Card sx={{ height: '100%' }}>
            <CardHeader title="Protocol parameters" subheader="Set on-chain by governance" />
            <Stack sx={{ px: 2.5, pb: 2.5 }} divider={<span />}>
                {loading || !c || !data ? (
                    <Skeleton variant="rounded" height={220} />
                ) : (
                    <>
                        <Row label="Minimum deposit" value={fBtc(c.depositMinimumSats)} />
                        <Row label="Minimum withdrawal" value={fBtc(c.withdrawalMinimumSats)} />
                        <Row
                            label="Deposit delay after approval"
                            value={fDuration(c.depositDelayMs)}
                        />
                        <Row
                            label="Bitcoin confirmations required"
                            value={c.confirmationsRequired}
                        />
                        <Row
                            label="Withdrawal cancel cooldown"
                            value={fDuration(c.cancellationCooldownMs)}
                        />
                        <Row
                            label="Emergency pause threshold"
                            value={`${(c.emergencyPauseBps / 100).toFixed(2)}% of weight`}
                        />
                        <Row
                            label="Unpause threshold"
                            value={`${(c.emergencyUnpauseBps / 100).toFixed(2)}% of weight`}
                        />
                        <Row
                            label="Hashi object"
                            value={
                                <MuiLink
                                    href={explorer(data.hashiObjectId)}
                                    target="_blank"
                                    rel="noopener"
                                    underline="hover"
                                >
                                    {shortAddress(data.hashiObjectId)}
                                </MuiLink>
                            }
                        />
                        <Row
                            label="Package"
                            value={
                                <MuiLink
                                    href={explorer(data.packageId)}
                                    target="_blank"
                                    rel="noopener"
                                    underline="hover"
                                >
                                    {shortAddress(data.packageId)}
                                </MuiLink>
                            }
                        />
                    </>
                )}
            </Stack>
        </Card>
    )
}
