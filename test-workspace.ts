import { McpClient } from './lib/mcpClient'

async function test() {
    console.log('--- Focused Google Workspace Test ---')
    const client = new McpClient({
        id: 'google-workspace',
        name: 'Google Workspace',
        transport: 'http',
        url: 'https://google-workspace-mcp-server-554655392699.us-central1.run.app/mcp',
        headers: {},
    })

    console.log('Calling listTools()...')
    try {
        const tools = await client.listTools()
        console.log(`Tools found: ${tools.length}`)
        if (tools.length > 0) {
            tools.forEach(t => console.log(` - ${t.name}`))
        }
    } catch (err) {
        console.error('Error during listTools:', err)
    }
}

test().catch(console.error)
