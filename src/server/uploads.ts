import { createHash, createHmac, randomUUID } from "crypto";

const R2_REGION = "auto";
const R2_SERVICE = "s3";
const R2_EXPIRES_SECONDS = 600;
const MAX_UPLOAD_BYTES = 750_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const R2_ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL"
] as const;

export interface R2PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresSeconds: number;
  headers: Record<string, string>;
}

export interface R2ConfigStatus {
  configured: boolean;
  missing: string[];
  bucketName?: string;
  publicUrl?: string;
  endpoint?: string;
  localUploadsAllowed: boolean;
}

export function getR2ConfigStatus(): R2ConfigStatus {
  const missing = R2_ENV_KEYS.filter((key) => !process.env[key]);
  const accountId = process.env.R2_ACCOUNT_ID;

  return {
    configured: missing.length === 0,
    missing,
    bucketName: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL,
    endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
    localUploadsAllowed: process.env.BACON_ALLOW_LOCAL_R2_UPLOADS === "true"
  };
}

export function hasR2Config(): boolean {
  return getR2ConfigStatus().configured;
}

export function assertValidUploadRequest(input: { contentType: string; sizeBytes: number }) {
  if (!ALLOWED_IMAGE_TYPES.has(input.contentType)) {
    throw new Error("Only jpg, png and webp bacon evidence is allowed.");
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > MAX_UPLOAD_BYTES) {
    throw new Error("Photo evidence must be below 750 KB after compression.");
  }
}

export function createR2PresignedPutUrl(input: {
  fileName?: string;
  contentType: string;
  sizeBytes: number;
  userId?: string;
}): R2PresignedUpload {
  assertValidUploadRequest(input);

  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const bucket = requiredEnv("R2_BUCKET_NAME");
  const publicBase = requiredEnv("R2_PUBLIC_URL").replace(/\/+$/, "");

  const now = new Date();
  const amzDate = toAmzDate(now);
  const shortDate = amzDate.slice(0, 8);
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const key = createObjectKey(input.fileName, input.contentType, input.userId);
  const credentialScope = `${shortDate}/${R2_REGION}/${R2_SERVICE}/aws4_request`;
  const signedHeaders = "host;x-amz-content-sha256";
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(R2_EXPIRES_SECONDS),
    "X-Amz-SignedHeaders": signedHeaders
  };

  const canonicalUri = `/${encodePath(bucket)}/${encodePath(key)}`;
  const canonicalQueryString = canonicalQuery(query);
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\n`;
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD"
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join("\n");

  const signingKey = getSignatureKey(secretAccessKey, shortDate, R2_REGION, R2_SERVICE);
  const signature = hmacHex(signingKey, stringToSign);
  const uploadUrl = `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

  return {
    uploadUrl,
    publicUrl: `${publicBase}/${encodePath(key)}`,
    key,
    expiresSeconds: R2_EXPIRES_SECONDS,
    headers: {
      "Content-Type": input.contentType,
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD"
    }
  };
}

function createObjectKey(fileName: string | undefined, contentType: string, userId?: string): string {
  const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const safeName = (fileName ?? "bacon-evidence")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "bacon-evidence";
  const actor = userId ? userId.replace(/[^a-z0-9-]/gi, "").slice(0, 36) : "anonymous";
  const date = new Date().toISOString().slice(0, 10);
  return `evidence/${date}/${actor}/${Date.now()}-${randomUUID()}-${safeName}.${extension}`;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function encodePath(value: string): string {
  return value.split("/").map(encodeRfc3986).join("/");
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalQuery(query: Record<string, string>): string {
  return Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: Buffer | string, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

function getSignatureKey(secretAccessKey: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  return hmac(kService, "aws4_request");
}
