import { Card, CardContent, Box, Typography } from '@mui/material'
import { Iconify } from '../iconify'

// Reusable ProfileCard component
interface ProfileCardProps {
    borderColor: string
    icon: string
    title: string
    children: React.ReactNode
    sx?: object
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
    borderColor,
    icon,
    title,
    children,
    sx,
}) => {
    return (
        <Card elevation={3} sx={{ borderLeft: `5px solid ${borderColor}`, ...sx }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Iconify
                        icon={icon}
                        width={24}
                        height={24}
                        color={borderColor}
                        style={{ marginRight: 8 }}
                    />
                    <Typography variant="subtitle1">{title}</Typography>
                </Box>
                {children}
            </CardContent>
        </Card>
    )
}
