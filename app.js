const cfgBase = window.LOCKEDTUBE_CONFIG || {};
const ADMIN_PASSWORD = "35SyT901Qu"; // ⚠️ casual barrier only

const $grid = document.getElementById("grid");
const $q = document.getElementById("q");
const $btnSearch = document.getElementById("btnSearch");
const $playerWrap = document.getElementById("playerWrap");
const $player = document.getElementById("player");
const $playerTitle = document.getElementById("playerTitle");
const $playerSub = document.getElementById("playerSub");
const $mode = document.getElementById("mode");
const $warning = document.getElementById("warning");
const $count = document.getElementById("count");

// Modal elements
const $overlay = document.getElementById("overlay");
const $modalTitle = document.getElementById("modalTitle");
const $modalHint = document.getElementById("modalHint");
const $btnClose = document.getElementById("btnClose");
const $handleList = document.getElementById("handleList");

const $adminArea = document.getElementById("adminArea");
const $pw = document.getElementById("pw");
const $handle = document.getElementById("handle");
const $btnDoAdd = document.getElementById("btnDoAdd");
const $btnDoRemove = document.getElementById("btnDoRemove");
const $adminStatus = document.getElementById("adminStatus");

const $btnAllowed = document.getElementById("btnAllowed");
const $btnAdd = document.getElementById("btnAdd");
const $btnRemove = document.getElementById("btnRemove");

const LS_KEY = "lockedtube.allowedHandles.v1";

let cfg = {
  apiKey: String(cfgBase.apiKey || ""),
  allowedHandles: normalizeHandles(cfgBase.allowedHandles || []),
  maxPerChannel: Number(cfgBase.maxPerChannel || 24),
  hideShorts: !!cfgBase.hideShorts
};

// ---- helpers ----
function normalizeHandle(h) {
  return String(h || "").trim().replace(/^@/, "").toLowerCase();
}
function normalizeHandles(list) {
  return Array.from(new Set((list || []).map(normalizeHandle).filter(Boolean)));
}

function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}

function showWarn(msg) {
  $warning.style.display = "block";
  $warning.innerHTML = msg;
}

function clearWarn() {
  $warning.style.display = "none";
  $warning.innerHTML = "";
}

function apiUrl(path, params) {
  const u = new URL("https://www.googleapis.com/youtube/v3/" + path);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  u.searchParams.set("key", cfg.apiKey);
  return u.toString();
}

// Best-effort “shorts” filter
function isProbablyShort(item) {
  if (!cfg.hideShorts) return false;
  const t = (item?.snippet?.title || "").toLowerCase();
  return t.includes("#shorts") || t.includes(" shorts") || t.startsWith("shorts");
}

// ---- persistence ----
function loadHandlesFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return normalizeHandles(parsed);
  } catch {
    return null;
  }
}
function saveHandlesToStorage(handles) {
  localStorage.setItem(LS_KEY, JSON.stringify(normalizeHandles(handles)));
}

// Merge stored handles over config defaults
const stored = loadHandlesFromStorage();
if (stored && stored.length) cfg.allowedHandles = stored;

// ---- UI: modal ----
function openModal(mode) {
  $overlay.style.display = "flex";
  $adminStatus.textContent = "";

  if (mode === "view") {
    $modalTitle.textContent = "Allowed Channels";
    $modalHint.textContent = "These are the only channels shown and searchable.";
    $adminArea.style.display = "none";
  } else if (mode === "add") {
    $modalTitle.textContent = "Add Channel";
    $modalHint.textContent = "Enter admin password + channel handle (no @). We verify it exists via YouTube API.";
    $adminArea.style.display = "block";
    $btnDoAdd.style.display = "inline-block";
    $btnDoRemove.style.display = "none";
    $handle.focus();
  } else if (mode === "remove") {
    $modalTitle.textContent = "Remove Channel";
    $modalHint.textContent = "Enter admin password + handle to remove (or use the list remove buttons).";
    $adminArea.style.display = "block";
    $btnDoAdd.style.display = "none";
    $btnDoRemove.style.display = "inline-block";
    $handle.focus();
  }

  renderHandleList();
}

function closeModal() {
  $overlay.style.display = "none";
  $pw.value = "";
  $handle.value = "";
  $adminStatus.textContent = "";
}

function renderHandleList() {
  $handleList.innerHTML = "";

  if (!cfg.allowedHandles.length) {
    const empty = document.createElement("div");
    empty.className = "listRow";
    empty.innerHTML = `<div class="status">No allowed channels yet.</div>`;
    $handleList.appendChild(empty);
    return;
  }

  cfg.allowedHandles.forEach(h => {
    const row = document.createElement("div");
    row.className = "listRow";
    row.innerHTML = `
      <div class="mono">@${escapeHtml(h)}</div>
      <div style="display:flex; gap:10px; align-items:center;">
        <a class="mono" href="https://www.youtube.com/@${encodeURIComponent(h)}/videos" target="_blank" rel="noopener">open</a>
        <button class="danger" data-remove="${escapeHtml(h)}">Remove</button>
      </div>
    `;
    $handleList.appendChild(row);
  });

  // hook remove buttons
  $handleList.querySelectorAll("button[data-remove]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const handle = btn.getAttribute("data-remove") || "";
      await removeHandleFlow(handle);
    });
  });
}

function requirePassword() {
  const entered = String($pw.value || "");
  if (entered !== ADMIN_PASSWORD) {
    $adminStatus.textContent = "Wrong password ❌";
    return false;
  }
  return true;
}

// ---- YouTube API functions ----
async function getChannelIdFromHandle(handle) {
  const url = apiUrl("channels", { part: "id", forHandle: handle });
  const r = await fetch(url);
  const j = await r.json();
  const id = j?.items?.[0]?.id;
  if (!id) throw new Error(`Could not resolve @${handle} (handle not found or API blocked).`);
  return id;
}

async function latestFromChannel(channelId, maxResults) {
  const url = apiUrl("search", {
    part: "snippet",
    channelId,
    maxResults: String(maxResults),
    order: "date",
    type: "video"
  });
  const r = await fetch(url);
  const j = await r.json();
  return (j.items || []).filter(x => !isProbablyShort(x));
}

async function searchInChannel(channelId, query, maxResults) {
  const url = apiUrl("search", {
    part: "snippet",
    channelId,
    q: query,
    maxResults: String(maxResults),
    type: "video"
  });
  const r = await fetch(url);
  const j = await r.json();
  return (j.items || []).filter(x => !isProbablyShort(x));
}

function sortByDateDesc(items) {
  items.sort((a,b) => (b.snippet?.publishedAt || "").localeCompare(a.snippet?.publishedAt || ""));
  return items;
}

// ---- video cards ----
function play(videoId, title, channel) {
  $playerWrap.style.display = "block";
  $player.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&modestbranding=1`;
  $playerTitle.textContent = title;
  $playerSub.textContent = channel;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function card(video) {
  const vid = video.id?.videoId || video.id;
  const sn = video.snippet || {};
  const thumb = sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url || "";
  const title = sn.title || "";
  const channel = sn.channelTitle || "";
  const published = (sn.publishedAt || "").slice(0,10);

  const el = document.createElement("div");
  el.className = "card";
  el.innerHTML = `
    <img class="thumb" src="${thumb}" alt="">
    <div class="cardMeta">
      <div class="cardTitle">${escapeHtml(title)}</div>
      <div class="cardSub">${escapeHtml(channel)} • ${published}</div>
    </div>
  `;
  el.addEventListener("click", () => play(vid, title, channel));
  return el;
}

// ---- main load ----
async function loadHome() {
  $mode.textContent = "Latest (allowed channels)";
  $grid.innerHTML = "";
  $count.textContent = "";
  clearWarn();

  if (!cfg.apiKey) {
    showWarn(`Missing API key in <b>config.js</b>.`);
    return;
  }
  if (!cfg.allowedHandles.length) {
    showWarn(`No allowed channels. Add one using the buttons above.`);
    return;
  }

  let videos = [];
  for (const h of cfg.allowedHandles) {
    try {
      const channelId = await getChannelIdFromHandle(h);
      const items = await latestFromChannel(channelId, cfg.maxPerChannel);
      videos.push(...items);
    } catch (e) {
      showWarn(`Problem loading @${escapeHtml(h)}: ${escapeHtml(e.message)}<br/>
      If you restricted the API key, allow your GitHub Pages domain as an HTTP referrer.`);
      return;
    }
  }

  sortByDateDesc(videos);
  videos.forEach(v => $grid.appendChild(card(v)));
  $count.textContent = `${videos.length} videos`;
}

async function doSearch() {
  const query = String($q.value || "").trim();
  if (!query) return;

  $mode.textContent = `Search: "${query}" (allowed channels only)`;
  $grid.innerHTML = "";
  $count.textContent = "";
  clearWarn();

  let results = [];
  for (const h of cfg.allowedHandles) {
    try {
      const channelId = await getChannelIdFromHandle(h);
      const items = await searchInChannel(channelId, query, cfg.maxPerChannel);
      results.push(...items);
    } catch (e) {
      // ignore per-channel failures during search
    }
  }

  sortByDateDesc(results);
  results.forEach(v => $grid.appendChild(card(v)));
  $count.textContent = `${results.length} results`;
}

// ---- add/remove flows ----
async function addHandleFlow(rawHandle) {
  if (!requirePassword()) return;

  const h = normalizeHandle(rawHandle);
  if (!h) {
    $adminStatus.textContent = "Enter a handle first.";
    return;
  }

  if (cfg.allowedHandles.includes(h)) {
    $adminStatus.textContent = `@${h} is already allowed.`;
    return;
  }

  $adminStatus.textContent = "Checking channel…";

  try {
    // Verify it exists (and that the API key works)
    await getChannelIdFromHandle(h);
  } catch (e) {
    $adminStatus.textContent = `Not valid: ${e.message}`;
    return;
  }

  cfg.allowedHandles.push(h);
  cfg.allowedHandles = normalizeHandles(cfg.allowedHandles);
  saveHandlesToStorage(cfg.allowedHandles);

  $adminStatus.textContent = `Added @${h} ✅`;
  renderHandleList();
  await loadHome();
}

async function removeHandleFlow(rawHandle) {
  if (!requirePassword()) return;

  const h = normalizeHandle(rawHandle);
  if (!h) {
    $adminStatus.textContent = "Enter a handle first.";
    return;
  }

  if (!cfg.allowedHandles.includes(h)) {
    $adminStatus.textContent = `@${h} is not in the allowlist.`;
    return;
  }

  // Prevent removing the last channel (optional; safer UX)
  if (cfg.allowedHandles.length === 1) {
    $adminStatus.textContent = "You can’t remove the last remaining channel.";
    return;
  }

  cfg.allowedHandles = cfg.allowedHandles.filter(x => x !== h);
  saveHandlesToStorage(cfg.allowedHandles);

  $adminStatus.textContent = `Removed @${h} ✅`;
  renderHandleList();
  await loadHome();
}

// ---- wire events ----
$btnSearch.addEventListener("click", doSearch);
$q.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

$btnAllowed.addEventListener("click", () => openModal("view"));
$btnAdd.addEventListener("click", () => openModal("add"));
$btnRemove.addEventListener("click", () => openModal("remove"));

$btnClose.addEventListener("click", closeModal);
$overlay.addEventListener("click", (e) => { if (e.target === $overlay) closeModal(); });

$btnDoAdd.addEventListener("click", async () => addHandleFlow($handle.value));
$btnDoRemove.addEventListener("click", async () => removeHandleFlow($handle.value));

// Load home on start
loadHome();
