import { Box, Card, CardHeader, Grid, Skeleton } from '@mui/material'

export const BridgePerformanceChartLoading = () => (
    <Card>
        <CardHeader title="Bridge Transactions" />
        <Box sx={{ p: 1, marginTop: 1 }}>
            <Grid container justifyContent="center" alignItems="center" spacing={2}>
                {/* Left side - Stats skeleton */}
                <Grid item xs={12} md={3}>
                    <Box sx={{ p: 2, textAlign: 'center' }}>
                        {/* Total Bridges skeleton */}
                        <Box mb={4}>
                            <Skeleton
                                variant="text"
                                width="80%"
                                height={40}
                                sx={{ mx: 'auto', mb: 1 }}
                            />
                            <Skeleton
                                variant="text"
                                width="60%"
                                height={20}
                                sx={{ mx: 'auto', mb: 2 }}
                            />

                            {/* Network breakdown skeleton */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1.5 }}>
                                <Skeleton
                                    variant="rectangular"
                                    width="100%"
                                    height={40}
                                    sx={{ borderRadius: 1 }}
                                />
                                <Skeleton
                                    variant="rectangular"
                                    width="100%"
                                    height={40}
                                    sx={{ borderRadius: 1 }}
                                />
                            </Box>
                        </Box>

                        {/* Unique Wallets skeleton */}
                        <Box mb={2}>
                            <Skeleton
                                variant="text"
                                width="70%"
                                height={20}
                                sx={{ mx: 'auto', mb: 1.5 }}
                            />

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Skeleton
                                    variant="rectangular"
                                    width="100%"
                                    height={40}
                                    sx={{ borderRadius: 1 }}
                                />
                                <Skeleton
                                    variant="rectangular"
                                    width="100%"
                                    height={40}
                                    sx={{ borderRadius: 1 }}
                                />
                                <Skeleton
                                    variant="rectangular"
                                    width="100%"
                                    height={40}
                                    sx={{ borderRadius: 1 }}
                                />
                            </Box>
                        </Box>
                    </Box>
                </Grid>

                {/* Right side - Chart skeleton */}
                <Grid item xs={12} md={9}>
                    <Box sx={{ p: 2.5 }}>
                        <Skeleton
                            variant="rectangular"
                            width="100%"
                            height={340}
                            sx={{ borderRadius: 1 }}
                        />
                    </Box>
                </Grid>
            </Grid>
        </Box>
    </Card>
)
