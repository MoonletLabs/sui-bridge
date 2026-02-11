'use client'

import type { ContainerProps } from '@mui/material/Container'

import Container from '@mui/material/Container'

import { layoutClasses } from 'src/layouts/classes'
import { useSettingsContext } from 'src/components/settings'

// ----------------------------------------------------------------------

type DashboardContentProps = ContainerProps & {
    disablePadding?: boolean
}

export function DashboardContent({
    sx,
    children,
    disablePadding,
    maxWidth = 'xl',
    ...other
}: DashboardContentProps) {
    const settings = useSettingsContext()

    return (
        <Container
            className={layoutClasses.content}
            maxWidth={settings.compactLayout ? maxWidth : false}
            sx={{
                display: 'flex',
                flex: '1 1 auto',
                flexDirection: 'column',
                ...(disablePadding && { p: 0 }),
                ...sx,
            }}
            {...other}
        >
            {children}
        </Container>
    )
}
