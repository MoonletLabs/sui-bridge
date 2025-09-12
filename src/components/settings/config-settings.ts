import { defaultFont } from 'src/theme/core/typography'

import type { SettingsState } from './types'

// ----------------------------------------------------------------------

export const STORAGE_KEY = 'sui-analytics-default-settings'

export const defaultSettings: SettingsState = {
    colorScheme: 'dark',
    direction: 'ltr',
    contrast: 'default',
    navLayout: 'mini',
    primaryColor: 'default',
    navColor: 'integrate',
    compactLayout: true,
    fontFamily: defaultFont,
} as const
