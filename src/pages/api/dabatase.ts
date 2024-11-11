/**
 * Repo Client
 *
 * https://github.com/porsager/postgres
 */

import postgres from 'postgres'
import { SUI_BRIDGE_POSTGRES_URL, SUI_BRIDGE_TESTNET_POSTGRES_URL } from './secrets'

const config = {
    max: 10, // Max connections in pool
    idle_timeout: 60, // Close idle connections after 60 seconds
}

export default {
    mainnet: postgres(SUI_BRIDGE_POSTGRES_URL, config),
    testnet: postgres(SUI_BRIDGE_TESTNET_POSTGRES_URL, config),
}
