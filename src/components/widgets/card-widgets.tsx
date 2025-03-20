import { Box, Card } from '@mui/material'
import { isNumber } from '@mui/x-data-grid/internals'
import React from 'react'
import AnimatedNumbers from 'react-animated-numbers'
import { Iconify } from '../iconify'

interface ICardWidget {
    title: React.ReactNode
    total: React.ReactNode | number
    isDollar?: boolean
    icon?: string
    color: string
    percentageChange?: number
    timePeriod?: string
}

const CardWidget: React.FC<ICardWidget> = ({
    title,
    total,
    isDollar,
    icon,
    color,
    percentageChange,
    timePeriod,
}) => {
    const textStyle = {
        fontSize: '2rem',
        fontWeight: 'bold',
        fontFamily: 'Barlow',
    }

    const percentage = percentageChange || 0

    const getCurrency = () => {
        return (
            <div>
                <span style={textStyle}>
                    {Number(total) < 0 ? '-' : ''}
                    {isDollar ? '$' : ''}{' '}
                </span>
            </div>
        )
    }
    return (
        <Card
            elevation={3}
            sx={{
                display: 'flex',
                alignItems: 'center',
                p: 3,
                borderLeft: isNumber(total) ? `5px solid ${color}` : '',
                // background: color
                //     ? `linear-gradient(135deg, ${alpha(color, 0.8)}, ${alpha(color, 0.4)})`
                //     : '',
            }}
        >
            <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ typography: 'subtitle2', flexDirection: 'row', display: 'flex' }}>
                    {icon ? (
                        <div>
                            <Iconify
                                width={20}
                                icon={icon}
                                sx={{
                                    flexShrink: 0,
                                    color,
                                    marginRight: 1,
                                }}
                            />
                        </div>
                    ) : null}
                    {title}
                </Box>
                {(isNumber(total) && (
                    <div style={{ display: 'flex', flexDirection: 'row' }}>
                        {getCurrency()}
                        <AnimatedNumbers
                            includeComma
                            animateToNumber={Number(total.toFixed(0))}
                            fontStyle={textStyle}
                        />
                    </div>
                )) || <Box sx={{ mt: 1.5, mb: 1, typography: 'h3' }}>{total}</Box>}

                <Box sx={{ gap: 0.5, display: 'flex', alignItems: 'center' }}>
                    {isFinite(percentage) && percentage ? (
                        <>
                            <Iconify
                                width={24}
                                icon={
                                    percentage < 0
                                        ? 'solar:double-alt-arrow-down-bold-duotone'
                                        : 'solar:double-alt-arrow-up-bold-duotone'
                                }
                                sx={{
                                    flexShrink: 0,
                                    color: 'success.main',
                                    ...(percentage < 0 && { color: 'error.main' }),
                                }}
                            />

                            <Box component="span" sx={{ typography: 'subtitle2' }}>
                                {percentage > 0 && '+'}
                                {percentage}%
                            </Box>
                            <Box
                                component="span"
                                sx={{
                                    typography: 'body2',
                                    color: 'text.secondary',
                                    textTransform: 'lowercase',
                                }}
                            >
                                {timePeriod}
                            </Box>
                        </>
                    ) : (
                        <div style={{ height: '24px' }} />
                    )}
                </Box>
            </Box>
        </Card>
    )
}

export default CardWidget
