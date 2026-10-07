// ----------------------------------------------------------------------
// Decodes raw Sui bridge failure statuses into human readable categories.
//
// Abort codes are per-module and come from the Sui framework bridge package:
//   crates/sui-framework/packages/bridge/sources/bridge.move
//   crates/sui-framework/packages/bridge/sources/treasury.move
// ----------------------------------------------------------------------

export type FailureSeverity = 'user' | 'protocol' | 'unknown'

export type DecodedFailure = {
    /** Short human readable label, e.g. "Transfer not yet approved" */
    label: string
    /** Longer explanation of what happened and why */
    description: string
    /** Who/what is responsible - drives the colour coding in the UI */
    severity: FailureSeverity
    /** `module::function` when the failure came from a Move abort */
    location?: string
    /** Raw Move abort code when applicable */
    abortCode?: number
}

// bridge::bridge module abort codes
const BRIDGE_CODES: Record<
    number,
    { label: string; description: string; severity: FailureSeverity }
> = {
    0: {
        label: 'Unexpected message type',
        description: 'The bridge message type did not match what the operation expected.',
        severity: 'protocol',
    },
    1: {
        label: 'Unauthorised claim',
        description:
            'The transfer was claimed by an address other than the recipient, or before the committee signatures were recorded.',
        severity: 'user',
    },
    2: {
        label: 'Malformed message',
        description: 'The bridge message failed validation against the stored record.',
        severity: 'protocol',
    },
    3: {
        label: 'Unexpected token type',
        description:
            'The coin type used to claim did not match the token recorded in the transfer message.',
        severity: 'user',
    },
    4: {
        label: 'Unexpected chain ID',
        description: 'The source or destination chain did not match this bridge instance.',
        severity: 'protocol',
    },
    5: {
        label: 'Not system address',
        description: 'A privileged bridge function was called by a non-system address.',
        severity: 'protocol',
    },
    6: {
        label: 'Unexpected sequence number',
        description: 'The message sequence number did not match the expected next nonce.',
        severity: 'protocol',
    },
    7: {
        label: 'Wrong inner version',
        description: 'The bridge object version did not match the expected current version.',
        severity: 'protocol',
    },
    8: {
        label: 'Bridge paused',
        description:
            'The bridge was paused by an emergency operation when this transaction was submitted.',
        severity: 'protocol',
    },
    9: {
        label: 'Unexpected operation',
        description: 'An unknown emergency operation code was supplied.',
        severity: 'protocol',
    },
    10: {
        label: 'Invariant violation',
        description:
            'A Sui initiated transfer was unexpectedly already marked as claimed. This should not happen.',
        severity: 'protocol',
    },
    11: {
        label: 'Transfer not yet approved',
        description:
            'The claim was submitted before the bridge committee recorded its approval on Sui, so no matching transfer record existed yet. Waiting and retrying usually succeeds.',
        severity: 'user',
    },
    12: {
        label: 'Unexpected message version',
        description: 'The bridge message version is not supported by this bridge build.',
        severity: 'protocol',
    },
    13: {
        label: 'Bridge already paused',
        description: 'A pause operation was submitted while the bridge was already paused.',
        severity: 'protocol',
    },
    14: {
        label: 'Bridge not paused',
        description: 'An unpause operation was submitted while the bridge was not paused.',
        severity: 'protocol',
    },
    15: {
        label: 'Already claimed or limit hit',
        description:
            'The transfer was already claimed, or claiming it would exceed the bridge transfer rate limit.',
        severity: 'user',
    },
    16: {
        label: 'Invalid bridge route',
        description: 'The source to destination chain route is not a valid bridge route.',
        severity: 'protocol',
    },
    17: {
        label: 'Must be token message',
        description: 'A non token message was supplied to a token only operation.',
        severity: 'protocol',
    },
    18: {
        label: 'Invalid EVM address',
        description: 'The destination Ethereum address was not a valid 20 byte address.',
        severity: 'user',
    },
    19: {
        label: 'Zero token value',
        description: 'The transfer amount was zero.',
        severity: 'user',
    },
}

// bridge::treasury module abort codes
const TREASURY_CODES: Record<
    number,
    { label: string; description: string; severity: FailureSeverity }
> = {
    1: {
        label: 'Unsupported token',
        description: 'The coin type is not registered with the bridge treasury.',
        severity: 'user',
    },
    2: {
        label: 'Invalid upgrade cap',
        description: 'The supplied upgrade capability was not valid for token registration.',
        severity: 'protocol',
    },
    3: {
        label: 'Token supply non zero',
        description: 'A token was registered while its supply was not zero.',
        severity: 'protocol',
    },
    4: {
        label: 'Invalid notional value',
        description: 'The notional price supplied for the asset was invalid.',
        severity: 'protocol',
    },
}

// bridge::committee module abort codes
const COMMITTEE_CODES: Record<
    number,
    { label: string; description: string; severity: FailureSeverity }
> = {
    0: {
        label: 'Signatures below threshold',
        description:
            'The collected committee signatures did not reach the required stake threshold.',
        severity: 'protocol',
    },
    1: {
        label: 'Duplicated signature',
        description: 'The same committee member signed the message more than once.',
        severity: 'protocol',
    },
    2: {
        label: 'Invalid signature',
        description: 'A committee signature failed verification against the message.',
        severity: 'protocol',
    },
    3: {
        label: 'Not system address',
        description: 'A privileged committee function was called by a non-system address.',
        severity: 'protocol',
    },
    4: {
        label: 'Unknown blocklist key',
        description: 'The blocklist update referenced a public key that is not a committee member.',
        severity: 'protocol',
    },
    5: {
        label: 'Sender not active validator',
        description: 'Committee registration was attempted by a non active validator.',
        severity: 'user',
    },
    6: {
        label: 'Invalid pubkey length',
        description: 'The supplied bridge public key was not a valid compressed ECDSA key.',
        severity: 'user',
    },
    7: {
        label: 'Committee already initiated',
        description:
            'Registration was attempted after the bridge committee had already been initialised.',
        severity: 'user',
    },
    8: {
        label: 'Duplicate pubkey',
        description: 'The supplied bridge public key is already registered by another validator.',
        severity: 'user',
    },
    9: {
        label: 'Sender not in committee',
        description: 'The sender is not a member of the bridge committee.',
        severity: 'user',
    },
}

// Non Move execution failures reported by the Sui runtime
const RUNTIME_PATTERNS: {
    test: RegExp
    label: string
    description: string
    severity: FailureSeverity
}[] = [
    {
        test: /insufficient gas/i,
        label: 'Insufficient gas',
        description: 'The transaction ran out of gas before it could complete.',
        severity: 'user',
    },
    {
        test: /insufficient coin balance/i,
        label: 'Insufficient balance',
        description: 'The sender did not hold enough balance to pay for the operation.',
        severity: 'user',
    },
    {
        test: /object.*not found|could not find/i,
        label: 'Object not found',
        description: 'A referenced object did not exist at execution time.',
        severity: 'user',
    },
]

const MOVE_ABORT_REGEX = /Location:\s*([0-9a-fA-Fx]+)::(\w+)::(\w+)[^,]*,\s*Abort Code:\s*(\d+)/

/**
 * Turn a raw `sui_error_transactions.failure_status` string into a friendly,
 * grouped description. Unknown shapes fall back to the raw text so nothing is
 * silently hidden from operators.
 */
export function decodeBridgeFailure(raw: string | null | undefined): DecodedFailure {
    if (!raw) {
        return {
            label: 'Unknown failure',
            description: 'No failure status was recorded for this transaction.',
            severity: 'unknown',
        }
    }

    const moveMatch = raw.match(MOVE_ABORT_REGEX)
    if (moveMatch) {
        const [, , moduleName, functionName, codeRaw] = moveMatch
        const abortCode = Number(codeRaw)
        const location = `${moduleName}::${functionName}`

        const tables: Record<string, Record<number, (typeof BRIDGE_CODES)[number]>> = {
            bridge: BRIDGE_CODES,
            treasury: TREASURY_CODES,
            committee: COMMITTEE_CODES,
        }
        const known = tables[moduleName]?.[abortCode]

        if (known) {
            return { ...known, location, abortCode }
        }

        return {
            label: `Move abort ${abortCode}`,
            description: `Aborted in ${location} with code ${abortCode}.`,
            severity: 'unknown',
            location,
            abortCode,
        }
    }

    const runtime = RUNTIME_PATTERNS.find(p => p.test.test(raw))
    if (runtime) {
        const { test, ...rest } = runtime
        return rest
    }

    return {
        // Keep the raw text readable but bounded
        label: raw.length > 60 ? `${raw.slice(0, 57)}...` : raw,
        description: raw,
        severity: 'unknown',
    }
}

/** Stable grouping key so identical failures aggregate together */
export function failureGroupKey(raw: string | null | undefined): string {
    const d = decodeBridgeFailure(raw)
    return d.location && d.abortCode !== undefined ? `${d.location}#${d.abortCode}` : d.label
}
