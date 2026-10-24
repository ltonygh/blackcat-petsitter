"use client";

import { useRef, useState } from "react";

import { ApiError } from "@/components/lib/api";
import { uploadPetDocument, type UploadType } from "@/components/lib/upload";

interface DocumentUploadProps {
  petId: string;
  type: UploadType;
  label: string;
  hint?: string;
  accept?: string;
  /** Fires after a successful upload with the public URL. */
  onUploaded: (publicUrl: string) => void;
}

type Status = "idle" | "uploading" | "done" | "error";

/**
 * Single-document uploader with a progress bar. Disabled until a petId exists
 * (the wizard creates the pet in Step 3 before uploads are enabled).
 */
export function DocumentUpload({
  petId,
  type,
  label,
  hint,
  accept = "image/jpeg,image/png,application/pdf",
  onUploaded,
}: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [percent, setPercent] = useState(0);
  const [stage, setStage] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setStatus("uploading");
    setPercent(0);
    setStage("準備中⋯");
    setFileName(file.name);
    try {
      const { publicUrl } = await uploadPetDocument({
        petId,
        type,
        file,
        onProgress: (p, s) => {
          setPercent(p);
          setStage(s);
        },
      });
      setStatus("done");
      onUploaded(publicUrl);
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof ApiError ? err.message : "上傳失敗，請重試。",
      );
    }
  }

  const busy = status === "uploading";

  return (
    <div className="rounded-xl border border-black/10 bg-[#FFF8E1] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#4A3B32]">{label}</p>
          {hint && <p className="text-xs text-[#4A3B32]/60">{hint}</p>}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#4A3B32] ring-1 ring-black/10 hover:bg-black/5 disabled:opacity-50"
        >
          {status === "done" ? "重新上傳" : "選擇檔案"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {fileName && (
        <p className="mt-2 truncate text-xs text-[#4A3B32]/70">{fileName}</p>
      )}

      {busy && (
        <div className="mt-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-[#FFA259] transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-[#4A3B32]/60">
            {stage} {percent}%
          </p>
        </div>
      )}

      {status === "done" && (
        <p className="mt-2 text-xs font-medium text-green-700">✓ 已上傳</p>
      )}
      {status === "error" && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
