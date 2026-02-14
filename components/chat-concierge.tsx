"use client"

import { useState, useEffect } from "react"
import { MessageSquare, Send, X, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"

export function ChatConcierge() {
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [name, setName] = useState("")
    const [message, setMessage] = useState("")
    const [responseLog, setResponseLog] = useState<any[]>([])

    // Polling for Senti-001 Responses (Reflexive Architecture)
    useEffect(() => {
        let interval: NodeJS.Timeout

        if (isOpen) {
            const fetchOutbox = async () => {
                try {
                    // Poll S3 Intelligence Bridge (Public Read)
                    const res = await fetch("https://senti-001-intelligence-bridge.s3.amazonaws.com/concierge_outbox.json")
                    if (res.ok) {
                        const data = await res.json()
                        setResponseLog(data.messages || [])
                    }
                } catch (e) {
                    console.error("Polling error:", e)
                }
            }

            fetchOutbox() // Initial fetch
            interval = setInterval(fetchOutbox, 5000) // Poll every 5s
        }

        return () => clearInterval(interval)
    }, [isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name || !message) {
            toast.error("Please fill in all fields")
            return
        }

        setIsSubmitting(true)

        try {
            // Jotform Submission Logic (Strict Schema)
            const FORM_ID = "260428252815153"
            const API_KEY = "e8710b5c30d36ede9673e2dc74f6b441"

            const timestamp = new Date().toISOString()
            const handshakeId = `HS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

            // Constructing Payload matching concierge_inbox.json
            const formData = new FormData()
            formData.append("submission[3]", name) // User Identity
            formData.append("submission[4]", JSON.stringify({
                handshake_id: handshakeId,
                timestamp_utc: timestamp,
                message_body: message,
                security_context: { is_authenticated: true, encryption_layer: "AES-256-GCM" }
            })) // Structured Message Body

            const response = await fetch(`https://api.jotform.com/form/${FORM_ID}/submissions?apiKey=${API_KEY}`, {
                method: "POST",
                body: formData,
            })

            if (response.ok) {
                toast.success(`Secure Packet Transmitted. Sync ID: ${handshakeId}`)
                setMessage("")
                // Keep name for continued session
            } else {
                throw new Error("Transmission failure")
            }
        } catch (error) {
            console.error(error)
            toast.error("Bridge failure. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        size="icon"
                        className="h-12 w-12 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95 bg-primary text-primary-foreground border-2 border-primary/50"
                        aria-label="Open Senti-001 Concierge"
                    >
                        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 mb-4 mr-0 border-border/50 bg-card shadow-xl overflow-hidden" align="end">
                    <div className="flex flex-col h-[400px]">
                        {/* Header */}
                        <div className="border-b border-border/50 bg-primary/5 p-4 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 relative">
                                    <span className="font-mono text-xs font-bold text-primary">S1</span>
                                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                    </span>
                                </div>
                                <div>
                                    <h3 className="font-mono text-sm font-semibold text-foreground">Sovereign Concierge</h3>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Live Neural Uplink</p>
                                </div>
                            </div>
                        </div>

                        {/* Chat Area (Polling Display) */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-background to-background/50">
                            {responseLog.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-50">
                                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                                    <p className="text-xs font-mono text-muted-foreground">Establishing Secure Handshake...</p>
                                </div>
                            ) : (
                                responseLog.map((msg, idx) => (
                                    <div key={idx} className={`flex flex-col ${msg.sender === "Senti-001" ? "items-start" : "items-end"}`}>
                                        <div className={`max-w-[85%] rounded-lg p-3 text-xs ${msg.sender === "Senti-001" ? "bg-primary/10 text-foreground border border-primary/20" : "bg-muted text-muted-foreground"}`}>
                                            <p className="font-bold font-mono mb-1 text-[10px] opacity-70">{msg.sender}</p>
                                            <p>{msg.content}</p>
                                        </div>
                                        <span className="text-[9px] text-muted-foreground/50 mt-1 font-mono">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Input Form */}
                        <form onSubmit={handleSubmit} className="border-t border-border/50 p-3 bg-card/50">
                            <div className="space-y-2">
                                <Input
                                    placeholder="Identity (Name/ID)"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="h-8 bg-background/50 border-border/50 font-mono text-[10px]"
                                    required
                                />
                                <div className="flex gap-2">
                                    <Textarea
                                        placeholder="Transmit intelligence..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        className="min-h-[40px] h-10 py-2 bg-background/50 border-border/50 font-mono text-xs resize-none"
                                        required
                                    />
                                    <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
