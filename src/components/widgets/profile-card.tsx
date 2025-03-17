import { Card, CardContent, Box, Typography } from '@mui/material'
import { Iconify } from '../iconify'

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
        <Card
            elevation={4}
            sx={{
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: 2,
                ...sx,
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Iconify
                        icon={icon}
                        width={24}
                        height={24}
                        color={borderColor}
                        style={{ marginRight: 8 }}
                    />
                    <Typography variant="h6" component="div">
                        {title}
                    </Typography>
                </Box>
                {children}
            </CardContent>
        </Card>
    )
}
