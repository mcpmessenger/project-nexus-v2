import { supabase } from './lib/supabase-client'
import { McpClient } from './lib/mcpClient'

async function test() {
    console.log('--- Tool Fetch Test ---')
    try {
        const { data: servers, error } = await supabase
            .from('system_servers')
            .select('id, name, config, enabled')
            .eq('enabled', true)

        if (error || !servers) {
            console.error('Error fetching servers:', error)
            return
        }

        console.log(`Found ${servers.length} enabled servers.`)

        for (const server of servers) {
            console.log(`\n--- Server: ${server.id} ---`)
            console.log(`Config: ${JSON.stringify(server.config)}`)

            const client = new McpClient({
                id: server.id,
                name: server.name,
                transport: server.config.transport as any,
                url: server.config.url,
                headers: server.config.headers || {},
            })

            const tools = await client.listTools()
            console.log(`Tools found: ${tools.length}`)
            if (tools.length > 0) {
                console.log(`Sample: ${tools[0].name}`)
            }
        }
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err)
    }
}

test().catch(console.error)
