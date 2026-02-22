const cfg = window.LOCKEDTUBE_CONFIG || {};
const $grid = document.getElementById("grid");
const $q = document.getElementById("q");
const $btn = document.getElementById("btnSearch");
const $playerWrap = document.getElementById("playerWrap");
const $player = document.getElementById("player");
const $playerTitle = document.getElementById("playerTitle");
const $playerSub = document.getElementById("playerSub");
const $mode = document.getElementById("mode");
const $warning = document.getElementById("warning");

function showWarn(msg) {
  $warning.style.display = "block";
  $warning.innerHTML = msg;
}

function apiUrl(path, params) {
  const u = new URL("https://www.googleapis.com/youtube/v3/" + path);
  Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, v));
  u.searchParams.set("key", cfg.apiKey);
  return u.toString();
}

function isProbablyShort(item) {
  if (!cfg.hideShorts) return false;
  const t = (item?.snippet?.title || "").toLowerCase();
  return t.includes("#shorts") || t.includes("shorts");
}

function card(video) {
  const vid = video.id?.videoId || video.id;
  const sn = video.snippet;
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

function play(videoId, title, channel) {
  $playerWrap.style.display = "block";
  $player.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&modestbranding=1`;
  $playerTitle.textContent = title;
  $playerSub.textContent = channel;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}

// 1) Resolve @handle -> channelId
async function getChannelIdFromHandle(handle) {
  // YouTube Data API supports "forHandle" on channels.list
  const url = apiUrl("channels", { part: "id", forHandle: handle });
  const r = await fetch(url);
  const j = await r.json();
  const id = j?.items?.[0]?.id;
  if (!id) throw new Error(`Could not resolve @${handle} to channelId`);
  return id;
}

// 2) Fetch latest videos from a channel using search endpoint
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

// 3) Search within a channel
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

async function loadHome() {
  $mode.textContent = "Latest videos (allowed channels)";
  $grid.innerHTML = "";

  if (!cfg.apiKey || cfg.apiKey.includes("PASTE_")) {
    showWarn(`Paste your YouTube API key in <b>config.js</b>.`);
    return;
  }

  const handles = (cfg.allowedHandles || []).map(h => String(h||"").trim()).filter(Boolean);
  if (!handles.length) {
    showWarn(`Add at least one handle in <b>config.js</b> under <code>allowedHandles</code>.`);
    return;
  }

  let videos = [];
  for (const h of handles) {
    try {
      const channelId = await getChannelIdFromHandle(h);
      const items = await latestFromChannel(channelId, cfg.maxPerChannel || 12);
      videos.push(...items);
    } catch (e) {
      showWarn(`Problem loading @${escapeHtml(h)}: ${escapeHtml(e.message)}<br/>`);
    }
  }

  // Sort by publish date desc
  videos.sort((a,b) => (b.snippet.publishedAt || "").localeCompare(a.snippet.publishedAt || ""));

  videos.forEach(v => $grid.appendChild(card(v)));
}

async function doSearch() {
  const query = String($q.value || "").trim();
  if (!query) return;

  $mode.textContent = `Search: "${query}" (allowed channels only)`;
  $grid.innerHTML = "";

  const handles = (cfg.allowedHandles || []).map(h => String(h||"").trim()).filter(Boolean);

  let results = [];
  for (const h of handles) {
    try {
      const channelId = await getChannelIdFromHandle(h);
      const items = await searchInChannel(channelId, query, cfg.maxPerChannel || 12);
      results.push(...items);
    } catch (e) {
      // ignore individual channel errors in search
    }
  }

  // simple sort by date
  results.sort((a,b) => (b.snippet.publishedAt || "").localeCompare(a.snippet.publishedAt || ""));
  results.forEach(v => $grid.appendChild(card(v)));
}

$btn.addEventListener("click", doSearch);
$q.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});

loadHome();
