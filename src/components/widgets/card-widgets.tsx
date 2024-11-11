import React from 'react'
import { Box, Card } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { alpha } from '@mui/material/styles'

interface ICardWidget {
    title: React.ReactNode
    total: React.ReactNode
    icon?: string
    color: string
}

const CardWidget: React.FC<ICardWidget> = ({ title, total, icon, color }) => {
    const theme = useTheme() as any
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
                <Box sx={{ mt: 1.5, mb: 1, typography: 'h3' }}>{total}</Box>
            </Box>
        </Card>
    )
}

export default CardWidget
