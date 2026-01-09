import { spawn, ChildProcess } from "child_process"
import type { McpServerConfig, JsonRpcEnvelope, JsonRpcResponse } from "./mcpClient"

interface StdioClientSession {
    process: ChildProcess
    config: McpServerConfig
    requestQueue: Array<{
        payload: JsonRpcEnvelope
        resolve: (value: JsonRpcResponse) => void
        reject: (error: Error) => void
    }>
    processing: boolean
    currentRequest: {
        payload: JsonRpcEnvelope
        resolve: (value: JsonRpcResponse) => void
        reject: (error: Error) => void
    } | null
    stdoutBuffer: string
    initialized: boolean
}

class StdioClientManager {
    private static instance: StdioClientManager
    private sessions: Map<string, StdioClientSession> = new Map()

    private constructor() { }

    static getInstance(): StdioClientManager {
        if (!StdioClientManager.instance) {
            StdioClientManager.instance = new StdioClientManager()
        }
        return StdioClientManager.instance
    }

    async getSession(config: McpServerConfig): Promise<StdioClientSession> {
        const serverId = config.id
        let session = this.sessions.get(serverId)

        if (session && !session.process.killed) {
            return session
        }

        if (session) {
            // Cleanup dead session
            this.cleanupSession(serverId)
        }

        // Create new session
        const isWindows = process.platform === "win32"
        const command = isWindows && config.command === "npx" ? "npx.cmd" : config.command

        if (!command) {
            throw new Error(`No command specified for stdio server: ${serverId}`)
        }

        console.log(`[Stdio Manager] Spawning process for ${serverId}: ${command} ${(config.args || []).join(" ")}`)

        const proc = spawn(command, config.args ?? [], {
            env: { ...process.env, ...(config.env ?? {}) },
            stdio: ["pipe", "pipe", "pipe"],
            shell: isWindows,
        })

        session = {
            process: proc,
            config,
            requestQueue: [],
            processing: false,
            currentRequest: null,
            stdoutBuffer: "",
            initialized: false,
        }

        this.sessions.set(serverId, session)
        this.setupProcessHandlers(session, serverId)

        // Perform initialization handshake
        await this.initializeSession(session)

        return session
    }

    private setupProcessHandlers(session: StdioClientSession, serverId: string) {
        if (!session.process.stdout || !session.process.stderr) return

        session.process.stdout.on("data", (chunk) => {
            session.stdoutBuffer += chunk.toString()

            // MCP/JSON-RPC protocol sends one complete message per line
            let boundary = session.stdoutBuffer.indexOf('\n')
            while (boundary !== -1) {
                const message = session.stdoutBuffer.substring(0, boundary).trim()
                session.stdoutBuffer = session.stdoutBuffer.substring(boundary + 1)

                if (message && session.currentRequest) {
                    try {
                        // Check if line is valid JSON. If not, it might be a log line.
                        // If it starts with {, it's likely our JSON response.
                        if (message.startsWith('{')) {
                            const parsed = JSON.parse(message) as JsonRpcResponse
                            // Match response to request by ID (JSON-RPC standard)
                            if (parsed.id === session.currentRequest.payload.id) {
                                session.currentRequest.resolve(parsed)
                                session.currentRequest = null
                                session.processing = false
                                this.processNextRequest(session)
                            } else if (parsed.jsonrpc) {
                                // Notifications or mismatched IDs - ignore for now or log
                                console.log(`[Stdio Manager] Received unexpected JSON from ${serverId}:`, message.substring(0, 100))
                            }
                        } else {
                            // Log line that made it to stdout?
                            console.log(`[Stdio Manager] ${serverId} stdout non-JSON:`, message)
                        }
                    } catch (e) {
                        console.error(`[Stdio Manager] Failed to parse JSON response from ${serverId}:`, e)
                        // Do NOT reject the current request yet - maybe the real JSON is coming in the next line?
                        // But usually unexpected output means we should probably log it.
                    }
                }
                boundary = session.stdoutBuffer.indexOf('\n')
            }
        })

        session.process.stderr.on("data", (chunk) => {
            const chunkStr = chunk.toString()
            if (chunkStr.trim()) {
                console.error(`[Stdio Manager] ${serverId} stderr:`, chunkStr.trim())
            }
        })

        session.process.on("error", (err) => {
            console.error(`[Stdio Manager] Process error for ${serverId}:`, err)
            this.cleanupSession(serverId, err)
        })

        session.process.on("close", (code) => {
            console.log(`[Stdio Manager] Process for ${serverId} closed with code ${code}`)
            this.cleanupSession(serverId, new Error(`Process exited with code ${code}`))
        })
    }

    private async initializeSession(session: StdioClientSession) {
        console.log(`[Stdio Manager] Initializing session for ${session.config.id}`)
        const initPayload: JsonRpcEnvelope = {
            jsonrpc: "2.0",
            id: `init-${crypto.randomUUID()}`,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: {
                    name: "project-nexus",
                    version: "1.0.0"
                }
            }
        }

        // We send this directly via internal call to avoid queueing it behind other things?
        // No, we should use the queue to ensure ordering.
        // But we need to bypass 'ensureProcess' checks in 'call'.

        // Helper to push to queue and wait
        return new Promise<void>((resolve, reject) => {
            session.requestQueue.push({
                payload: initPayload,
                resolve: (res) => {
                    session.initialized = true
                    // We also need to send 'notifications/initialized' according to spec?
                    // Some servers require it.
                    // For now, let's assume 'initialize' response is enough.
                    resolve()
                },
                reject: reject
            })
            this.processNextRequest(session)
        })
    }

    async call(payload: JsonRpcEnvelope, config: McpServerConfig): Promise<JsonRpcResponse> {
        const session = await this.getSession(config)

        return new Promise((resolve, reject) => {
            session.requestQueue.push({ payload, resolve, reject })
            this.processNextRequest(session)
        })
    }

    private processNextRequest(session: StdioClientSession) {
        if (session.processing || session.requestQueue.length === 0 || !session.process || session.process.killed) {
            return
        }

        // IMPORTANT: If this is NOT the init request, and we are not initialized, we should wait?
        // Actually, getSession ensures initialization is done (awaited) before returning session.
        // So any subsequent calls calling getSession will wait for init to complete.
        // However, if we queue multiple calls rapidly, getSession might return the SAME session while it's still initializing.
        // But initializeSession pushes the Init request FIRST. So it will be processed first.

        const request = session.requestQueue.shift()
        if (!request) return

        session.processing = true
        session.currentRequest = request

        try {
            if (!session.process.stdin || session.process.stdin.destroyed) {
                request.reject(new Error("Process stdin is not available"))
                session.currentRequest = null
                session.processing = false
                this.processNextRequest(session)
                return
            }

            const payloadStr = JSON.stringify(request.payload) + "\n"
            session.process.stdin.write(payloadStr, (error) => {
                if (error) {
                    request.reject(error)
                    session.currentRequest = null
                    session.processing = false
                    this.processNextRequest(session)
                }
            })
        } catch (error) {
            request.reject(error as Error)
            session.currentRequest = null
            session.processing = false
            this.processNextRequest(session)
        }
    }

    private cleanupSession(serverId: string, error?: Error) {
        const session = this.sessions.get(serverId)
        if (!session) return

        if (session.process && !session.process.killed) {
            session.process.kill()
        }

        // Reject pending
        while (session.requestQueue.length > 0) {
            const req = session.requestQueue.shift()
            if (req) req.reject(error || new Error("Session terminated"))
        }

        if (session.currentRequest) {
            session.currentRequest.reject(error || new Error("Session terminated"))
        }

        this.sessions.delete(serverId)
    }
}

export const stdioClientManager = StdioClientManager.getInstance()
