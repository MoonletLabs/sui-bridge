import 'src/global.css'

// ----------------------------------------------------------------------
import type { Metadata, Viewport } from 'next'

import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'

import { CONFIG } from 'src/config-global'
import { primary } from 'src/theme/core/palette'
import { schemeConfig } from 'src/theme/scheme-config'
import { ThemeProvider } from 'src/theme/theme-provider'

import { ProgressBar } from 'src/components/progress-bar'
import { MotionLazy } from 'src/components/animate/motion-lazy'
import { SettingsDrawer, defaultSettings, SettingsProvider } from 'src/components/settings'

import { AuthProvider } from 'src/auth/context/jwt'
import { GlobalProvider } from 'src/provider/global-provider'

// ----------------------------------------------------------------------

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: primary.main,
}

const SITE_URL = 'https://suianalytics.io'
const SITE_TITLE = 'Sui Bridge Analytics'
// Link previews (Slack, X, ...) need an absolute image URL
const OG_IMAGE = `${SITE_URL}/og.png`
const SITE_DESCRIPTION =
    'SUI Bridge Analytics Dashboard - Track bridge transactions, volume, and performance metrics'

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: 'Sui Analytics',
        template: '%s | Sui Analytics',
    },
    description: SITE_DESCRIPTION,
    openGraph: {
        type: 'website',
        siteName: 'Sui Analytics',
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_TITLE }],
    },
    twitter: {
        card: 'summary_large_image',
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        images: [OG_IMAGE],
    },
    icons: [
        {
            rel: 'icon',
            url: `${CONFIG.assetsDir}/favicon.ico`,
        },
    ],
}

type Props = {
    children: React.ReactNode
}

export default async function RootLayout({ children }: Props) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>
                <InitColorSchemeScript
                    defaultMode={schemeConfig.defaultMode}
                    modeStorageKey={schemeConfig.modeStorageKey}
                />

                <AuthProvider>
                    <GlobalProvider>
                        <SettingsProvider settings={defaultSettings}>
                            <ThemeProvider>
                                <MotionLazy>
                                    <ProgressBar />
                                    <SettingsDrawer />
                                    {children}
                                </MotionLazy>
                            </ThemeProvider>
                        </SettingsProvider>
                    </GlobalProvider>
                </AuthProvider>
            </body>
        </html>
    )
}
