// ============================================================
// 永久存储 v3 — 基于 GitHub Gist 存储
// 不需要服务器，前端直接调 GitHub API
// ============================================================

// ---- GitHub 配置 ----
const GITHUB_API = "https://api.github.com";

function getGH(prefix = "") {
  // 读取 localStorage 中的 GitHub Token
  return localStorage.getItem("gh_" + prefix + "token") || "";
}
function setGH(val, prefix = "") {
  localStorage.setItem("gh_" + prefix + "token", val);
}
function hasGH(prefix = "") {
  return getGH(prefix).length > 0;
}

// ---- 测试 Token 有效性 ----
async function testGitHubToken(token) {
  try {
    const r = await fetch(GITHUB_API + "/user", {
      headers: { "Authorization": "Bearer " + token, "Accept": "application/vnd.github.v3+json" },
    });
    if (!r.ok) return { ok: false, msg: "Token 无效（状态码 " + r.status + "）" };
    const user = await r.json();
    return { ok: true, user: user.login };
  } catch (e) {
    return { ok: false, msg: "网络错误: " + e.message };
  }
}

// ---- GitHub API 函数 ----
async function gistCreate(siteData) {
  const r = await fetch(GITHUB_API + "/gists", {
    method: "POST",
    headers: { "Authorization": "Bearer " + getGH(), "Content-Type": "application/json", "Accept": "application/vnd.github.v3+json" },
    body: JSON.stringify({
      description: "Permanent Store - " + new Date().toLocaleString("zh-CN"),
      public: true,
      files: { "site.json": { content: JSON.stringify(siteData) } }
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error("GitHub 创建失败: " + r.status + " " + err.slice(0, 100));
  }
  const d = await r.json();
  return d.id;
}

async function gistGet(gistId) {
  const r = await fetch(GITHUB_API + "/gists/" + encodeURIComponent(gistId), {
    headers: { "Accept": "application/vnd.github.v3+json" },
  });
  if (!r.ok) throw new Error("获取失败: " + r.status);
  const d = await r.json();
  const content = d.files && d.files["site.json"] && d.files["site.json"].content;
  if (!content) throw new Error("内容不存在");
  return JSON.parse(content);
}

async function gistUpdate(gistId, siteData) {
  const r = await fetch(GITHUB_API + "/gists/" + encodeURIComponent(gistId), {
    method: "PATCH",
    headers: { "Authorization": "Bearer " + getGH(), "Content-Type": "application/json", "Accept": "application/vnd.github.v3+json" },
    body: JSON.stringify({
      files: { "site.json": { content: JSON.stringify(siteData) } }
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error("GitHub 保存失败: " + r.status + " " + err.slice(0, 100));
  }
  return true;
}

// ---- ID 生成 ----
let _idCounter = Date.now();
function uid() { return (_idCounter++).toString(36); }

// ---- DOM ----
const $ = (s) => document.querySelector(s);
const pageHome = $("#page-home");
const pageSite = $("#page-site");
const btnCreateSite = $("#btn-create-site");
const btnAddSection = $("#btn-add-section");
const btnAddSectionBottom = $("#btn-add-section-bottom");
const btnShare = $("#btn-share");
const btnSettings = $("#btn-settings");
const sectionsContainer = $("#sections-container");
const siteLoading = $("#site-loading");
const siteError = $("#site-error");
const shareModal = $("#share-modal");
const shareLink = $("#share-link");
const qrContainer = $("#qrcode");
const btnCloseModal = $("#btn-close-modal");
const btnCopyLink = $("#btn-copy-link");
const fileInput = $("#file-input");
const toast = $("#toast");
const saveStatus = $("#save-status");
const setupBanner = $("#setup-banner");
const tokenInput = $("#token-input");
const btnSaveToken = $("#btn-save-token");
const siteTitleInput = $("#site-title");
const searchBar = $("#search-bar");
const searchInput = $("#search-input");
const btnSearch = $("#btn-search");
const btnSearchClose = $("#btn-search-close");
const searchCount = $("#search-count");
const btnToc = $("#btn-toc");
const tocModal = $("#toc-modal");
const tocList = $("#toc-list");
const tocEmpty = $("#toc-empty");
const btnCloseToc = $("#btn-close-toc");
const btnTestToken = $("#btn-test-token");
const tokenStatus = $("#token-status");
function ghUserEl() { return document.getElementById("gh-user"); }
const btnClearToken = $("#btn-clear-token");
const ownedListHome = $("#owned-list-home");

// ---- State ----
let site = null, siteId = null, isOwner = false;
let saveTimer = null, pendingSave = false;

// ---- Toast ----
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg; toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
}

// ---- Owned Sites (localStorage) ----
function getOwned() {
  try { return JSON.parse(localStorage.getItem("gh_owned") || "[]"); } catch { return []; }
}
function addOwned(gistId) {
  const list = getOwned();
  if (!list.includes(gistId)) { list.push(gistId); localStorage.setItem("gh_owned", JSON.stringify(list)); }
}

// ---- Save Status ----
function setSaveStatus(state) {
  saveStatus.className = "save-status";
  if (state === "saved") { saveStatus.textContent = "已保存"; saveStatus.classList.add("saved"); }
  else if (state === "saving") { saveStatus.textContent = "保存中..."; saveStatus.classList.add("saving"); }
  else if (state === "error") { saveStatus.textContent = "保存失败"; saveStatus.classList.add("error"); }
  else { saveStatus.textContent = ""; }
}

// ---- Debounced Save ----
function scheduleSave() {
  if (!siteId || !isOwner) return;
  pendingSave = true; setSaveStatus("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 800);
}
async function doSave() {
  if (!pendingSave) return;
  pendingSave = false;
  try {
    await gistUpdate(siteId, site);
    setSaveStatus("saved");
  } catch (e) {
    setSaveStatus("error");
    console.error("Save:", e);
  }
}

// ---- 设置界面 ----
async function initSettings() {
  const token = getGH();
  if (token) {
    btnCreateSite.disabled = false;
    setupBanner.innerHTML = '<div class="setup-info"><span class="gh-user">Token OK</span><button class="btn btn-xs btn-secondary" id="btn-open-settings">⚙️ 设置</button></div>';
    var bs = setupBanner.querySelector("#btn-open-settings");
    if (bs) bs.addEventListener("click", showSettingsModal);
  } else {
    setupBanner.innerHTML = '<div class="setup-prompt"><p>🔑 请先配置 GitHub 令牌，才能创建和编辑站点</p><button class="btn btn-primary btn-sm" id="btn-open-settings">配置 GitHub</button></div>';
    btnCreateSite.disabled = true;
    var bs = setupBanner.querySelector("#btn-open-settings");
    if (bs) bs.addEventListener("click", showSettingsModal);
  }
  renderSetupBanner();
}

function renderSetupBanner() {
  if (!setupBanner) return;
  setupBanner.innerHTML = "";
  const token = getGH();
  if (token) {
    setupBanner.innerHTML = `
      <div class="setup-info">
        <span id="gh-user" class="gh-user">${(ghUserEl() ? ghUserEl().textContent : "") || "已配置"}</span>
        <button class="btn btn-xs btn-secondary" id="btn-open-settings">⚙️ 设置</button>
      </div>`;
    setupBanner.querySelector("#btn-open-settings")?.addEventListener("click", showSettingsModal);
  } else {
    setupBanner.innerHTML = `
      <div class="setup-prompt">
        <p>🔑 请先配置 GitHub 令牌，才能创建和编辑站点</p>
        <button class="btn btn-primary btn-sm" id="btn-open-settings">配置 GitHub</button>
      </div>`;
    setupBanner.querySelector("#btn-open-settings")?.addEventListener("click", showSettingsModal);
  }
}

function showSettingsModal() {
  document.getElementById("settings-modal").classList.remove("hidden");
  tokenInput.value = getGH();
  tokenStatus.textContent = "";
}

$("#btn-close-settings")?.addEventListener("click", () => {
  document.getElementById("settings-modal").classList.add("hidden");
});

$("#settings-modal")?.addEventListener("click", (e) => {
  if (e.target === $("#settings-modal")) {
    document.getElementById("settings-modal").classList.add("hidden");
  }
});

// ---- Editable Site Title ----
siteTitleInput?.addEventListener("change", function() {
  if (site && siteId) {
    site.title = siteTitleInput.value || "WT";
    scheduleSave();
  }
});

btnSaveToken?.addEventListener("click", async () => {
  const token = tokenInput.value.trim();
  if (!token) { tokenStatus.textContent = "请输入 Token"; return; }
  setGH(token);
  tokenStatus.textContent = "✅ Token 已保存";
  btnCreateSite.disabled = false;
  setTimeout(function() {
    document.getElementById("settings-modal").classList.add("hidden");
  }, 800);
});

btnClearToken?.addEventListener("click", () => {
  setGH("");
  var _g = ghUserEl(); if(_g) _g.textContent = "";
  btnCreateSite.disabled = true;
  document.getElementById("settings-modal").classList.add("hidden");
  renderSetupBanner();
  showToast("已清除 Token");
});

// ============================================================
// RENDERING (same as before)
// ============================================================

function renderSite() {
  if (!site) return;
  sectionsContainer.innerHTML = "";
  sectionsContainer.classList.remove("hidden");
  $("#site-footer-bar").classList.remove("hidden");

  site.sections.forEach((sec, si) => {
    const secDiv = document.createElement("div");
    secDiv.className = "section";
    secDiv.dataset.si = si;

    const secHead = document.createElement("div");
    secHead.className = "section-header";
    secHead.innerHTML = `
      <input class="section-title" value="${esc(sec.title)}" placeholder="分区名称" data-si="${si}">
      <div class="section-actions">
        <button class="btn btn-sm btn-secondary zone-add-text" data-si="${si}">＋ 文字区</button>
        <button class="btn btn-sm btn-secondary zone-add-image" data-si="${si}">＋ 图片区</button>
        <button class="btn btn-sm btn-danger sec-del" data-si="${si}" title="删除分区">✕</button>
      </div>
    `;
    secDiv.appendChild(secHead);

    const zonesDiv = document.createElement("div");
    zonesDiv.className = "section-zones";

    sec.textZones.forEach((tz, tzi) => zonesDiv.appendChild(renderTextZone(si, tzi, tz)));
    sec.imageZones.forEach((iz, izi) => zonesDiv.appendChild(renderImageZone(si, izi, iz)));

    secDiv.appendChild(zonesDiv);
    sectionsContainer.appendChild(secDiv);
  });
}

function renderTextZone(si, tzi, tz) {
  const zone = document.createElement("div");
  zone.className = "zone";
  zone.innerHTML = `
    <div class="zone-header">
      <span class="zone-title-icon">📝</span>
      <input class="zone-title" value="${esc(tz.title)}" placeholder="文字区名称" data-si="${si}" data-tzi="${tzi}">
      <div class="zone-actions">
        <button class="btn btn-xs btn-secondary block-add-btn" data-si="${si}" data-tzi="${tzi}" title="添加文字块">＋</button>
        <button class="btn btn-xs btn-danger zone-del" data-si="${si}" data-tzi="${tzi}" data-type="text" title="删除此区">✕</button>
      </div>
    </div>
    <div class="zone-body">
      <div class="blocks-container">
        ${tz.blocks.map((blk, bi) => `
          <div class="block" data-si="${si}" data-tzi="${tzi}" data-bi="${bi}">
            <textarea placeholder="输入文字..." data-si="${si}" data-tzi="${tzi}" data-bi="${bi}">${esc(blk.content)}</textarea>
            <div class="block-actions">
              <button class="btn btn-xs btn-secondary block-copy" data-si="${si}" data-tzi="${tzi}" data-bi="${bi}">📋 复制</button>
              <button class="btn btn-xs btn-danger block-del" data-si="${si}" data-tzi="${tzi}" data-bi="${bi}">✕</button>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="block-add-new">
        <button data-si="${si}" data-tzi="${tzi}">＋ 添加文字</button>
      </div>
    </div>
  `;
  return zone;
}

function renderImageZone(si, izi, iz) {
  const zone = document.createElement("div");
  zone.className = "zone";
  zone.innerHTML = `
    <div class="zone-header">
      <span class="zone-title-icon">🖼️</span>
      <input class="zone-title" value="${esc(iz.title)}" placeholder="图片区名称" data-si="${si}" data-izi="${izi}">
      <div class="zone-actions">
        <button class="btn btn-xs btn-danger zone-del" data-si="${si}" data-izi="${izi}" data-type="image" title="删除此区">✕</button>
      </div>
    </div>
    <div class="zone-body">
      <div class="images-grid">
        ${iz.images.map((img, ii) => `
          <div class="image-item" data-si="${si}" data-izi="${izi}" data-ii="${ii}">
            <img src="${img}" alt="image">
            <div class="img-actions">
              <button class="img-copy-btn" data-img="${esc(img)}" title="复制图片">📋</button>
              <button class="img-del-btn" data-si="${si}" data-izi="${izi}" data-ii="${ii}" title="删除">✕</button>
            </div>
          </div>
        `).join("")}
        <div class="image-add-area img-add-trigger" data-si="${si}" data-izi="${izi}">
          <span>＋</span>
        </div>
      </div>
    </div>
  `;
  return zone;
}

function esc(s) { if (!s) return ""; return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }

// ============================================================
// EVENT HANDLING
// ============================================================

// ---- Section Title Change ----
sectionsContainer.addEventListener("input", (e) => {
  const el = e.target;
  if (el.classList.contains("section-title")) {
    const si = parseInt(el.dataset.si);
    if (site.sections[si]) { site.sections[si].title = el.value; scheduleSave(); }
  }
  if (el.classList.contains("zone-title")) {
    const si = parseInt(el.dataset.si);
    const tzi = el.dataset.tzi, izi = el.dataset.izi;
    if (tzi !== undefined && site.sections[si]?.textZones[parseInt(tzi)]) {
      site.sections[si].textZones[parseInt(tzi)].title = el.value; scheduleSave();
    }
    if (izi !== undefined && site.sections[si]?.imageZones[parseInt(izi)]) {
      site.sections[si].imageZones[parseInt(izi)].title = el.value; scheduleSave();
    }
  }
  if (el.tagName === "TEXTAREA" && el.dataset.bi !== undefined) {
    const si = parseInt(el.dataset.si), tzi = parseInt(el.dataset.tzi), bi = parseInt(el.dataset.bi);
    if (site.sections[si]?.textZones[tzi]?.blocks[bi]) {
      site.sections[si].textZones[tzi].blocks[bi].content = el.value;
      scheduleSave();
    }
  }
});

// ---- Click Events ----
sectionsContainer.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;

  // Delete Section
  if (t.classList.contains("sec-del")) {
    const si = parseInt(t.dataset.si);
    if (!confirm("确定删除此分区？")) return;
    site.sections.splice(si, 1); renderSite(); scheduleSave(); return;
  }

  // Add Text Zone
  if (t.classList.contains("zone-add-text")) {
    const si = parseInt(t.dataset.si);
    const name = prompt("给文字区命名：", "新文字区");
    if (!name) return;
    site.sections[si].textZones.push({ id: uid(), title: name, blocks: [] });
    renderSite(); scheduleSave(); return;
  }

  // Add Image Zone
  if (t.classList.contains("zone-add-image")) {
    const si = parseInt(t.dataset.si);
    const name = prompt("给图片区命名：", "新图片区");
    if (!name) return;
    site.sections[si].imageZones.push({ id: uid(), title: name, images: [] });
    renderSite(); scheduleSave(); return;
  }

  // Delete Zone
  if (t.classList.contains("zone-del")) {
    const si = parseInt(t.dataset.si), type = t.dataset.type, tzi = t.dataset.tzi, izi = t.dataset.izi;
    if (!confirm("确定删除此区域？")) return;
    if (type === "text" && tzi !== undefined) site.sections[si].textZones.splice(parseInt(tzi), 1);
    else if (type === "image" && izi !== undefined) site.sections[si].imageZones.splice(parseInt(izi), 1);
    renderSite(); scheduleSave(); return;
  }

  // Add Text Block
  if (t.classList.contains("block-add-btn") || t.closest(".block-add-new")) {
    let si, tzi;
    if (t.classList.contains("block-add-btn")) { si = parseInt(t.dataset.si); tzi = parseInt(t.dataset.tzi); }
    else { si = parseInt(t.dataset.si); tzi = parseInt(t.dataset.tzi); }
    const z = site.sections[si].textZones[tzi];
    z.blocks.push({ id: uid(), content: "", createdAt: Date.now() });
    renderSite(); scheduleSave();
    requestAnimationFrame(() => {
      const tas = sectionsContainer.querySelectorAll(`.block[data-si="${si}"][data-tzi="${tzi}"] textarea`);
      if (tas.length) tas[tas.length - 1].focus();
    }); return;
  }

  // Copy Text
  if (t.classList.contains("block-copy")) {
    const si = parseInt(t.dataset.si), tzi = parseInt(t.dataset.tzi), bi = parseInt(t.dataset.bi);
    const c = site.sections[si]?.textZones[tzi]?.blocks[bi]?.content || "";
    if (!c) return;
    navigator.clipboard.writeText(c).then(() => showToast("文字已复制")).catch(() => showToast("复制失败")); return;
  }

  // Delete Block
  if (t.classList.contains("block-del")) {
    const si = parseInt(t.dataset.si), tzi = parseInt(t.dataset.tzi), bi = parseInt(t.dataset.bi);
    site.sections[si].textZones[tzi].blocks.splice(bi, 1);
    renderSite(); scheduleSave(); return;
  }
});

// ---- Image Upload ----
sectionsContainer.addEventListener("click", (e) => {
  const trigger = e.target.closest(".img-add-trigger");
  if (!trigger) return;
  fileInput.dataset.si = trigger.dataset.si;
  fileInput.dataset.izi = trigger.dataset.izi;
  fileInput.click();
});

fileInput.addEventListener("change", async () => {
  const si = parseInt(fileInput.dataset.si), izi = parseInt(fileInput.dataset.izi);
  if (isNaN(si) || isNaN(izi)) return;
  const files = Array.from(fileInput.files);
  fileInput.value = "";
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    if (f.size > 5 * 1024 * 1024) { showToast("图片超过 5MB，已跳过"); continue; }
    try { site.sections[si].imageZones[izi].images.push(await compressImage(f)); } catch (e) { console.error(e); }
  }
  renderSite(); scheduleSave();
});

// ---- Image ops ----
sectionsContainer.addEventListener("click", async (e) => {
  const btn = e.target.closest(".img-copy-btn");
  if (btn) {
    const src = btn.dataset.img;
    if (!src) return;
    try {
      const blob = await (await fetch(src)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      showToast("图片已复制");
    } catch { showToast("可右键保存图片"); }
    return;
  }
  const del = e.target.closest(".img-del-btn");
  if (del) {
    const si = parseInt(del.dataset.si), izi = parseInt(del.dataset.izi), ii = parseInt(del.dataset.ii);
    site.sections[si].imageZones[izi].images.splice(ii, 1);
    renderSite(); scheduleSave();
  }
});

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > 800 || h > 800) { const r = Math.min(800/w, 800/h); w = Math.round(w*r); h = Math.round(h*r); }
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ============================================================
// SHARE
// ============================================================

// ============================================================
// SEARCH
// ============================================================
let searchActive = false;

function toggleSearch() {
  searchActive = !searchActive;
  if (searchActive) {
    searchBar.classList.remove("hidden");
    searchInput.focus();
  } else {
    searchBar.classList.add("hidden");
    searchInput.value = "";
    clearSearch();
  }
}

function clearSearch() {
  var els = document.querySelectorAll(".section");
  for (var i = 0; i < els.length; i++) {
    els[i].classList.remove("section-hidden");
    els[i].classList.remove("section-highlight");
  }
  searchCount.textContent = "";
}

function filterSections(query) {
  var q = query.toLowerCase().trim();
  var els = document.querySelectorAll(".section");
  var count = 0;
  for (var i = 0; i < els.length; i++) {
    var section = els[i];
    var titleInput = section.querySelector(".section-title");
    var title = titleInput ? titleInput.value.toLowerCase() : "";
    var zones = section.querySelectorAll(".zone-title");
    var zoneMatch = false;
    for (var j = 0; j < zones.length; j++) {
      if (zones[j].value.toLowerCase().indexOf(q) >= 0) { zoneMatch = true; break; }
    }
    if (title.indexOf(q) >= 0 || zoneMatch) {
      section.classList.remove("section-hidden");
      section.classList.add("section-highlight");
      count++;
    } else {
      section.classList.add("section-hidden");
      section.classList.remove("section-highlight");
    }
  }
  searchCount.textContent = count + "/" + els.length + " sections";
}



// Hidden CSS for search filtering
(function() {
  var s = document.createElement("style");
  s.textContent = ".section-hidden{display:none!important}";
  document.head.appendChild(s);
})();

// ============================================================
// TABLE OF CONTENTS
// ============================================================
function renderTOC() {
  if (!site || !tocList) return;
  tocList.innerHTML = "";
  if (site.sections.length === 0) {
    tocEmpty.classList.remove("hidden");
    return;
  }
  tocEmpty.classList.add("hidden");
  site.sections.forEach(function(sec, si) {
    var item = document.createElement("div");
    item.className = "toc-item";
    var tc = sec.textZones ? sec.textZones.length : 0;
    var ic = sec.imageZones ? sec.imageZones.length : 0;
    var meta = [];
    if (tc > 0) meta.push("\ud83d\udcdd" + tc);
    if (ic > 0) meta.push("\ud83d\uddbc" + ic);
    item.innerHTML = "<span class=\"toc-item-name\">" + (sec.title || "Unnamed") + "</span><span class=\"toc-item-meta\">" + meta.join(" ") + "</span>";
    item.addEventListener("click", function() {
      tocModal.classList.add("hidden");
      if (searchActive) { searchActive = false; searchBar.classList.add("hidden"); searchInput.value = ""; clearSearch(); }
      var el = document.querySelectorAll(".section")[si];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("section-highlight");
        setTimeout(function() { el.classList.remove("section-highlight"); }, 2000);
      }
    });
    tocList.appendChild(item);
  });
}


// ============================================================
// SHARE
// ============================================================

btnShare.addEventListener("click", () => {
  if (!siteId) return;
  const link = `${window.location.origin}${window.location.pathname}?id=${siteId}`;
  shareLink.value = link;
  qrContainer.innerHTML = "";
  try {
    new QRCode(qrContainer, { text: link, width: 160, height: 160, colorDark: "#1a1a2e", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
  } catch {}
  shareModal.classList.remove("hidden");
});

btnCloseModal?.addEventListener("click", () => shareModal.classList.add("hidden"));
shareModal?.addEventListener("click", (e) => { if (e.target === shareModal) shareModal.classList.add("hidden"); });

btnCopyLink?.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(shareLink.value); showToast("链接已复制"); }
  catch { shareLink.select(); document.execCommand("copy"); showToast("链接已复制"); }
});

// ============================================================
// MAIN
// ============================================================

function renderOwnedList() {
  if (!ownedListHome) return;
  const list = getOwned();
  ownedListHome.innerHTML = list.length
    ? list.map(id => `<a href="?id=${id}" class="owned-site-btn">📦 ${id.slice(0,12)}...</a>`).join("")
    : "";
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  renderOwnedList();
  await initSettings();

  if (id) {
    pageHome.classList.add("hidden");
    pageSite.classList.remove("hidden");
    siteLoading.classList.remove("hidden");
    siteError.classList.add("hidden");
    sectionsContainer.classList.add("hidden");
    $("#site-footer-bar").classList.add("hidden");

    try {
      const data = await gistGet(id);
      site = data;
      siteId = id;
      site.id = data.id || id;
      isOwner = hasGH();
      siteLoading.classList.add("hidden");
      renderSite();

      // Bind search & TOC events
      if (btnSearch) btnSearch.addEventListener("click", toggleSearch);
      if (searchInput) searchInput.addEventListener("input", function() {
        if (this.value.trim()) filterSections(this.value); else clearSearch();
      });
      if (btnSearchClose) btnSearchClose.addEventListener("click", function() {
        if (searchActive) toggleSearch();
      });
      if (btnToc) btnToc.addEventListener("click", function() {
        if (searchActive) { searchActive = false; searchBar.classList.add("hidden"); searchInput.value = ""; clearSearch(); }
        renderTOC(); tocModal.classList.remove("hidden");
      });
      if (btnCloseToc) btnCloseToc.addEventListener("click", function() { tocModal.classList.add("hidden"); });
      if (tocModal) tocModal.addEventListener("click", function(e) {
        if (e.target === tocModal) tocModal.classList.add("hidden");
      });
    } catch (e) {
      siteLoading.classList.add("hidden");
      siteError.classList.remove("hidden");
    }
  }
}

// Create Site
btnCreateSite.addEventListener("click", async () => {
  if (!hasGH()) { showToast("请先配置 GitHub Token"); return; }
  try {
    const empty = { id: "", sections: [], createdAt: Date.now(), updatedAt: Date.now() };
    const gistId = await gistCreate(empty);
    addOwned(gistId);
    window.location.search = "?id=" + gistId;
  } catch (e) {
    showToast("创建失败: " + e.message);
  }
});

// Add Section
function addSectionHandler() {
  if (!siteId || !isOwner) return;
  const name = prompt("给新分区命名：", "新分区");
  if (!name) return;
  site.sections.push({ id: uid(), title: name, textZones: [], imageZones: [] });
  renderSite(); scheduleSave();
}
btnAddSection?.addEventListener("click", addSectionHandler);
btnAddSectionBottom?.addEventListener("click", addSectionHandler);

if (document.getElementById("btn-settings-home")) {
  document.getElementById("btn-settings-home").addEventListener("click", (e) => { e.preventDefault(); showSettingsModal(); });
}
if (btnSettings) {
  btnSettings.addEventListener("click", showSettingsModal);
}

window.addEventListener("popstate", () => location.reload());
document.addEventListener("DOMContentLoaded", init);


