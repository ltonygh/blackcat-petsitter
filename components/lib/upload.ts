"use client";

import imageCompression from "browser-image-compression";

import { apiPost, ApiError } from "@/components/lib/api";
import type { PetDocument } from "@/types";

export type UploadType = "vaccination" | "weight_proof" | "pet_icon";

/**
 * Compress a browser File with browser-image-compression.
 * PDFs (vaccination certificates) are passed through untouched — the backend
 * only re-encodes image/jpeg and image/png, and the presign endpoint's
 * mime-type allowlist governs what's accepted.
 */
export async function compressImage(file: File): Promise<File> {
  const isImage =
    file.type === "image/jpeg" || file.type === "image/png";
  if (!isImage) return file;

  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 1600,
    maxSizeMB: 2,
    useWebWorker: true,
    fileType: file.type,
    initialQuality: 0.85,
  });

  // imageCompression returns a Blob; wrap it as a File preserving the name.
  if (compressed instanceof File) return compressed;
  return new File([compressed], file.name, { type: file.type });
}

interface UploadResult {
  document: PetDocument;
  publicUrl: string;
}

/**
 * Full R2 upload flow for one pet document:
 *   1. (client) compress the image
 *   2. POST /api/upload/presign  -> { uploadUrl, r2Key }
 *   3. PUT the bytes to uploadUrl (direct-to-R2)
 *   4. POST /api/upload/confirm  -> persisted document + public url
 *
 * `onProgress` reports a 0–100 percentage across the client-side stages.
 */
export async function uploadPetDocument(params: {
  petId: string;
  type: UploadType;
  file: File;
  onProgress?: (percent: number, stage: string) => void;
}): Promise<UploadResult> {
  const { petId, type, file, onProgress } = params;

  onProgress?.(5, "壓縮中⋯");
  const compressed = await compressImage(file);
  const mimeType = compressed.type || file.type;
  const sizeBytes = compressed.size;

  onProgress?.(20, "取得上傳連結⋯");
  const presign = await apiPost<{
    uploadUrl: string;
    r2Key: string;
  }>("/api/upload/presign", {
    petId,
    type,
    mimeType,
    sizeBytes,
  });

  onProgress?.(40, "上傳中⋯");
  // XHR so we can read upload progress.
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", presign.uploadUrl, true);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = 40 + Math.round((e.loaded / e.total) * 45); // 40–85
        onProgress?.(pct, "上傳中⋯");
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new ApiError(`上傳失敗 (${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("上傳連線錯誤", 0));
    xhr.send(compressed);
  });

  onProgress?.(90, "驗證中⋯");
  const confirmed = await apiPost<PetDocument & { url?: string }>(
    "/api/upload/confirm",
    {
      petId,
      r2Key: presign.r2Key,
      type,
      mimeType,
      sizeBytes,
      originalFilename: file.name,
    },
  );

  onProgress?.(100, "完成");
  return {
    document: {
      id: confirmed.id,
      petId: confirmed.petId,
      type: confirmed.type,
      r2Key: presign.r2Key,
      originalFilename: confirmed.originalFilename ?? file.name,
    },
    publicUrl: confirmed.url ?? "",
  };
}
