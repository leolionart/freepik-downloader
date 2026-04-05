import {
  freepikFetch,
  getFreepikApiKey,
  getJsonError,
  jsonResponse,
  pickDownload,
} from "../../_utils/freepik.js";

export async function onRequestGet(context) {
  const apiKey = getFreepikApiKey(context.request);
  if (!apiKey) {
    return getJsonError("Missing Freepik API key in local cookie.", 401);
  }

  const resourceId = context.params.id;
  if (!resourceId) {
    return getJsonError("Missing resource id.", 400);
  }

  const incomingUrl = new URL(context.request.url);
  const passthrough = new URLSearchParams();

  for (const key of ["image_size", "format"]) {
    const value = incomingUrl.searchParams.get(key);
    if (value) {
      passthrough.set(key, value);
    }
  }

  const result = await freepikFetch(`/resources/${resourceId}/download`, apiKey, passthrough);
  if (!result.ok) {
    return getJsonError(result.message, result.status, result.payload);
  }

  const download = pickDownload(result.payload);
  if (!download.url) {
    return getJsonError("Freepik download URL is missing in the API response.", 502, result.payload);
  }

  if (incomingUrl.searchParams.get("redirect") === "1") {
    return Response.redirect(download.url, 302);
  }

  return jsonResponse({
    ok: true,
    filename: download.filename,
    downloadUrl: download.url,
    raw: result.payload,
  });
}
