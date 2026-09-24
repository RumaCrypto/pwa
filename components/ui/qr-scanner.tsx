"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { typography } from "@/constants/typography";

interface QrScannerProps {
  /** Fires once with the raw decoded payload. The camera stops immediately after. */
  onScanned: (data: string) => void;
  label: string;
  hint?: string;
  /** Shown over the frame when the browser denies camera access. */
  permissionDeniedLabel: string;
}

/**
 * Live camera QR reader: streams the back camera into a hidden `<video>`,
 * samples frames onto an offscreen canvas, and runs `jsQR` over each one
 * until a code decodes. Stops the stream as soon as `onScanned` fires or the
 * component unmounts — a stray open camera is the kind of bug nobody notices
 * until the battery does.
 */
export function QrScanner({ onScanned, label, hint, permissionDeniedLabel }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onScannedRef = useRef(onScanned);
  onScannedRef.current = onScanned;

  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame: number;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        tick();
      } catch {
        if (!stopped) setDenied(true);
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || stopped) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code && code.data) {
            stopped = true;
            stream?.getTracks().forEach((track) => track.stop());
            onScannedRef.current(code.data);
            return;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    }

    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div
      aria-label={label}
      className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl bg-primary-dark"
    >
      {!denied && (
        // Muted and playsInline so iOS Safari plays the stream inline instead
        // of hijacking the fullscreen video player.
        <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      )}
      <canvas ref={canvasRef} className="hidden" />

      <Corner className="left-6 top-6 border-l-2 border-t-2 rounded-tl-xl" />
      <Corner className="right-6 top-6 border-r-2 border-t-2 rounded-tr-xl" />
      <Corner className="bottom-6 left-6 border-b-2 border-l-2 rounded-bl-xl" />
      <Corner className="bottom-6 right-6 border-b-2 border-r-2 rounded-br-xl" />

      {denied ? (
        <span style={typography.body3} className="relative px-8 text-center text-white/80">
          {permissionDeniedLabel}
        </span>
      ) : (
        hint && (
          <span style={typography.body3} className="relative text-white/40">
            {hint}
          </span>
        )
      )}
    </div>
  );
}

function Corner({ className }: { className: string }) {
  return <span className={`pointer-events-none absolute h-12 w-12 border-primary ${className}`} />;
}
