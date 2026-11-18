export const log = (level: 'info' | 'warn' | 'error', msg: string, extra: object = {}) =>
    console.log(JSON.stringify({ t: new Date().toISOString(), level, msg, ...extra }))
