import type { MetadataRoute } from 'next'
import { SITE_URL } from 'src/utils/seo'

const ROUTES = ['/', '/health', '/governance', '/flows', '/tokens', '/transactions', '/leaderboard']

export default function sitemap(): MetadataRoute.Sitemap {
    return ROUTES.map(path => ({
        url: `${SITE_URL}${path === '/' ? '' : path}`,
        changeFrequency: path === '/governance' ? 'daily' : 'hourly',
    }))
}
