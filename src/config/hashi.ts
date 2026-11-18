// Hashi (Sui's Bitcoin orchestrator) deployments. Values come from the Hashi docs:
// https://mystenlabs.github.io/hashi/design/reference/networks.md
// Hashi is a regular Move package, so everything here is read from Sui itself.

export type HashiNetworkConfig = {
    /** Public Sui GraphQL endpoint (JSON-RPC is deprecated on public fullnodes) */
    graphql: string
    packageId: string
    hashiObjectId: string
    /** Bitcoin network the deployment is paired with */
    bitcoin: 'mainnet' | 'signet'
}

export const HASHI_NETWORKS: Record<'mainnet' | 'testnet', HashiNetworkConfig> = {
    mainnet: {
        graphql: 'https://graphql.mainnet.sui.io/graphql',
        packageId: '0xd30fb3f8914efdbeb7b8e85fae1d65dc584b44a1281f66737b92bb9f03a59d06',
        hashiObjectId: '0x8d110642d9b5133bd661cda4873edf135ab6b91ff6918601015880874b950e5d',
        bitcoin: 'mainnet',
    },
    testnet: {
        graphql: 'https://graphql.testnet.sui.io/graphql',
        packageId: '0x5e0b99c31f691742acea5de4ca1bf53c398d5639fed6503a51ffe8035dc68485',
        hashiObjectId: '0x342e908043db6090558ed7766df95bfc3609881b2eac7edb5343dd5bb3ddd1bb',
        bitcoin: 'signet',
    },
}

export const getHashiConfig = (network: string): HashiNetworkConfig =>
    network === 'testnet' ? HASHI_NETWORKS.testnet : HASHI_NETWORKS.mainnet

export const SATS_PER_BTC = 100_000_000
