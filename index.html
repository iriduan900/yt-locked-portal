<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>LockedTube</title>
  <style>
    :root{
      --bg:#0f0f0f; --panel:#181818; --muted:#aaa; --text:#fff; --line:#2a2a2a;
      --accent:#3ea6ff; --danger:#ff5a5a;
    }
    *{box-sizing:border-box}
    body{margin:0;font-family:system-ui,Segoe UI,Roboto,Arial;background:var(--bg);color:var(--text)}
    header{
      position:sticky; top:0; z-index:10;
      display:flex; gap:12px; align-items:center;
      padding:12px 16px; background:rgba(15,15,15,.95); border-bottom:1px solid var(--line);
    }
    .logo{
      font-weight:700; letter-spacing:.3px; white-space:nowrap; cursor:pointer;
      user-select:none;
    }
    .logo span{color:var(--accent)}
    .search{flex:1; display:flex; gap:8px; min-width:240px}
    input{
      width:100%; padding:10px 12px; border-radius:999px;
      border:1px solid var(--line); background:#121212; color:var(--text);
      outline:none;
    }
    button{
      padding:10px 14px; border-radius:999px; border:1px solid var(--line);
      background:var(--panel); color:var(--text); cursor:pointer; white-space:nowrap;
    }
    button:hover{border-color:#3a3a3a}
    .btnAccent{border-color:#1f4a66}
    .btnAccent:hover{border-color:#2c6f99}
    .danger{border-color:#5a2a2a;color:#ffd7d7}
    .danger:hover{border-color:#8a3a3a}

    main{display:grid; grid-template-columns: 1fr; gap:16px; padding:16px; max-width:1200px; margin:0 auto}
    .warn{background:#2b1b1b;border:1px solid #5a2a2a;color:#ffd7d7;padding:10px 12px;border-radius:12px}

    /* video player */
    .playerWrap{background:var(--panel); border:1px solid var(--line); border-radius:16px; overflow:hidden}
    .player{width:100%; aspect-ratio:16/9; border:0; display:block}
    .meta{padding:12px 14px}
    .title{font-size:16px; font-weight:600; margin:0 0 6px}
    .sub{color:var(--muted); font-size:13px}

    /* grids */
    .row{display:flex; align-items:center; gap:10px; justify-content:space-between}
    .pill{font-size:12px; color:var(--muted); white-space:nowrap}

    .grid{
      display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap:14px;
    }
    .card{background:transparent; border-radius:14px; overflow:hidden; cursor:pointer}
    .thumb{
      width:100%; aspect-ratio:16/9; object-fit:cover; border-radius:14px;
      border:1px solid var(--line); background:#111;
    }
    .cardMeta{padding:8px 2px}
    .cardTitle{font-size:14px; font-weight:600; line-height:1.25; margin:0 0 4px}
    .cardSub{color:var(--muted); font-size:12px}

    /* channels page */
    .chanGrid{
      display:grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap:14px;
    }
    .chanCard{
      border:1px solid var(--line);
      background:#121212;
      border-radius:16px;
      padding:12px;
      display:flex;
      gap:12px;
      align-items:center;
      cursor:pointer;
    }
    .chanCard:hover{border-color:#3a3a3a}
    .chanImg{
      width:44px;height:44px;border-radius:999px;object-fit:cover;border:1px solid var(--line);
      background:#0b0b0b;
      flex: 0 0 auto;
    }
    .chanName{font-weight:600;font-size:14px;line-height:1.2;margin:0}
    .chanHandle{color:var(--muted);font-size:12px;margin:3px 0 0}

    /* modal */
    .overlay{
      position:fixed; inset:0; background:rgba(0,0,0,.65);
      display:none; align-items:center; justify-content:center; padding:16px; z-index:999;
    }
    .modal{
      width:min(720px, 100%);
      background:#111;
      border:1px solid var(--line);
      border-radius:18px;
      overflow:hidden;
      box-shadow: 0 10px 35px rgba(0,0,0,.45);
    }
    .modalHeader{
      display:flex; justify-content:space-between; align-items:center;
      padding:14px 16px; border-bottom:1px solid var(--line);
      background:#121212;
    }
    .modalHeader h3{margin:0; font-size:14px}
    .modalBody{padding:14px 16px; display:grid; gap:12px}
    .hint{color:var(--muted); font-size:12px; line-height:1.35}
    .row2{display:flex; gap:10px; flex-wrap:wrap}
    .row2 > *{flex:1}
    .status{font-size:12px; color:var(--muted)}
    .list{
      border:1px solid var(--line);
      border-radius:14px;
      overflow:hidden;
      background:#0f0f0f;
    }
    .listRow{
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 12px; border-top:1px solid var(--line);
    }
    .listRow:first-child{border-top:none}
    .mono{font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px}
  </style>
</head>
<body>
<header>
  <div class="logo" id="logo">Locked<span>Tube</span></div>

  <div class="search">
    <input id="q" placeholder="Search only inside allowed channels…" />
    <button id="btnSearch">Search</button>
  </div>

  <button id="btnChannels" class="btnAccent">Allowed Channels</button>
  <button id="btnAdd" class="btnAccent">Add Channel</button>
  <button id="btnRemove" class="btnAccent danger">Remove Channel</button>

  <div class="pill" id="mode"></div>
</header>

<main>
  <div id="warning" class="warn" style="display:none"></div>

  <!-- HOME + CHANNEL VIDEO VIEW -->
  <section class="playerWrap" id="playerWrap" style="display:none">
    <iframe id="player" class="player" allow="autoplay; encrypted-media" allowfullscreen></iframe>
    <div class="meta">
      <p class="title" id="playerTitle"></p>
      <div class="sub" id="playerSub"></div>
    </div>
  </section>

  <section id="videosView">
    <div class="row">
      <h2 style="margin:0;font-size:16px" id="videosTitle">Videos</h2>
      <div class="pill" id="count"></div>
    </div>
    <div class="grid" id="grid"></div>
  </section>

  <!-- CHANNELS PAGE -->
  <section id="channelsView" style="display:none">
    <div class="row">
      <h2 style="margin:0;font-size:16px">Allowed Channels</h2>
      <div class="pill" id="channelsCount"></div>
    </div>
    <div class="chanGrid" id="chanGrid"></div>
  </section>
</main>

<!-- Admin modal -->
<div class="overlay" id="overlay">
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modalHeader">
      <h3 id="modalTitle">Manage Channels</h3>
      <button id="btnClose">Close</button>
    </div>
    <div class="modalBody">
      <div class="hint" id="modalHint"></div>

      <div id="adminArea">
        <div class="row2">
          <input id="pw" type="password" placeholder="Admin password" />
          <input id="handle" placeholder="Channel handle (without @), e.g. MrBeast" />
        </div>
        <div class="row2">
          <button id="btnDoAdd" class="btnAccent">Add</button>
          <button id="btnDoRemove" class="danger">Remove</button>
        </div>
        <div class="status" id="adminStatus"></div>
      </div>

      <div class="list" id="handleList"></div>
    </div>
  </div>
</div>

<script src="config.js"></script>
<script src="app.js"></script>
</body>
</html>
