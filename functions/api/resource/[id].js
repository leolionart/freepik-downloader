import {
  freepikFetch,
  getFreepikApiKey,
  getJsonError,
  jsonResponse,
  pickResource,
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

  const result = await freepikFetch(`/resources/${resourceId}`, apiKey);
  if (!result.ok) {
    return getJsonError(result.message, result.status, result.payload);
  }

  return jsonResponse({
    ok: true,
    resource: pickResource(result.payload, resourceId),
    raw: result.payload,
  });
}
