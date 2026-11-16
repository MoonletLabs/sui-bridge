// Minimal client for Sui's public GraphQL endpoint. No SDK: the dashboard only needs
// object reads and dynamic-field (table) listings.

type GraphqlResponse<T> = { data?: T; errors?: { message: string }[] }

export async function suiGraphql<T>(
    endpoint: string,
    query: string,
    variables: Record<string, unknown> = {},
    timeoutMs = 15000,
): Promise<T> {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new Error(`Sui GraphQL responded ${res.status}`)
    const body = (await res.json()) as GraphqlResponse<T>
    if (body.errors?.length || !body.data) {
        throw new Error(body.errors?.[0]?.message || 'Sui GraphQL returned no data')
    }
    return body.data
}

const TABLE_QUERY = `
query ($table: SuiAddress!, $first: Int, $last: Int, $after: String) {
    address(address: $table) {
        dynamicFields(first: $first, last: $last, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
                name { json }
                value {
                    ... on MoveObject { contents { type { repr } json } }
                    ... on MoveValue { type { repr } json }
                }
            }
        }
    }
}`

export type TableEntry<T = any> = { name: any; value: T; type?: string }

type TableResponse = {
    address: {
        dynamicFields: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null }
            nodes: { name: { json: any }; value: any }[]
        }
    } | null
}

/**
 * Every entry of a Move `Table` / `ObjectTable` (its dynamic fields), following
 * pagination. `pageSize` is small for tables whose values are large.
 */
export async function readTable<T = any>(
    endpoint: string,
    tableId: string,
    { pageSize = 50, maxPages = 20 }: { pageSize?: number; maxPages?: number } = {},
): Promise<TableEntry<T>[]> {
    const out: TableEntry<T>[] = []
    let after: string | null = null
    for (let page = 0; page < maxPages; page += 1) {
        const data: TableResponse = await suiGraphql<TableResponse>(endpoint, TABLE_QUERY, {
            table: tableId,
            first: pageSize,
            after,
        })
        const fields = data.address?.dynamicFields
        if (!fields) break
        fields.nodes.forEach(node => {
            // Object-valued entries wrap their JSON in `contents`
            const body = node.value?.contents ?? node.value
            out.push({ name: node.name?.json, value: body?.json ?? null, type: body?.type?.repr })
        })
        if (!fields.pageInfo.hasNextPage) break
        after = fields.pageInfo.endCursor
    }
    return out
}
