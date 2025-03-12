'use client'

import type { BoxProps } from '@mui/material/Box'

import { forwardRef } from 'react'

import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'

import { RouterLink } from 'src/routes/components'

import { logoClasses } from './classes'
import { CONFIG } from 'src/config-global'

// ----------------------------------------------------------------------

export type LogoProps = BoxProps & {
    href?: string
    isSingle?: boolean
    disableLink?: boolean
    isLarge?: boolean
}

export const Logo = forwardRef<HTMLDivElement, LogoProps>(
    (
        {
            isLarge,
            width,
            href = '/',
            height,
            isSingle = true,
            disableLink = false,
            className,
            sx,
            ...other
        },
        ref,
    ) => {
        const theme = useTheme()

        const fullLogo = (
            <Box
                alt="Full logo"
                component="img"
                src={`${CONFIG.assetsDir}/sui.svg`}
                sx={{
                    alignSelf: 'center',
                    placeSelf: 'center',
                }}
            />
        )

        const singleLogo = (
            <img
                alt="Single logo"
                src={`/assets/icons/brands/single-logo.svg`}
                style={{ width: 200, height: 35, marginTop: 55 }}
            />
        )

        return (
            <Box
                ref={ref}
                component={RouterLink}
                href={href}
                className={logoClasses.root.concat(className ? ` ${className}` : '')}
                aria-label="Logo"
                sx={{
                    // ...baseSize,
                    flexShrink: 0,
                    display: 'inline-flex',
                    verticalAlign: 'middle',
                    ...(disableLink && { pointerEvents: 'none' }),
                    ...sx,
                    width: '150px',
                    height: '150px',
                }}
                {...other}
            >
                {isLarge ? fullLogo : singleLogo}
            </Box>
        )
    },
)
