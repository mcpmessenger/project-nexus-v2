import { NextResponse } from "next/server"
import { getSupabaseClient } from "@/lib/get-user-session"

// JSON metrics endpoint for dashboard consumption
export async function GET() {
  try {
    const supabase = await getSupabaseClient()
    
    // Query real metrics from task_metrics table
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString()
    
    // Get total processed tasks (success) in last hour
    const { count: processedCount } = await supabase
      .from('task_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'success')
      .gte('created_at', oneHourAgo)
    
    // Get total failed tasks in last hour
    const { count: failedCount } = await supabase
      .from('task_metrics')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', oneHourAgo)
    
    // Get active workers (tasks that completed or are pending in last 30 seconds)
    const { count: activeWorkersCount } = await supabase
      .from('task_metrics')
      .select('*', { count: 'exact', head: true })
      .in('status', ['success', 'pending'])
      .gte('created_at', thirtySecondsAgo)
    
    // Get metrics by server type
    const { data: metricsByServer } = await supabase
      .from('task_metrics')
      .select('server_id, status')
      .gte('created_at', oneHourAgo)
    
    // Calculate metrics by server
    const serverMetrics: Record<string, { processed: number; failed: number }> = {}
    if (metricsByServer) {
      for (const metric of metricsByServer) {
        if (!serverMetrics[metric.server_id]) {
          serverMetrics[metric.server_id] = { processed: 0, failed: 0 }
        }
        if (metric.status === 'success') {
          serverMetrics[metric.server_id].processed++
        } else if (metric.status === 'failed') {
          serverMetrics[metric.server_id].failed++
        }
      }
    }
    
    // Get time-series data for charts (last 5 minutes, aggregated by minute)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: timeSeriesData } = await supabase
      .from('task_metrics')
      .select('created_at, status')
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: true })
    
    // Build time-series data points (aggregate by minute)
    const timeSeries: Record<string, { processed: number; failed: number; active: number }> = {}
    if (timeSeriesData) {
      for (const metric of timeSeriesData) {
        const minute = new Date(metric.created_at).toISOString().substring(0, 16) // Round to minute
        if (!timeSeries[minute]) {
          timeSeries[minute] = { processed: 0, failed: 0, active: 0 }
        }
        if (metric.status === 'success') {
          timeSeries[minute].processed++
        } else if (metric.status === 'failed') {
          timeSeries[minute].failed++
        }
        // Count as active if within last 30 seconds
        if (new Date(metric.created_at) >= new Date(thirtySecondsAgo)) {
          timeSeries[minute].active++
        }
      }
    }
    
    // Build response with real data
    const metrics = {
      workers: {
        total: 0, // Not tracking individual workers yet
        active: activeWorkersCount || 0,
        idle: 0,
        error: 0,
        byType: {
          router: 0,
          vision: 0,
          tool: 0,
        },
      },
      tasks: {
        processed: processedCount || 0,
        failed: failedCount || 0,
        timeSeries: Object.entries(timeSeries).map(([time, data]) => ({
          time,
          processed: data.processed,
          failed: data.failed,
          active: data.active,
        })),
        byType: {
          router: serverMetrics['router']?.processed || 0,
          vision: serverMetrics['vision']?.processed || 0,
          tool: serverMetrics['tool']?.processed || 0,
          exa: serverMetrics['exa']?.processed || 0,
          github: serverMetrics['github']?.processed || 0,
          playwright: serverMetrics['playwright']?.processed || 0,
          maps: serverMetrics['maps']?.processed || 0,
          langchain: serverMetrics['langchain']?.processed || 0,
        },
        failedByType: {
          router: serverMetrics['router']?.failed || 0,
          vision: serverMetrics['vision']?.failed || 0,
          tool: serverMetrics['tool']?.failed || 0,
          exa: serverMetrics['exa']?.failed || 0,
          github: serverMetrics['github']?.failed || 0,
          playwright: serverMetrics['playwright']?.failed || 0,
          maps: serverMetrics['maps']?.failed || 0,
          langchain: serverMetrics['langchain']?.failed || 0,
        },
      },
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
