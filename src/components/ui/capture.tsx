"use client";

import { Camera, Loader2, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "./primitives";

/**
 * "Take a photo" (opens the camera) and "Upload a file" (PDF or photo). On
 * phones both show, camera first; on desktop, only the upload. Used wherever
 * someone needs to send us a document: bills, certificates, job paperwork.
 */
export function CaptureButtons({
  onFiles,
  accept = "application/pdf,image/jpeg,image/png",
  multiple = false,
  busy = false,
  photoLabel = "Take a photo",
  fileLabel = "Upload a file",
  desktopLabel = "Upload a file",
  size = "md",
  className,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  busy?: boolean;
  photoLabel?: string;
  fileLabel?: string;
  desktopLabel?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) onFiles(files);
  };
  const spinner = <Loader2 className="h-4 w-4 animate-spin" />;
  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
        <Button size={size} disabled={busy} onClick={() => camera.current?.click()}>
          {busy ? spinner : <Camera className="h-4 w-4" strokeWidth={1.8} />} {photoLabel}
        </Button>
        <Button size={size} variant="secondary" disabled={busy} onClick={() => picker.current?.click()}>
          <Upload className="h-4 w-4" strokeWidth={1.8} /> {fileLabel}
        </Button>
      </div>
      <div className="hidden lg:block">
        <Button size={size} variant="secondary" disabled={busy} onClick={() => picker.current?.click()}>
          {busy ? spinner : <Upload className="h-4 w-4" strokeWidth={1.8} />} {desktopLabel}
        </Button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden aria-label={photoLabel} onChange={pick} />
      <input ref={picker} type="file" accept={accept} multiple={multiple} hidden aria-label={fileLabel} onChange={pick} />
    </div>
  );
}
