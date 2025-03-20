import CONFIG_LOCAL from './local'
import CONFIG_PROD from './prod'
import CONFIG_DEV from './dev'
import { AppConfig } from './types'

let CONFIG: AppConfig = CONFIG_PROD

if (typeof document !== 'undefined') {
    const hostname = document?.location?.hostname?.toLowerCase()

    if (/^localhost$/.test(hostname)) {
        CONFIG = CONFIG_LOCAL
    }

    if (/^(.*\.)?[^.]+\.cloud$/.test(hostname)) {
        console.log('is_prod')
        CONFIG = CONFIG_PROD
    }
}

if (process.env.APP_ENV) {
    switch (process.env.APP_ENV) {
        case 'local':
            CONFIG = CONFIG_LOCAL
            break
        case 'dev':
            CONFIG = CONFIG_DEV
            break
        default:
            CONFIG = CONFIG_PROD
            break
    }
}

CONFIG = { ...CONFIG }

export { CONFIG }
export default CONFIG
