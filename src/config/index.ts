import CONFIG_LOCAL from './local'
import CONFIG_PROD from './prod'
import { AppConfig } from './types'

// Rendering on the server has no page to ask: production's address, or the local one with APP_ENV=local.
let CONFIG: AppConfig = process.env.APP_ENV === 'local' ? CONFIG_LOCAL : CONFIG_PROD

// In the browser the API is always the page's own origin: the dashboard and its /api are one app, served the
// same way in production, in the preview and locally. A table of known hostnames sent every other host (the
// preview, www) to production's API instead, a cross-origin call that the page's CSP blocks and that would
// reach the wrong backend anyway.
if (typeof document !== 'undefined') {
    CONFIG = { ...CONFIG, apiBaseUrl: document.location.origin }
}

CONFIG = { ...CONFIG }

export { CONFIG }
export default CONFIG
