import { NextResponse } from "next/server"

// Mock workflows endpoint for development
export async function GET() {
  const mockWorkflows = [
    {
      id: "wf-1",
      message_id: "msg-001",
      type: "vision",
      status: "completed",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      completed_at: new Date(Date.now() - 3000000).toISOString(),
      payload: { file_url: "invoice-jan.pdf", instructions: "Extract invoice data" },
    },
    {
      id: "wf-2",
      message_id: "msg-002",
      type: "tool",
      status: "processing",
      created_at: new Date(Date.now() - 600000).toISOString(),
      payload: { tool_name: "stripe_payment", amount: 1234.56 },
    },
    {
      id: "wf-3",
      message_id: "msg-003",
      type: "vision",
      status: "pending",
      created_at: new Date(Date.now() - 120000).toISOString(),
      payload: { file_url: "receipt-scan.jpg" },
    },
  ]

  return NextResponse.json({ workflows: mockWorkflows })
}
