const base = window.LOCKEDTUBE_CONFIG || {};
const ADMIN_PASSWORD = "35SyT901Qu"; // casual barrier only

const LS_KEY = "lockedtube.allowedHandles.v2";

const cfg = {
  apiKey: String(base.apiKey || ""),
  allowedHandles: normalizeHandles(base.allowedHandles || []),
  maxPerChannel: Number(base.maxPerChannel || 24),
  hideShorts: !!base.hideShorts,
  minDurationSeconds: Number(base.minDurationSeconds || 60)
};

const stored = loadHandlesFromStorage();
if (stored && stored.length) cfg.allowedHandles = stored;

// UI refs
const $logo = document.getElementById("logo");
const $q = document.getElementById("q");
const $btnSearch = document.getElementById("btnSearch");
const $btnChannels = document.getElementById("btnChannels");
const $btnAdd = document.getElementById("btnAdd");
const $btnRemove = document.getElementById("btnRemove");

const $warning = document.getElementById("warning");
const $mode = document.getElementById("mode");

const $videosView = document.getElementById("videosView");
const $channelsView = document.getElementById("channelsView");

const $videosTitle = document.getElementById("videosTitle");
const $grid = document.getElementById("grid");
const $count = document.getElementById("count");

const $chanGrid = document.getElementById("chanGrid");
const $channelsCount = document.getElementById("channelsCount");

// player
const $playerWrap = document.getElementById("playerWrap");
const $player = document.getElementById("player");
const $playerTitle = document.getElementById("playerTitle");
const $playerSub = document.getElementById("playerSub");

// modal
const $overlay = document.getElementById("overlay");
const $modalTitle = document.getElementById("modalTitle");
const $modalHint = document.getElementById("modalHint");
const $btnClose = document.getElementById("btnClose");
const $handleList = document.getElementById("handleList");

const $pw = document.getElementById("pw");
const $handle = document.getElementById("handle");
const $btnDoAdd = document.getElementById("btnDoAdd");
const $btnDoRemove = document.getElementById("btnDoRemove");
const $adminStatus = document.getElementById("adminStatus");

// cached channel info: handle -> {channelId, title, thumb}
const channelCache = new Map();

// ---------------- helpers ----------------
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
function showWarn(msg){ $warning.style.display="block"; $warning.innerHTML=msg; }
function clearWarn(){ $warning.style.display="none"; $warning.innerHTML=""; }

function apiUrl(path, params) {
  const u = new URL("https://www.googleapis.com/youtube/v3/" + path);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  u.searchParams.set("key", cfg.apiKey);
  return u.toString();
}

// best-effort shorts filter by title
function isProbablyShort(item) {
  if (!cfg.hideShorts) return false;
  const t = (item?.snippet?.title || "").toLowerCase();
  return t.includes("#shorts") || t.includes(" shorts") || t.startsWith("shorts");
}

// localStorage
function loadHandlesFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return normalizeHandles(arr);
  } catch { return null; }
}
function saveHandlesToStorage(handles) {
  localStorage.setItem(LS_KEY, JSON.stringify(normalizeHandles(handles)));
}

// routing
function go(route) { location.hash = route; }
function currentHash() { return location.hash || "#/"; }
function parseRoute() {
  const h = currentHash();
  // #/channels
  if (h.startsWith("#/channels")) return { page: "channels" };
  // #/channel/<handle>
  if (h.startsWith("#/channel/")) {
    const handle = decodeURIComponent(h.slice("#/channel/".length)).replace(/^@/, "");
    return { page: "channel", handle: normalizeHandle(handle) };
  }
  // default: home
  return { page: "home" };
}

function showPage(page) {
  if (page === "channels") {
    $channelsView.style.display = "";
    $videosView.style.display = "none";
    $playerWrap.style.display = "none";
  } else {
    $channelsView.style.display = "none";
    $videosView.style.display = "";
  }
}

// ---------------- YouTube API ----------------
async function getChannelInfoFromHandle(handle) {
  const h = normalizeHandle(handle);
  if (channelCache.has(h)) return channelCache.get(h);

  // channels.list supports forHandle
  const url = apiUrl("channels", { part: "id,snippet", forHandle: h });
  const r = await fetch(url);
  const j = await r.json();
  const item = j?.items?.[0];
  if (!item?.id) throw new Error(`Could not resolve @${h}`);

  const info = {
    handle: h,
    channelId: item.id,
    title: item.snippet?.title || `@${h}`,
    thumb:
      item.snippet?.thumbnails?.default?.url ||
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.high?.url ||
      ""
  };
  channelCache.set(h, info);
  return info;
}

async function searchVideosInChannel(channelId, query, maxResults) {
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

async function latestVideosFromChannel(channelId, maxResults) {
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

// duration filter: videos.list(part=contentDetails) for up to 50 IDs
function parseISODurationToSeconds(iso) {
  // PT#H#M#S
  const m = String(iso || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const h = parseInt(m[1] || "0", 10);
  const min = parseInt(m[2] || "0", 10);
  const s = parseInt(m[3] || "0", 10);
  return h * 3600 + min * 60 + s;
}

async function filterByMinDuration(items, minSeconds) {
  if (!minSeconds || minSeconds <= 0) return items;

  const ids = items
    .map(x => x.id?.videoId)
    .filter(Boolean);

  if (!ids.length) return items;

  // batch in chunks of 50
  const keep = new Set();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = apiUrl("videos", { part: "contentDetails", id: chunk.join(",") });
    const r = await fetch(url);
    const j = await r.json();
    for (const v of (j.items || [])) {
      const secs = parseISODurationToSeconds(v.contentDetails?.duration);
      if (secs >= minSeconds) keep.add(v.id);
    }
  }

  return items.filter(x => keep.has(x.id?.videoId));
}

// ---------------- rendering ----------------
function play(videoId, title, channel) {
  $playerWrap.style.display = "block";
  $player.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&modestbranding=1`;
  $playerTitle.textContent = title;
  $playerSub.textContent = channel;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function card(video) {
  const vid = video.id?.videoId || "";
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

function sortByDateDesc(items) {
  items.sort((a,b) => (b.snippet?.publishedAt || "").localeCompare(a.snippet?.publishedAt || ""));
  return items;
}

// ---------------- pages ----------------
async function renderChannelsPage() {
  clearWarn();
  $chanGrid.innerHTML = "";
  $channelsCount.textContent = "";

  if (!cfg.allowedHandles.length) {
    showWarn("No allowed channels. Add one with the Add Channel button.");
    return;
  }

  $mode.textContent = "Channels";

  const infos = [];
  for (const h of cfg.allowedHandles) {
    try {
      infos.push(await getChannelInfoFromHandle(h));
    } catch (e) {
      // show partial
    }
  }

  $channelsCount.textContent = `${infos.length} channels`;

  for (const info of infos) {
    const el = document.createElement("div");
    el.className = "chanCard";
    el.innerHTML = `
      <img class="chanImg" src="${escapeHtml(info.thumb)}" alt="">
      <div>
        <p class="chanName">${escapeHtml(info.title)}</p>
        <p class="chanHandle">@${escapeHtml(info.handle)}</p>
      </div>
    `;
    el.addEventListener("click", () => go(`#/channel/${encodeURIComponent(info.handle)}`));
    $chanGrid.appendChild(el);
  }
}

async function renderHome(query = "") {
  clearWarn();
  showPage("home");
  $grid.innerHTML = "";
  $count.textContent = "";
  $videosTitle.textContent = query ? `Search results` : `Videos`;

  if (!cfg.apiKey) {
    showWarn("Missing API key in config.js");
    return;
  }
  if (!cfg.allowedHandles.length) {
    showWarn("No allowed channels. Add one with Add Channel.");
    return;
  }

  $mode.textContent = query ? `Search: "${query}"` : "Home";

  let items = [];
  for (const h of cfg.allowedHandles) {
    try {
      const info = await getChannelInfoFromHandle(h);
      const part = query
        ? await searchVideosInChannel(info.channelId, query, cfg.maxPerChannel)
        : await latestVideosFromChannel(info.channelId, cfg.maxPerChannel);
      items.push(...part);
    } catch (e) {
      showWarn(`Problem loading @${escapeHtml(h)}: ${escapeHtml(e.message)}`);
      return;
    }
  }

  sortByDateDesc(items);
  items = await filterByMinDuration(items, cfg.minDurationSeconds);

  items.forEach(v => $grid.appendChild(card(v)));
  $count.textContent = `${items.length} ${query ? "results" : "videos"} (≥ ${cfg.minDurationSeconds}s)`;
}

async function renderSingleChannel(handle, query = "") {
  clearWarn();
  showPage("home");
  $grid.innerHTML = "";
  $count.textContent = "";

  const h = normalizeHandle(handle);
  if (!cfg.allowedHandles.includes(h)) {
    showWarn(`@${escapeHtml(h)} is not in the allowed list.`);
    return;
  }

  const info = await getChannelInfoFromHandle(h);

  $mode.textContent = query ? `@${h} • Search` : `@${h}`;
  $videosTitle.textContent = info.title;

  let items = query
    ? await searchVideosInChannel(info.channelId, query, cfg.maxPerChannel)
    : await latestVideosFromChannel(info.channelId, cfg.maxPerChannel);

  sortByDateDesc(items);
  items = await filterByMinDuration(items, cfg.minDurationSeconds);

  items.forEach(v => $grid.appendChild(card(v)));
  $count.textContent = `${items.length} videos (≥ ${cfg.minDurationSeconds}s)`;
}

// ---------------- admin modal (add/remove) ----------------
function openModal(mode) {
  $overlay.style.display = "flex";
  $adminStatus.textContent = "";
  $pw.value = "";
  $handle.value = "";

  if (mode === "add") {
    $modalTitle.textContent = "Add Channel";
    $modalHint.textContent = "Enter admin password + channel handle (no @). We verify the handle exists.";
    $btnDoAdd.style.display = "inline-block";
    $btnDoRemove.style.display = "none";
  } else {
    $modalTitle.textContent = "Remove Channel";
    $modalHint.textContent = "Enter admin password + handle to remove (no @).";
    $btnDoAdd.style.display = "none";
    $btnDoRemove.style.display = "inline-block";
  }

  renderHandleList();
  setTimeout(() => $handle.focus(), 50);
}

function closeModal() {
  $overlay.style.display = "none";
}

function requirePassword() {
  if (String($pw.value || "") !== ADMIN_PASSWORD) {
    $adminStatus.textContent = "Wrong password ❌";
    return false;
  }
  return true;
}

function renderHandleList() {
  $handleList.innerHTML = "";
  if (!cfg.allowedHandles.length) {
    const row = document.createElement("div");
    row.className = "listRow";
    row.innerHTML = `<div class="status">No allowed channels yet.</div>`;
    $handleList.appendChild(row);
    return;
  }

  for (const h of cfg.allowedHandles) {
    const row = document.createElement("div");
    row.className = "listRow";
    row.innerHTML = `
      <div class="mono">@${escapeHtml(h)}</div>
      <div style="display:flex; gap:10px; align-items:center;">
        <button class="danger" data-rm="${escapeHtml(h)}">Remove</button>
      </div>
    `;
    row.querySelector("button").addEventListener("click", async () => {
      $handle.value = h;
      await removeHandle();
    });
    $handleList.appendChild(row);
  }
}

async function addHandle() {
  if (!requirePassword()) return;
  const h = normalizeHandle($handle.value);
  if (!h) { $adminStatus.textContent = "Enter a handle."; return; }
  if (cfg.allowedHandles.includes(h)) { $adminStatus.textContent = `@${h} already allowed.`; return; }

  $adminStatus.textContent = "Checking…";
  try {
    await getChannelInfoFromHandle(h);
  } catch (e) {
    $adminStatus.textContent = `Not valid: ${e.message}`;
    return;
  }

  cfg.allowedHandles = normalizeHandles([...cfg.allowedHandles, h]);
  saveHandlesToStorage(cfg.allowedHandles);
  $adminStatus.textContent = `Added @${h} ✅`;
  renderHandleList();

  // refresh current route
  await route();
}

async function removeHandle() {
  if (!requirePassword()) return;
  const h = normalizeHandle($handle.value);
  if (!h) { $adminStatus.textContent = "Enter a handle."; return; }
  if (!cfg.allowedHandles.includes(h)) { $adminStatus.textContent = `@${h} not found.`; return; }

  if (cfg.allowedHandles.length === 1) {
    $adminStatus.textContent = "You can’t remove the last remaining channel.";
    return;
  }

  cfg.allowedHandles = cfg.allowedHandles.filter(x => x !== h);
  saveHandlesToStorage(cfg.allowedHandles);
  $adminStatus.textContent = `Removed @${h} ✅`;
  renderHandleList();

  // if we were viewing that channel, bounce home
  const r = parseRoute();
  if (r.page === "channel" && r.handle === h) go("#/");
  await route();
}

// ---------------- main router ----------------
async function route() {
  const r = parseRoute();

  if (r.page === "channels") {
    showPage("channels");
    $playerWrap.style.display = "none";
    await renderChannelsPage();
    return;
  }

  if (r.page === "channel") {
    showPage("home");
    await renderSingleChannel(r.handle);
    return;
  }

  // home
  showPage("home");
  await renderHome();
}

// ---------------- wire events ----------------
$logo.addEventListener("click", () => go("#/"));
$btnChannels.addEventListener("click", () => go("#/channels"));

$btnAdd.addEventListener("click", () => openModal("add"));
$btnRemove.addEventListener("click", () => openModal("remove"));

$btnClose.addEventListener("click", closeModal);
$overlay.addEventListener("click", (e) => { if (e.target === $overlay) closeModal(); });

$btnDoAdd.addEventListener("click", addHandle);
$btnDoRemove.addEventListener("click", removeHandle);

$btnSearch.addEventListener("click", async () => {
  const query = String($q.value || "").trim();
  if (!query) return;

  const r = parseRoute();
  if (r.page === "channel") {
    await renderSingleChannel(r.handle, query);
  } else {
    await renderHome(query);
  }
});
$q.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;
  $btnSearch.click();
});

window.addEventListener("hashchange", route);

// start at home
if (!location.hash) location.hash = "#/";
route();
