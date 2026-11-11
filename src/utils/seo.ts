import type { Metadata } from 'next'

export const SITE_URL = 'https://suianalytics.io'
export const SITE_NAME = 'Sui Analytics'
export const SITE_TITLE = 'Sui Bridge Analytics'
export const SITE_DESCRIPTION =
    'SUI Bridge Analytics Dashboard - Track bridge transactions, volume, and performance metrics'

/**
 * Link previews (Slack, X, ...) need an absolute image URL. They also cache the
 * image by that URL, so bump OG_IMAGE_VERSION whenever public/og.jpg changes,
 * otherwise they keep showing the old one.
 * The file is a 2400x1260 JPEG (2x of the 1200x630 card, so text stays sharp when
 * downscaled) kept under ~300 KB, which WhatsApp requires.
 */
const OG_IMAGE_VERSION = 3
export const OG_IMAGE = `${SITE_URL}/og.jpg?v=${OG_IMAGE_VERSION}`

const ogImages = [{ url: OG_IMAGE, width: 2400, height: 1260, alt: SITE_TITLE }]

/**
 * Metadata for one route. Next.js replaces (not merges) `openGraph` and `twitter`
 * from a parent, so the image and site name are repeated here.
 */
export function pageMetadata({
    title,
    description,
    path,
}: {
    title: string
    description: string
    path: string
}): Metadata {
    const fullTitle = `${title} | ${SITE_NAME}`
    return {
        // Absolute: the root template is not applied to routes nested two levels deep
        title: { absolute: fullTitle },
        description,
        alternates: { canonical: path },
        openGraph: {
            type: 'website',
            siteName: SITE_NAME,
            title: fullTitle,
            description,
            url: `${SITE_URL}${path}`,
            images: ogImages,
        },
        twitter: {
            card: 'summary_large_image',
            title: fullTitle,
            description,
            images: [OG_IMAGE],
        },
    }
}
