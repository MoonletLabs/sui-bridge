import { Box, Card } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { isNumber } from '@mui/x-data-grid/internals'
import React from 'react'
import AnimatedNumbers from 'react-animated-numbers'

interface ICardWidget {
    title: React.ReactNode
    total: React.ReactNode | number
    isDollar?: boolean
    icon?: string
    color: string
}

const CardWidget: React.FC<ICardWidget> = ({ title, total, isDollar, icon, color }) => {
    const textStyle = {
        fontSize: '2rem',
        fontWeight: 'bold',
        fontFamily: 'Barlow',
    }

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
            sx={{
                display: 'flex',
                alignItems: 'center',
                p: 3,
                background: color
                    ? `linear-gradient(135deg, ${alpha(color, 0.8)}, ${alpha(color, 0.4)})`
                    : '',
            }}
        >
            <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ typography: 'subtitle2' }}>
                    {title}
                    {icon ? (
                        <Box
                            component="img"
                            src={icon}
                            alt="My Icon"
                            sx={{
                                width: 35,
                                marginLeft: 2,
                                height: 35,
                                color: 'primary.main',
                            }}
                        />
                    ) : null}
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
            </Box>
        </Card>
    )
}

export default CardWidget
