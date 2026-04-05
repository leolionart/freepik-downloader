const FREEPIK_API_BASE = "https://api.freepik.com/v1";
const COOKIE_NAME = "freepik_api_key";

function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) {
    return "";
  }

  const parts = cookieHeader.split(";").map((item) => item.trim());
  const prefix = `${name}=`;
  const entry = parts.find((item) => item.startsWith(prefix));
  if (!entry) {
    return "";
  }

  return decodeURIComponent(entry.slice(prefix.length));
}

export function getFreepikApiKey(request) {
  return getCookieValue(request.headers.get("cookie"), COOKIE_NAME);
}

export function getCookieName() {
  return COOKIE_NAME;
}

export function getJsonError(message, status = 400, details) {
  return json(
    {
      ok: false,
      error: message,
      details: details || null,
    },
    { status },
  );
}

export async function freepikFetch(pathname, apiKey, searchParams) {
  const url = new URL(`${FREEPIK_API_BASE}${pathname}`);
  if (searchParams) {
    for (const [key, value] of searchParams.entries()) {
      if (value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      "x-freepik-api-key": apiKey,
      accept: "application/json",
    },
  });

  const rawText = await response.text();
  let payload = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = { raw: rawText };
    }
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.detail ||
      payload?.error ||
      `Freepik API returned ${response.status}`;

    return {
      ok: false,
      status: response.status,
      payload,
      message,
    };
  }

  return {
    ok: true,
    status: response.status,
    payload,
  };
}

export function pickResource(data, fallbackId) {
  const resource = data?.data || data?.resource || data || {};
  const preview =
    resource?.image?.source?.url ||
    resource?.image?.url ||
    resource?.preview?.url ||
    resource?.thumbnail?.url ||
    resource?.thumbnail;

  return {
    id: String(resource.id || fallbackId),
    title: resource.title || resource.slug || resource.filename || `Resource ${fallbackId}`,
    type: resource.type || resource.resource_type || resource.kind || "unknown",
    premium: Boolean(resource.is_premium ?? resource.premium ?? false),
    license:
      resource.license ||
      resource.license_name ||
      resource.licenses?.[0]?.name ||
      "Unknown",
    previewUrl: preview || null,
    author:
      resource.author?.name ||
      resource.author_name ||
      resource.contributor?.name ||
      null,
    raw: resource,
  };
}

export function pickDownload(data) {
  const download = data?.data || data?.download || data || {};
  return {
    filename: download.filename || download.name || "freepik-download",
    url: download.url || download.download_url || download.signed_url || null,
    raw: download,
  };
}

export function jsonResponse(data, init) {
  return json(data, init);
}
