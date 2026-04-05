const COOKIE_NAME = "freepik_api_key";
const HISTORY_KEY = "freepik_download_history";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const MAX_HISTORY_ITEMS = 12;

const apiKeyInput = document.querySelector("#apiKeyInput");
const keyBadge = document.querySelector("#keyBadge");
const saveKeyButton = document.querySelector("#saveKeyButton");
const clearKeyButton = document.querySelector("#clearKeyButton");
const openSettingsButton = document.querySelector("#openSettingsButton");
const closeSettingsButton = document.querySelector("#closeSettingsButton");
const settingsDialog = document.querySelector("#settingsDialog");
const resourceListInput = document.querySelector("#resourceListInput");
const analyzeButton = document.querySelector("#analyzeButton");
const downloadAllButton = document.querySelector("#downloadAllButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const messageBar = document.querySelector("#messageBar");
const queueCount = document.querySelector("#queueCount");
const queueList = document.querySelector("#queueList");
const historyList = document.querySelector("#historyList");

let queueItems = [];

function getCookie(name) {
  const target = `${name}=`;
  const cookies = document.cookie.split(";").map((item) => item.trim());
  const found = cookies.find((item) => item.startsWith(target));
  return found ? decodeURIComponent(found.slice(target.length)) : "";
}

function setCookie(name, value) {
  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secureFlag}`;
}

function deleteCookie(name) {
  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
}

function setMessage(text, tone = "neutral") {
  messageBar.textContent = text;
  messageBar.className = `message ${tone}`;
}

function extractResourceId(input) {
  const value = input.trim();
  if (!value) {
    return "";
  }

  if (/^\d+$/.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const apiMatch = url.pathname.match(/\/resources\/(\d+)/);
    if (apiMatch) {
      return apiMatch[1];
    }

    const slugMatch = url.pathname.match(/_(\d+)(?:\.htm|$)/);
    if (slugMatch) {
      return slugMatch[1];
    }
  } catch {
    const genericMatch = value.match(/(\d{6,})/);
    if (genericMatch) {
      return genericMatch[1];
    }
  }

  const fallbackMatch = value.match(/(\d{6,})/);
  return fallbackMatch ? fallbackMatch[1] : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateKeyBadge() {
  const apiKey = getCookie(COOKIE_NAME);
  if (apiKey) {
    const masked = `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
    keyBadge.textContent = `API key đã lưu: ${masked}`;
    keyBadge.className = "pill success";
  } else {
    keyBadge.textContent = "API key chưa cấu hình";
    keyBadge.className = "pill muted";
  }
}

function openSettings() {
  apiKeyInput.value = getCookie(COOKIE_NAME);
  settingsDialog.showModal();
}

function closeSettings() {
  settingsDialog.close();
}

function readHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(items) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
}

function addHistoryEntry(item) {
  const next = [
    {
      id: item.id,
      title: item.title,
      filename: item.filename,
      downloadedAt: new Date().toISOString(),
    },
    ...readHistory().filter((entry) => entry.id !== item.id),
  ];
  writeHistory(next);
  renderHistory();
}

function renderHistory() {
  const items = readHistory();

  if (!items.length) {
    historyList.className = "stack-list empty-state";
    historyList.innerHTML = "<p>Chưa có file nào được tải gần đây.</p>";
    return;
  }

  historyList.className = "stack-list";
  historyList.innerHTML = items
    .map(
      (item) => `
        <article class="history-card">
          <div>
            <p class="history-title">${escapeHtml(item.title || item.filename || `Resource ${item.id}`)}</p>
            <p class="history-meta">ID ${escapeHtml(item.id)} • ${escapeHtml(item.filename || "downloaded file")}</p>
          </div>
          <time class="history-time">${formatDate(item.downloadedAt)}</time>
        </article>
      `,
    )
    .join("");
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function parseInputList() {
  const rawLines = resourceListInput.value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const map = new Map();
  const invalid = [];

  for (const source of rawLines) {
    const id = extractResourceId(source);
    if (!id) {
      invalid.push(source);
      continue;
    }

    if (!map.has(id)) {
      map.set(id, {
        id,
        source,
        status: "queued",
        title: "",
        type: "",
        license: "",
        premium: false,
        error: "",
      });
    }
  }

  return {
    items: Array.from(map.values()),
    invalid,
  };
}

function renderQueue() {
  queueCount.textContent = `${queueItems.length} item`;
  downloadAllButton.disabled = !queueItems.some((item) => item.status === "ready");

  if (!queueItems.length) {
    queueList.className = "stack-list empty-state";
    queueList.innerHTML = "<p>Chưa có resource nào được phân tích.</p>";
    return;
  }

  queueList.className = "stack-list";
  queueList.innerHTML = queueItems
    .map((item) => {
      const statusText =
        item.status === "ready"
          ? "Sẵn sàng tải"
          : item.status === "loading"
            ? "Đang validate"
            : item.status === "error"
              ? "Lỗi validate"
              : item.status === "downloading"
                ? "Đang tải"
                : item.status === "downloaded"
                  ? "Đã tải"
                  : "Chờ xử lý";

      const title = item.title || `Resource ${item.id}`;
      const metaBits = [
        `ID ${item.id}`,
        item.type || "Unknown type",
        item.license || "Unknown license",
        item.premium ? "Premium" : "Standard",
      ];

      return `
        <article class="resource-card ${item.status}">
          <div class="resource-copy">
            <div class="resource-row">
              <span class="pill ${item.status === "error" ? "danger" : item.status === "ready" || item.status === "downloaded" ? "success" : "muted"}">${statusText}</span>
              <span class="resource-meta">${metaBits.map(escapeHtml).join(" • ")}</span>
            </div>
            <h4>${escapeHtml(title)}</h4>
            ${item.error ? `<p class="resource-error">${escapeHtml(item.error)}</p>` : ""}
            <div class="resource-actions">
              <button
                class="btn btn-primary"
                type="button"
                data-action="download"
                data-id="${escapeHtml(item.id)}"
                ${item.status !== "ready" ? "disabled" : ""}
              >
                Download item này
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateQueueItem(id, patch) {
  queueItems = queueItems.map((item) => (item.id === id ? { ...item, ...patch } : item));
  renderQueue();
}

async function validateItem(item) {
  updateQueueItem(item.id, { status: "loading", error: "" });

  try {
    const response = await fetch(`/api/resource/${item.id}`);
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Validate thất bại.");
    }

    updateQueueItem(item.id, {
      status: "ready",
      title: payload.resource.title,
      type: payload.resource.type,
      license: payload.resource.license,
      premium: payload.resource.premium,
      error: "",
    });
  } catch (error) {
    updateQueueItem(item.id, {
      status: "error",
      error: error.message || "Không validate được resource.",
    });
  }
}

async function analyzeList() {
  if (!getCookie(COOKIE_NAME)) {
    setMessage("Bạn cần cấu hình Freepik API key trong Settings trước.", "error");
    openSettings();
    return;
  }

  const { items, invalid } = parseInputList();
  queueItems = items;
  renderQueue();

  if (!items.length) {
    setMessage("Danh sách không có resource ID hợp lệ.", "error");
    return;
  }

  setMessage(`Đang validate ${items.length} resource...`, "neutral");

  for (const item of items) {
    // tuần tự để tránh bắn quá nhiều request cùng lúc vào Freepik
    // và giữ trạng thái UI dễ theo dõi.
    // eslint-disable-next-line no-await-in-loop
    await validateItem(item);
  }

  const readyCount = queueItems.filter((item) => item.status === "ready").length;
  if (invalid.length) {
    setMessage(
      `Validate xong ${readyCount}/${items.length} item. Bỏ qua ${invalid.length} dòng không nhận diện được ID.`,
      readyCount ? "success" : "error",
    );
    return;
  }

  setMessage(
    readyCount
      ? `Validate xong ${readyCount}/${items.length} item.`
      : "Không có item nào validate thành công.",
    readyCount ? "success" : "error",
  );
}

async function downloadItem(id) {
  const item = queueItems.find((entry) => entry.id === id);
  if (!item || item.status !== "ready") {
    return;
  }

  updateQueueItem(id, { status: "downloading" });

  try {
    const response = await fetch(`/api/download/${id}`);
    const payload = await response.json();

    if (!response.ok || !payload.ok || !payload.downloadUrl) {
      throw new Error(payload.error || "Không lấy được download URL.");
    }

    const anchor = document.createElement("a");
    anchor.href = payload.downloadUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    updateQueueItem(id, {
      status: "downloaded",
      filename: payload.filename || item.title || `resource-${id}`,
    });
    addHistoryEntry({
      id,
      title: item.title || `Resource ${id}`,
      filename: payload.filename || `resource-${id}`,
    });
    setMessage(`Đã gửi lệnh tải cho ${item.title || `resource ${id}`}.`, "success");
  } catch (error) {
    updateQueueItem(id, {
      status: "ready",
      error: error.message || "Tải thất bại.",
    });
    setMessage(error.message || "Tải thất bại.", "error");
  }
}

async function downloadAllReady() {
  const readyItems = queueItems.filter((item) => item.status === "ready");
  if (!readyItems.length) {
    setMessage("Không có item hợp lệ để tải.", "error");
    return;
  }

  setMessage(`Đang tải ${readyItems.length} item hợp lệ...`, "neutral");

  for (const item of readyItems) {
    // eslint-disable-next-line no-await-in-loop
    await downloadItem(item.id);
  }
}

openSettingsButton.addEventListener("click", openSettings);
closeSettingsButton.addEventListener("click", closeSettings);

saveKeyButton.addEventListener("click", () => {
  const value = apiKeyInput.value.trim();
  if (!value) {
    setMessage("Nhập Freepik API key trước khi lưu.", "error");
    return;
  }

  setCookie(COOKIE_NAME, value);
  updateKeyBadge();
  closeSettings();
  setMessage("Đã cập nhật cấu hình API key.", "success");
});

clearKeyButton.addEventListener("click", () => {
  deleteCookie(COOKIE_NAME);
  apiKeyInput.value = "";
  updateKeyBadge();
  closeSettings();
  setMessage("Đã xóa API key khỏi cookie local.", "neutral");
});

analyzeButton.addEventListener("click", analyzeList);
downloadAllButton.addEventListener("click", downloadAllReady);

queueList.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action='download']");
  if (!target) {
    return;
  }

  downloadItem(target.dataset.id);
});

clearHistoryButton.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
  setMessage("Đã xóa lịch sử tải gần đây.", "neutral");
});

settingsDialog.addEventListener("click", (event) => {
  const box = settingsDialog.querySelector(".settings-panel");
  const rect = box.getBoundingClientRect();
  const isInside =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;

  if (!isInside) {
    closeSettings();
  }
});

updateKeyBadge();
renderHistory();
renderQueue();

if (!getCookie(COOKIE_NAME)) {
  setTimeout(openSettings, 250);
}
