import {
  freepikFetch,
  getFreepikApiKey,
  getJsonError,
  jsonResponse,
  pickDownload,
} from "../../_utils/freepik.js";

function buildContentDisposition(filename) {
  const safeName = String(filename || "freepik-download")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const fallback = safeName || "freepik-download";
  const encoded = encodeURIComponent(fallback);
  return `attachment; filename="${fallback.replace(/"/g, "")}"; filename*=UTF-8''${encoded}`;
}

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

  if (incomingUrl.searchParams.get("mode") === "file") {
    const fileResponse = await fetch(download.url);
    if (!fileResponse.ok || !fileResponse.body) {
      return getJsonError("Không tải được file từ signed URL của Freepik.", 502);
    }

    const headers = new Headers();
    headers.set("content-type", fileResponse.headers.get("content-type") || "application/octet-stream");
    headers.set("content-disposition", buildContentDisposition(download.filename));
    headers.set("cache-control", "private, no-store");
    const encodedFilename = encodeURIComponent(download.filename || "freepik-download");
    headers.set("x-freepik-filename", encodedFilename);
    headers.set("x-download-filename", encodedFilename);

    const contentLength = fileResponse.headers.get("content-length");
    if (contentLength) {
      headers.set("content-length", contentLength);
    }

    return new Response(fileResponse.body, {
      status: 200,
      headers,
    });
  }

  return jsonResponse({
    ok: true,
    filename: download.filename,
    downloadUrl: download.url,
    raw: result.payload,
  });
}
