import { Card, CardContent, Box, Typography, Stack } from '@mui/material'
import { Iconify } from '../iconify'

// Reusable ProfileCard component
interface KeyValueProps {
    title: string
    content: string | React.ReactNode
}

export const KeyValue: React.FC<KeyValueProps> = ({ title, content }) => {
    return (
        <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            marginTop={1}
            sx={{ borderBottom: `1px solid grey` }}
        >
            <Typography variant="subtitle2">{title}</Typography>
            <Typography variant="subtitle1" fontWeight="bold" color="primary">
                {content}
            </Typography>
        </Stack>
    )
}
