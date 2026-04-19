async function fetchDownloadLink(resourceId, apiKey) {
  try {
    const response = await fetch(`https://api.freepik.com/v1/resources/${resourceId}/download`, {
      headers: {
        "x-freepik-api-key": apiKey,
        "Accept": "application/json"
      }
    });

    const data = await response.json();

    if (!response.ok) {
      // Lấy thông báo lỗi trực tiếp từ Freepik API
      const freepikError = data.message || data.error || data.detail || `HTTP ${response.status}`;
      
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Freepik Auth Error: "${freepikError}". Please verify your key at developer.freepik.com and ensure it has enough permissions.`);
      }
      if (response.status === 429) {
        throw new Error(`Freepik Rate Limit: "${freepikError}". You are sending too many requests.`);
      }
      
      throw new Error(`Freepik API Error: "${freepikError}"`);
    }

    const downloadUrl = data.data?.url || data.url || data.download_url;
    const filename = data.data?.filename || `freepik-${resourceId}.zip`;

    if (!downloadUrl) {
      throw new Error("Freepik API success but no download URL found. You might have reached your daily limit.");
    }

    return { url: downloadUrl, filename };
  } catch (error) {
    if (error.message === "Failed to fetch") {
      throw new Error("Network Error: Could not connect to api.freepik.com. Check your internet or VPN.");
    }
    throw error;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "download") {
    (async () => {
      try {
        const { url, filename } = await fetchDownloadLink(message.resourceId, message.apiKey);
        
        chrome.downloads.download({
          url: url,
          filename: filename,
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: "Download Manager: " + chrome.runtime.lastError.message });
          } else {
            sendResponse({ success: true });
          }
        });
      } catch (error) {
        sendResponse({ error: error.message });
      }
    })();
    return true; 
  }
});
