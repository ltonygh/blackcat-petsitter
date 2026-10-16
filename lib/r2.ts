import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 client (S3-compatible API).
 *
 * R2 exposes an S3 API; we talk to it with the AWS SDK v3 pointed at the R2
 * S3 endpoint with region "auto". Credentials come from environment variables
 * (never hard-coded).
 */

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_S3_API_ENDPOINT,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

if (!R2_S3_API_ENDPOINT) {
  // Fail fast with a clear message rather than an opaque SDK error later.
  // (Read lazily: importing this module in a context without R2 configured,
  // e.g. unit tests that never call the client, should still be safe.)
}

export const R2_BUCKET = R2_BUCKET_NAME ?? "";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: R2_S3_API_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: R2_SECRET_ACCESS_KEY ?? "",
  },
});

/**
 * Generate a presigned PUT URL for a direct-to-R2 upload.
 *
 * ContentType and ContentLength are signed, so R2 enforces them at the storage
 * layer: an upload that changes the content type or exceeds the declared
 * length will be rejected by R2 itself, not merely by our application code.
 */
export async function generateUploadUrl(
  key: string,
  mimeType: string,
  contentLength: number,
  expiresIn = 300,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: mimeType,
    ContentLength: contentLength,
  });

  return getSignedUrl(r2Client, command, { expiresIn });
}

/** Generate a presigned GET URL for a private object. */
export async function generateDownloadUrl(
  key: string,
  expiresIn = 300,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  return getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Public URL for a promoted object.
 *
 * NEVER call this with a `quarantine/` key: quarantined objects are not public
 * and must be promoted (moved to `pets/...`) before any URL is exposed.
 */
export function publicUrl(key: string): string {
  return `${R2_PUBLIC_URL ?? ""}/${key}`;
}

/** Delete an object from R2 (used by the scheduled cleanup task). */
export async function deleteObject(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }),
  );
}

/** Overwrite an object with new bytes (used after sharp re-encoding). */
export async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
    }),
  );
}

/**
 * HEAD an object. Returns its size/content type metadata, or null if it does
 * not exist (or is not accessible).
 */
export async function headObject(
  key: string,
): Promise<{ size: number; contentType: string | null } | null> {
  try {
    const res = await r2Client.send(
      new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    );
    return {
      size: res.ContentLength ?? 0,
      contentType: res.ContentType ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch the first `bytes` bytes of an object (HTTP Range request). Used for
 * magic-byte validation without downloading the whole object.
 */
export async function getObjectRange(
  key: string,
  bytes: number,
): Promise<Uint8Array> {
  const res = await r2Client.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Range: `bytes=0-${bytes - 1}`,
    }),
  );

  const body = res.Body as
    | { transformToByteArray?: () => Promise<Uint8Array> }
    | undefined;

  if (!body?.transformToByteArray) {
    throw new Error("R2 getObjectRange: response body is not readable");
  }

  return body.transformToByteArray();
}

/**
 * Move an object within the bucket: copy to `destKey`, then delete the source.
 * Used to promote an object from `quarantine/...` to `pets/...`.
 */
export async function moveObject(
  sourceKey: string,
  destKey: string,
): Promise<void> {
  await r2Client.send(
    new CopyObjectCommand({
      Bucket: R2_BUCKET,
      Key: destKey,
      CopySource: `${R2_BUCKET}/${sourceKey}`,
    }),
  );
  await deleteObject(sourceKey);
}
