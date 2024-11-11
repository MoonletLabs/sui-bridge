import fs from 'fs'

const processKey = (path: string, local_env: string | undefined) => {
    let key: string | undefined = undefined
    if (fs.existsSync(path)) {
        key = fs.readFileSync(path, 'utf8').trim()
    } else {
        // local env
        key = local_env
    }
    try {
        return JSON.parse(key || '')
    } catch {
        return key
    }
}

const SUI_BRIDGE_POSTGRES_URL = processKey(
    '/run/secrets/sui-bridge-postgres-url',
    process.env.SUI_BRIDGE_POSTGRES_URL,
)

const SUI_BRIDGE_TESTNET_POSTGRES_URL = processKey(
    '/run/secrets/sui-bridge-testnet-postgres-url',
    process.env.SUI_BRIDGE_TESTNET_POSTGRES_URL,
)

export { SUI_BRIDGE_POSTGRES_URL, SUI_BRIDGE_TESTNET_POSTGRES_URL }
