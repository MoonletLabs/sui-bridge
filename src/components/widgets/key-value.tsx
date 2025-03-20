import { Box, Typography } from '@mui/material'

interface KeyValueProps {
    title: string
    content: string | React.ReactNode
}

export const KeyValue: React.FC<KeyValueProps> = ({ title, content }) => {
    return (
        <Box
            sx={theme => ({
                py: 1,
                borderBottom: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                justifyContent: 'space-between',
            })}
        >
            <Typography variant="subtitle2" color="text.secondary">
                {title}
            </Typography>
            <Typography variant="subtitle1" fontWeight="bold" color="primary">
                {content}
            </Typography>
        </Box>
    )
}
