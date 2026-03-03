'use client'

import type { BoxProps } from '@mui/material/Box'

import { forwardRef } from 'react'

import Box from '@mui/material/Box'

import { RouterLink } from 'src/routes/components'

import { logoClasses } from './classes'
import { CONFIG } from 'src/config-global'

// ----------------------------------------------------------------------

export type LogoProps = BoxProps & {
    href?: string
    disableLink?: boolean
    single?: boolean // Use small/single logo
}

export const Logo = forwardRef<HTMLDivElement, LogoProps>(
    ({ href = '/', disableLink = false, single = false, className, sx, ...other }, ref) => {
        const logoSrc = single
            ? '/assets/icons/brands/single-logo.svg'
            : `${CONFIG.assetsDir}/sui.svg`

        return (
            <Box
                ref={ref}
                component={disableLink ? 'div' : RouterLink}
                href={disableLink ? undefined : href}
                className={logoClasses.root.concat(className ? ` ${className}` : '')}
                aria-label="Logo"
                sx={{
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    ...(disableLink && { pointerEvents: 'none' }),
                    ...sx,
                }}
                {...other}
            >
                <Box
                    alt="Sui Bridge Analytics"
                    component="img"
                    src={logoSrc}
                    sx={{
                        height: single ? 28 : 32,
                        width: 'auto',
                    }}
                />
            </Box>
        )
    },
)
