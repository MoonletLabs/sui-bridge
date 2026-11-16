'use client'

import { HashiGovernanceSection } from 'src/components/hashi/hashi-governance'
import { HashiShell } from 'src/components/hashi/hashi-shell'
import { useHashiGovernance } from 'src/hooks/use-hashi'

export default function HashiGovernancePage() {
    const { data, isLoading, error } = useHashiGovernance()

    return (
        <HashiShell title="Hashi Governance" error={error}>
            <HashiGovernanceSection data={data} loading={isLoading} />
        </HashiShell>
    )
}
