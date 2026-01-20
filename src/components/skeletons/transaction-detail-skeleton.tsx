import { Box, Card, CardHeader, Divider, Skeleton, Stack } from '@mui/material'

export function TransactionDetailSkeleton() {
    return (
        <Card sx={{ boxShadow: 3, borderRadius: 2 }}>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                }}
            >
                {/* Transaction Summary Column Skeleton */}
                <Box sx={{ width: { xs: '100%', md: '30%' }, p: 2 }}>
                    <Card sx={{ boxShadow: 5, borderRadius: 2 }}>
                        <CardHeader
                            title="Bridge Summary"
                            titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
                            sx={{
                                backgroundColor: 'primary.main',
                                color: 'primary.contrastText',
                                py: 1,
                                px: 2,
                            }}
                        />
                        <Box sx={{ p: 2 }}>
                            <Skeleton variant="text" width="80%" height={24} sx={{ mb: 2 }} />
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                                <Skeleton variant="circular" width={28} height={28} />
                                <Skeleton variant="rectangular" width={20} height={20} />
                                <Skeleton variant="circular" width={28} height={28} />
                            </Stack>
                            <Stack spacing={2} mt={2}>
                                {[...Array(6)].map((_, i) => (
                                    <Stack key={i} direction="row" spacing={1} alignItems="center">
                                        <Skeleton variant="text" width={60} height={20} />
                                        <Skeleton variant="text" width={120} height={20} />
                                    </Stack>
                                ))}
                            </Stack>
                        </Box>
                    </Card>
                </Box>

                {/* Vertical divider on medium+ screens */}
                <Divider
                    orientation="vertical"
                    flexItem
                    sx={{ display: { xs: 'none', md: 'block' } }}
                />

                {/* Timeline Column Skeleton */}
                <Box sx={{ width: { xs: '100%', md: '70%' }, p: 2 }}>
                    <CardHeader
                        title="Bridge Timeline"
                        titleTypographyProps={{ variant: 'h6', fontWeight: 'bold' }}
                        sx={{
                            backgroundColor: 'primary.main',
                            color: 'primary.contrastText',
                            py: 1,
                            px: 2,
                            borderTopLeftRadius: 10,
                            borderTopRightRadius: 10,
                        }}
                    />
                    <Box sx={{ p: 2 }}>
                        {[...Array(3)].map((_, index) => (
                            <Box
                                key={index}
                                sx={{
                                    display: 'flex',
                                    mb: 3,
                                }}
                            >
                                {/* Timeline dot and connector */}
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        mr: 2,
                                    }}
                                >
                                    <Skeleton variant="circular" width={32} height={32} />
                                    {index < 2 && (
                                        <Skeleton
                                            variant="rectangular"
                                            width={2}
                                            height={100}
                                            sx={{ mt: 1 }}
                                        />
                                    )}
                                </Box>
                                {/* Timeline content */}
                                <Box
                                    sx={{
                                        flex: 1,
                                        p: 2,
                                        borderRadius: 2,
                                        boxShadow: 3,
                                        minWidth: { md: 500 },
                                    }}
                                >
                                    <Skeleton
                                        variant="text"
                                        width="40%"
                                        height={28}
                                        sx={{ mb: 2 }}
                                    />
                                    <Stack direction="row" spacing={4}>
                                        <Stack spacing={1} flex={1}>
                                            {[...Array(4)].map((_, i) => (
                                                <Skeleton
                                                    key={i}
                                                    variant="text"
                                                    width="90%"
                                                    height={20}
                                                />
                                            ))}
                                        </Stack>
                                        <Stack spacing={1} flex={1}>
                                            {[...Array(4)].map((_, i) => (
                                                <Skeleton
                                                    key={i}
                                                    variant="text"
                                                    width="90%"
                                                    height={20}
                                                />
                                            ))}
                                        </Stack>
                                    </Stack>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        </Card>
    )
}
