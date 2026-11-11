import type { MetadataRoute } from 'next'
import { SITE_URL } from 'src/utils/seo'

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/auth/'] }],
        sitemap: `${SITE_URL}/sitemap.xml`,
    }
}
