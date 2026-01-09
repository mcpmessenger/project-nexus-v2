"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Camera, X, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

interface CameraCaptureProps {
  onCapture: (file: File) => void
  onClose: () => void
  className?: string
}

export function CameraCapture({ onCapture, onClose, className }: CameraCaptureProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const [isCapturing, setIsCapturing] = React.useState(false)
  const [facingMode, setFacingMode] = React.useState<"user" | "environment">("environment")
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    startCamera()
    return () => {
      stopCamera()
    }
  }, [facingMode])

  const startCamera = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error("Camera access error:", err)
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError("Camera permission denied. Please enable camera access in your browser settings.")
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setError("No camera found on this device.")
        } else {
          setError(`Camera error: ${err.message}`)
        }
      } else {
        setError("Failed to access camera. Please check your browser settings.")
      }
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext("2d")

    if (!context) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera-capture-${Date.now()}.jpg`, {
          type: "image/jpeg",
        })
        onCapture(file)
        setIsCapturing(false)
        stopCamera()
        onClose()
      }
    }, "image/jpeg", 0.9)
  }

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
  }

  const handleClose = () => {
    stopCamera()
    onClose()
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-black/90 flex items-center justify-center",
        className
      )}
      onClick={handleClose}
    >
      <Card
        className="w-full h-full max-w-4xl max-h-[90vh] flex flex-col bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="flex-1 flex flex-col p-0 relative">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm"
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Camera Preview */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            {error ? (
              <div className="text-center p-8 text-white">
                <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg mb-2">Camera Error</p>
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button
                  variant="outline"
                  onClick={startCamera}
                  className="mt-4"
                >
                  Retry
                </Button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
                <canvas ref={canvasRef} className="hidden" />
              </>
            )}
          </div>

          {/* Controls */}
          {!error && (
            <div className="p-4 bg-background border-t border-border flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleFacingMode}
                className="h-12 w-12 rounded-full"
                title="Switch camera"
              >
                <RotateCcw className="h-5 w-5" />
              </Button>

              <Button
                onClick={capturePhoto}
                size="lg"
                className="h-16 w-16 rounded-full bg-primary hover:bg-primary/90"
                disabled={isCapturing}
              >
                <Camera className="h-6 w-6" />
              </Button>

              <div className="h-12 w-12" /> {/* Spacer for symmetry */}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
