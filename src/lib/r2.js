export async function uploadReportPhoto(blob) {
  const response = await fetch('/.netlify/functions/r2-presign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contentLength: blob.size,
      contentType: blob.type || 'image/jpeg'
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Could not prepare image upload.');
  }

  const presign = await response.json();

  const upload = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': blob.type || presign.contentType || 'image/jpeg'
    },
    body: blob
  });

  if (!upload.ok) {
    throw new Error('Image upload failed. Check R2 CORS and Netlify environment variables.');
  }

  return presign.publicUrl;
}
