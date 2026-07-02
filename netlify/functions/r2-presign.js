import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

function getHeader(headers, name) {
  const match = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1] || '';
}

function getAllowedOrigins() {
  return [
    process.env.VITE_APP_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    ...(process.env.R2_UPLOAD_ALLOWED_ORIGINS || '').split(',')
  ]
    .map((origin) => String(origin || '').trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

function isAllowedOrigin(origin) {
  if (!origin) return false;
  return getAllowedOrigins().includes(origin.replace(/\/$/, ''));
}

const json = (statusCode, body, origin = '') => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    ...(origin ? corsHeaders(origin) : {})
  },
  body: JSON.stringify(body)
});

function isConfigured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

export async function handler(event) {
  const origin = getHeader(event.headers, 'origin').replace(/\/$/, '');

  if (!isAllowedOrigin(origin)) {
    return json(403, { error: 'Origin is not allowed.' });
  }

  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true }, origin);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' }, origin);

  if (!isConfigured()) {
    return json(501, { error: 'R2 is not configured on this Netlify site.' }, origin);
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' }, origin);
  }

  const contentType = String(payload.contentType || 'image/jpeg');
  if (!contentType.startsWith('image/')) {
    return json(400, { error: 'Only image uploads are allowed.' }, origin);
  }

  const contentLength = Number(payload.contentLength);
  if (!Number.isInteger(contentLength) || contentLength <= 0 || contentLength > MAX_UPLOAD_BYTES) {
    return json(400, { error: 'Image must be 3 MB or smaller.' }, origin);
  }

  const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const key = `reports/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
  });

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentLength: contentLength,
    ContentType: contentType
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 120 });
  const publicBase = (process.env.VITE_R2_PUBLIC_URL || '').replace(/\/$/, '');
  const publicUrl = publicBase ? `${publicBase}/${key}` : '';

  return json(200, {
    uploadUrl,
    key,
    publicUrl,
    contentLength,
    contentType
  }, origin);
}
