/**
 * Upload media for WhatsApp Message Template Headers
 * Uses Meta's Resumable Upload API (required for template creation)
 *
 * Docs: https://developers.facebook.com/docs/graph-api/guides/upload
 */

const META_API_VERSION = process.env.META_API_VERSION || "v20.0";
const GRAPH_BASE_URL = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";

/**
 * Upload file to Meta's Resumable Upload API and get a handle for template headers
 *
 * @param {Object} params
 * @param {string} params.accessToken - WhatsApp Business API access token
 * @param {string} params.appId - Meta App ID
 * @param {Buffer} params.buffer - File buffer
 * @param {string} params.mimeType - MIME type (e.g., 'image/jpeg')
 * @param {string} params.fileName - File name
 * @returns {Promise<string>} - The handle (h) for template header
 */
export async function uploadTemplateMediaToMeta({
  accessToken,
  appId,
  buffer,
  mimeType,
  fileName,
}) {
  console.log("📤 Starting Meta Resumable Upload for template header");
  console.log("   App ID:", appId);
  console.log("   MIME Type:", mimeType);
  console.log("   File Size:", buffer.length, "bytes");

  // =========================================
  // STEP 1: Create Upload Session
  // =========================================
  const sessionUrl = `${GRAPH_BASE_URL}/${META_API_VERSION}/${appId}/uploads?` +
    new URLSearchParams({
      file_name: fileName,
      file_length: buffer.length.toString(),
      file_type: mimeType,
      access_token: accessToken,
    });

  const sessionRes = await fetch(sessionUrl, {
    method: "POST",
  });

  const sessionData = await sessionRes.json();

  if (!sessionRes.ok) {
    console.error("❌ Failed to create upload session:", sessionData);
    throw new Error(
      sessionData?.error?.message || "Failed to create upload session"
    );
  }

  const uploadSessionId = sessionData.id;
  console.log("✅ Upload session created:", uploadSessionId);

  // =========================================
  // STEP 2: Upload the file bytes
  // =========================================
  const uploadUrl = `${GRAPH_BASE_URL}/${META_API_VERSION}/${uploadSessionId}`;
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${accessToken}`,
      file_offset: "0",
      "Content-Type": mimeType,
    },
    body: buffer,
  });

  const uploadData = await uploadRes.json();

  if (!uploadRes.ok) {
    console.error("❌ Failed to upload file:", uploadData);
    throw new Error(uploadData?.error?.message || "Failed to upload file");
  }

  const handle = uploadData.h;
  console.log("✅ File uploaded successfully. Handle:", handle);

  return handle;
}
