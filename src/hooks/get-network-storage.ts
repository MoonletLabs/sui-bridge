import { useGlobalContext } from 'src/provider/global-provider'

export enum NETWORK {
    MAINNET = 'mainnet',
    TESTNET = 'testnet',
}

export const Networks = [
    { value: NETWORK.MAINNET, label: 'Mainnet' },
    { value: NETWORK.TESTNET, label: 'Testnet' },
]

export function getNetwork() {
    const { network } = useGlobalContext()
    return network
}

export function setNetwork(newNetwork: NETWORK) {
    const { setNetwork } = useGlobalContext()
    setNetwork(newNetwork)
}
