/* ============================================================
   PermaStore v2 — 永久存储
   基于 GitHub Gist 存储，纯前端，可部署到 GitHub Pages
   ============================================================ */

// ===== 配置 =====
const GH_API = "https://api.github.com";
const TK_PREFIX = "pm_";

function getToken()  { return localStorage.getItem(TK_PREFIX + "token") || ""; }
function setToken(v) { localStorage.setItem(TK_PREFIX + "token", v); }
function hasToken()  { return getToken().length > 0; }

let _idc = Date.now();
function uid() { return (_idc++).toString(36); }

// ===== DOM 快捷引用 =====
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const pageHome = $("#page-home"),
      pageSite = $("#page-site");
const btnCreateSite = $("#btn-create-site");
const btnAddSection = $("#btn-add-section"),
      btnAddSectionBottom = $("#btn-add-section-bottom");
const btnShare = $("#btn-share"),
      btnSettings = $("#btn-settings");
const sectionsContainer = $("#sections-container");
const siteLoading = $("#site-loading"),
      siteError = $("#site-error");
const shareModal = $("#share-modal"),
      shareLink = $("#share-link"),
      qrContainer = $("#qrcode");
const btnCloseShare = $("#btn-close-share"),
      btnCopyLink = $("#btn-copy-link");
const fileInput = $("#file-input"),
      toast = $("#toast"),
      saveStatus = $("#save-status");
const setupBanner = $("#setup-banner"),
      settingsModal = $("#settings-modal");
const tokenInput = $("#token-input"),
      btnSaveToken = $("#btn-save-token"),
      btnClearToken = $("#btn-clear-token");
const btnCloseSettings = $("#btn-close-settings"),
      tokenStatus = $("#token-status");
const siteTitleInput = $("#site-title");
const searchBar = $("#search-bar"),
      searchInput = $("#search-input");
const btnSearch = $("#btn-search"),
      btnSearchClose = $("#btn-search-close"),
      searchCount = $("#search-count");
const btnToc = $("#btn-toc"),
      tocModal = $("#toc-modal"),
      tocList = $("#toc-list");
const tocEmpty = $("#toc-empty"),
      btnCloseToc = $("#btn-close-toc");
const ownedListHome = $("#owned-list-home"),
      stLock = $("#btn-site-lock"),
      siteTokenBanner = $("#site-token-banner"),
      btnConfigureToken = $("#btn-site-configure-token");
const promptModal = $("#prompt-modal"),
      promptTitle = $("#prompt-title"),
      promptDesc = $("#prompt-desc");
const promptInput = $("#prompt-input"),
      btnConfirmPrompt = $("#btn-confirm-prompt"),
      btnCancelPrompt = $("#btn-cancel-prompt"),
      btnClosePrompt = $("#btn-close-prompt");
const btnImportExcel = $("#btn-import-excel"),
      excelFileInput = $("#excel-file-input");

// ===== 状态 =====
let site = null,
    siteId = null,
    isOwner = false;
let saveTimer = null,
    pendingSave = false;
let searchActive = false,
    siteUnlocked = false;

// ===== GitHub Gist API =====
function ghHeaders(extra) {
  const h = { Accept: "application/vnd.github.v3+json" };
  const t = getToken();
  if (t) h.Authorization = "Bearer " + t;
  return Object.assign(h, extra || {});
}

async function gistCreate(data) {
  const r = await fetch(GH_API + "/gists", {
    method: "POST",
    headers: ghHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      description: "PermaStore - " + new Date().toLocaleString("zh-CN"),
      public: true,
      files: { "site.json": { content: JSON.stringify(data) } }
    })
  });
  if (!r.ok) {
    const e = await r.text();
    throw new Error("创建失败: " + r.status + " " + e.slice(0, 120));
  }
  return (await r.json()).id;
}

async function gistGet(id) {
  const r = await fetch(GH_API + "/gists/" + encodeURIComponent(id), {
    headers: ghHeaders()
  });
  if (!r.ok) throw new Error("获取失败: " + r.status);
  const d = await r.json();
  const fk = Object.keys(d.files || {});
  if (!fk.length) throw new Error("Gist 内容为空");
  const c = d.files[fk[0]].content;
  if (!c) throw new Error("Gist 文件为空");
  return JSON.parse(c);
}

async function gistUpdate(id, data) {
  const r = await fetch(GH_API + "/gists/" + encodeURIComponent(id), {
    method: "PATCH",
    headers: ghHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      files: { "site.json": { content: JSON.stringify(data) } }
    })
  });
  if (!r.ok) {
    const e = await r.text();
    throw new Error("保存失败: " + r.status + " " + e.slice(0, 120));
  }
  return true;
}

// ===== UI 基础工具 =====
let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
}

function esc(s) {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setSaveStatus(state) {
  saveStatus.className = "save-status";
  if (state === "saved") {
    saveStatus.textContent = "已保存";
    saveStatus.classList.add("saved");
  } else if (state === "saving") {
    saveStatus.textContent = "保存中...";
    saveStatus.classList.add("saving");
  } else if (state === "error") {
    saveStatus.textContent = "保存失败";
    saveStatus.classList.add("error");
  } else {
    saveStatus.textContent = "";
  }
}

function scheduleSave() {
  if (!siteId) return;
  pendingSave = true;
  setSaveStatus("saving");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 800);
}

async function doSave() {
  if (!pendingSave) return;
  pendingSave = false;
  if (!hasToken()) {
    setSaveStatus("error");
    showToast("需要配置 GitHub Token 才能保存更改");
    return;
  }
  try {
    site.updatedAt = Date.now();
    await gistUpdate(siteId, site);
    setSaveStatus("saved");
  } catch (e) {
    setSaveStatus("error");
    console.error("Save:", e);
  }
}

// ===== 已拥有站点 =====
function getOwned() {
  try {
    return JSON.parse(localStorage.getItem(TK_PREFIX + "owned") || "[]");
  } catch {
    return [];
  }
}

function addOwned(id) {
  const l = getOwned();
  if (!l.includes(id)) {
    l.push(id);
    localStorage.setItem(TK_PREFIX + "owned", JSON.stringify(l));
  }
}

function renderOwnedList() {
  if (!ownedListHome) return;
  const l = getOwned();
  if (!l.length) {
    ownedListHome.innerHTML = "";
    return;
  }
  ownedListHome.innerHTML =
    '<div class="owned-section"><h3>📦 我的站点</h3>' +
    l
      .map(
        i =>
          '<a class="owned-link" href="?id=' +
          i +
          '">📦 ' +
          i.slice(0, 12) +
          "…</a>"
      )
      .join("") +
    "</div>";
}

// ===== 自定义输入弹窗（兼容移动端） =====
function customPrompt(title, desc, defaultValue) {
  return new Promise(function (resolve) {
    promptTitle.textContent = title;
    promptDesc.textContent = desc || "";
    promptInput.value = defaultValue || "";
    promptInput.placeholder = defaultValue || "";
    promptInput.focus();
    promptModal.classList.remove("hidden");

    function cleanup() {
      promptModal.classList.add("hidden");
      btnConfirmPrompt.removeEventListener("click", onConfirm);
      btnCancelPrompt.removeEventListener("click", onCancel);
      btnClosePrompt.removeEventListener("click", onCancel);
      promptModal.removeEventListener("click", onBackdrop);
      promptInput.removeEventListener("keydown", onKeydown);
    }
    function onConfirm() {
      var val = promptInput.value.trim();
      cleanup();
      resolve(val || "");
    }
    function onCancel() {
      cleanup();
      resolve(null);
    }
    function onBackdrop(e) {
      if (e.target === promptModal) onCancel();
    }
    function onKeydown(e) {
      if (e.key === "Enter") onConfirm();
      if (e.key === "Escape") onCancel();
    }

    btnConfirmPrompt.addEventListener("click", onConfirm);
    btnCancelPrompt.addEventListener("click", onCancel);
    btnClosePrompt.addEventListener("click", onCancel);
    promptModal.addEventListener("click", onBackdrop);
    promptInput.addEventListener("keydown", onKeydown);
  });
}

// ===== 首页 Banner =====
function renderSetupBanner() {
  if (!setupBanner) return;
  setupBanner.innerHTML = "";
  if (getToken()) {
    setupBanner.innerHTML =
      '<span style="font-size:14px;color:#22c55e;">✅ Token 已配置</span>' +
      '<button id="btn-open-settings" class="btn btn-sm btn-secondary" style="margin-left:8px;">⚙️ 设置</button>';
    setupBanner
      .querySelector("#btn-open-settings")
      ?.addEventListener("click", showSettingsModal);
    btnCreateSite.disabled = false;
  } else {
    setupBanner.innerHTML =
      '<div class="banner-warn">🔑 请先配置 GitHub Token</div>' +
      '<button id="btn-open-settings" class="btn btn-primary">配置 GitHub</button>';
    setupBanner
      .querySelector("#btn-open-settings")
      ?.addEventListener("click", showSettingsModal);
    btnCreateSite.disabled = true;
  }
}

function showSettingsModal() {
  settingsModal.classList.remove("hidden");
  tokenInput.value = getToken();
  tokenStatus.textContent = "";
}

// ===== 站点页 Token 提示 =====
function renderSiteTokenBanner() {
  if (!siteTokenBanner) return;
  if (hasToken()) {
    siteTokenBanner.classList.add("hidden");
  } else {
    siteTokenBanner.classList.remove("hidden");
  }
}

// ===== 渲染站点 =====
function renderSite() {
  if (!site) return;
  sectionsContainer.innerHTML = "";
  sectionsContainer.classList.remove("hidden");
  document.getElementById("site-footer-bar").classList.remove("hidden");

  const hasPw = !!(site.sitePassword && site.sitePassword.length > 0);
  const lockedState = hasPw && !siteUnlocked;
  const lockIcon = hasPw ? (lockedState ? "🔒" : "🔓") : "🔓";

  site.sections.forEach((sec, si) => {
    const secDiv = document.createElement("div");
    secDiv.className = "section";
    secDiv.dataset.si = si;

    const head = document.createElement("div");
    head.className = "section-header";

    const lockBtn =
      '<button class="btn-icon sec-lock" data-si="' + si + '">' + lockIcon + "</button>";

    if (lockedState) {
      head.innerHTML =
        '<input class="section-title" data-si="' +
        si +
        '" value="' +
        esc(sec.title || "未命名") +
        '" readonly>' +
        lockBtn +
        '<button class="btn-small sec-unlock" data-si="' +
        si +
        '">🔓 解锁</button>';
    } else {
      head.innerHTML =
        '<input class="section-title" data-si="' +
        si +
        '" value="' +
        esc(sec.title || "未命名") +
        '">' +
        lockBtn +
        '<button class="btn-small zone-add-text" data-si="' +
        si +
        '">＋文字</button>' +
        '<button class="btn-small zone-add-image" data-si="' +
        si +
        '">＋图片</button>' +
        '<button class="btn-small sec-del" data-si="' +
        si +
        '">✕</button>';
    }

    secDiv.appendChild(head);

    const zonesDiv = document.createElement("div");
    zonesDiv.className = "section-zones";

    (sec.textZones || []).forEach((tz, i) =>
      zonesDiv.appendChild(renderTextZone(si, i, tz, lockedState))
    );
    (sec.imageZones || []).forEach((iz, i) =>
      zonesDiv.appendChild(renderImageZone(si, i, iz, lockedState))
    );

    secDiv.appendChild(zonesDiv);
    sectionsContainer.appendChild(secDiv);
  });
}

function renderTextZone(si, tzi, tz, locked) {
  const zone = document.createElement("div");
  zone.className = "zone";

  if (locked) {
    zone.innerHTML =
      '<div class="zone-header"><span class="zone-title-icon">📝</span>' +
      '<input class="zone-title" data-si="' +
      si +
      '" data-tzi="' +
      tzi +
      '" value="' +
      esc(tz.title || "文字区") +
      '" readonly></div>' +
      (tz.blocks || [])
        .map(
          (b, i) =>
            '<div class="block"><textarea readonly>' +
            esc(b.content) +
            '</textarea><button class="btn-small block-copy" data-si="' +
            si +
            '" data-tzi="' +
            tzi +
            '" data-bi="' +
            i +
            '">📋复制</button></div>'
        )
        .join("");
  } else {
    zone.innerHTML =
      '<div class="zone-header"><span class="zone-title-icon">📝</span>' +
      '<input class="zone-title" data-si="' +
      si +
      '" data-tzi="' +
      tzi +
      '" value="' +
      esc(tz.title || "文字区") +
      '"><button class="btn-small zone-del" data-si="' +
      si +
      '" data-type="text" data-tzi="' +
      tzi +
      '">✕</button></div>' +
      (tz.blocks || [])
        .map(
          (b, i) =>
            '<div class="block"><textarea data-si="' +
            si +
            '" data-tzi="' +
            tzi +
            '" data-bi="' +
            i +
            '">' +
            esc(b.content) +
            '</textarea><div class="block-actions"><button class="btn-small block-copy" data-si="' +
            si +
            '" data-tzi="' +
            tzi +
            '" data-bi="' +
            i +
            '">📋复制</button>' +
            '<button class="btn-small block-del" data-si="' +
            si +
            '" data-tzi="' +
            tzi +
            '" data-bi="' +
            i +
            '">✕</button></div></div>'
        )
        .join("") +
      '<div class="block-add-new"><button class="btn-small block-add-btn" data-si="' +
      si +
      '" data-tzi="' +
      tzi +
      '">＋添加</button></div>';
  }

  return zone;
}

function renderImageZone(si, izi, iz, locked) {
  const zone = document.createElement("div");
  zone.className = "zone";

  const imgs = (iz.images || [])
    .map(
      (img, i) =>
        '<div class="image-item"><img src="' +
        img +
        '" alt="">' +
        '<div class="img-actions">' +
        '<button class="btn-small img-copy-btn" data-img="' +
        img +
        '">📋</button>' +
        (locked
          ? ""
          : '<button class="btn-small img-del-btn" data-si="' +
            si +
            '" data-izi="' +
            izi +
            '" data-ii="' +
            i +
            '">✕</button>') +
        "</div></div>"
    )
    .join("");

  if (locked) {
    zone.innerHTML =
      '<div class="zone-header"><span class="zone-title-icon">🖼️</span>' +
      '<input class="zone-title" data-si="' +
      si +
      '" data-izi="' +
      izi +
      '" value="' +
      esc(iz.title || "图片区") +
      '" readonly></div>' +
      '<div class="images-grid">' +
      imgs +
      "</div>";
  } else {
    zone.innerHTML =
      '<div class="zone-header"><span class="zone-title-icon">🖼️</span>' +
      '<input class="zone-title" data-si="' +
      si +
      '" data-izi="' +
      izi +
      '" value="' +
      esc(iz.title || "图片区") +
      '"><button class="btn-small zone-del" data-si="' +
      si +
      '" data-type="image" data-izi="' +
      izi +
      '">✕</button></div>' +
      '<div class="images-grid">' +
      imgs +
      '<div class="image-add-area"><span>＋</span></div></div>';
  }

  return zone;
}

// ===== 事件委托: input =====
sectionsContainer.addEventListener("input", (e) => {
  const el = e.target;

  if (el.classList.contains("section-title")) {
    const si = parseInt(el.dataset.si);
    if (site.sections[si]) {
      site.sections[si].title = el.value;
      scheduleSave();
    }
    return;
  }

  if (el.classList.contains("zone-title")) {
    const si = parseInt(el.dataset.si),
          tzi = el.dataset.tzi,
          izi = el.dataset.izi;
    if (tzi !== undefined && site.sections[si]?.textZones[parseInt(tzi)]) {
      site.sections[si].textZones[parseInt(tzi)].title = el.value;
      scheduleSave();
    }
    if (izi !== undefined && site.sections[si]?.imageZones[parseInt(izi)]) {
      site.sections[si].imageZones[parseInt(izi)].title = el.value;
      scheduleSave();
    }
    return;
  }

  if (el.tagName === "TEXTAREA" && el.dataset.bi !== undefined) {
    const si = parseInt(el.dataset.si),
          tzi = parseInt(el.dataset.tzi),
          bi = parseInt(el.dataset.bi);
    if (site.sections[si]?.textZones[tzi]?.blocks[bi]) {
      site.sections[si].textZones[tzi].blocks[bi].content = el.value;
      scheduleSave();
    }
  }
});

// ===== 事件委托: click (分区操作) =====
sectionsContainer.addEventListener("click", async (e) => {
  const t = e.target.closest("button");
  if (!t) return;

  // 锁定/解锁
  if (t.classList.contains("sec-lock") || t.classList.contains("sec-unlock")) {
    handleLockAction();
    return;
  }

  // 删除分区
  if (t.classList.contains("sec-del")) {
    const si = parseInt(t.dataset.si);
    if (!confirm("确定删除此分区？")) return;
    site.sections.splice(si, 1);
    renderSite();
    scheduleSave();
    return;
  }

  // 添加文字区
  if (t.classList.contains("zone-add-text")) {
    const si = parseInt(t.dataset.si);
    const n = await customPrompt("文字区命名", "给文字区命名：", "新文字区");
    if (!n || !site.sections[si]) return;
    site.sections[si].textZones.push({ id: uid(), title: n, blocks: [] });
    renderSite();
    scheduleSave();
    return;
  }

  // 添加图片区
  if (t.classList.contains("zone-add-image")) {
    const si = parseInt(t.dataset.si);
    const n = await customPrompt("图片区命名", "给图片区命名：", "新图片区");
    if (!n || !site.sections[si]) return;
    site.sections[si].imageZones.push({ id: uid(), title: n, images: [] });
    renderSite();
    scheduleSave();
    return;
  }

  // 删除区域
  if (t.classList.contains("zone-del")) {
    const si = parseInt(t.dataset.si),
          type = t.dataset.type,
          tzi = t.dataset.tzi,
          izi = t.dataset.izi;
    if (!confirm("确定删除此区域？")) return;
    if (type === "text" && tzi !== undefined)
      site.sections[si]?.textZones.splice(parseInt(tzi), 1);
    else if (type === "image" && izi !== undefined)
      site.sections[si]?.imageZones.splice(parseInt(izi), 1);
    renderSite();
    scheduleSave();
    return;
  }

  // 添加文字块
  if (t.classList.contains("block-add-btn") || t.closest(".block-add-new")) {
    let si, tzi;
    if (t.classList.contains("block-add-btn")) {
      si = parseInt(t.dataset.si);
      tzi = parseInt(t.dataset.tzi);
    } else {
      const p = t.closest(".block-add-new");
      const b = p.querySelector("button");
      si = parseInt(b.dataset.si);
      tzi = parseInt(b.dataset.tzi);
    }
    const z = site.sections[si]?.textZones[tzi];
    if (!z) return;
    z.blocks.push({ id: uid(), content: "", createdAt: Date.now() });
    renderSite();
    scheduleSave();
    requestAnimationFrame(() => {
      const tas = sectionsContainer.querySelectorAll(
        '.block textarea[data-si="' + si + '"][data-tzi="' + tzi + '"]'
      );
      if (tas.length) tas[tas.length - 1].focus();
    });
    return;
  }

  // 复制文字块
  if (t.classList.contains("block-copy")) {
    const si = parseInt(t.dataset.si),
          tzi = parseInt(t.dataset.tzi),
          bi = parseInt(t.dataset.bi);
    const c = site.sections[si]?.textZones[tzi]?.blocks[bi]?.content || "";
    if (!c) {
      showToast("内容为空");
      return;
    }
    navigator.clipboard
      .writeText(c)
      .then(() => showToast("已复制"))
      .catch(() => showToast("复制失败"));
    return;
  }

  // 删除文字块
  if (t.classList.contains("block-del")) {
    const si = parseInt(t.dataset.si),
          tzi = parseInt(t.dataset.tzi),
          bi = parseInt(t.dataset.bi);
    site.sections[si]?.textZones[tzi]?.blocks.splice(bi, 1);
    renderSite();
    scheduleSave();
    return;
  }
});

// ===== 图片上传 =====
sectionsContainer.addEventListener("click", async (e) => {
  // 点击添加图片区域
  const addArea = e.target.closest(".image-add-area");
  if (addArea) {
    const zone = addArea.closest(".zone");
    const headerInput = zone.querySelector(".zone-title[data-izi]");
    if (headerInput) {
      fileInput.dataset.si = headerInput.dataset.si;
      fileInput.dataset.izi = headerInput.dataset.izi;
      fileInput.click();
    }
    return;
  }
});

fileInput.addEventListener("change", async () => {
  const si = parseInt(fileInput.dataset.si),
        izi = parseInt(fileInput.dataset.izi);
  if (isNaN(si) || isNaN(izi)) return;

  const files = Array.from(fileInput.files);
  fileInput.value = "";

  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    if (f.size > 5 * 1024 * 1024) {
      showToast("图片超过 5MB，已跳过");
      continue;
    }
    try {
      const d = await compressImage(f);
      if (site.sections[si]?.imageZones[izi])
        site.sections[si].imageZones[izi].images.push(d);
    } catch (e) {
      console.error(e);
    }
  }
  renderSite();
  scheduleSave();
});

// 图片复制/删除
sectionsContainer.addEventListener("click", async (e) => {
  const btn = e.target.closest(".img-copy-btn");
  if (btn) {
    const src = btn.dataset.img;
    if (!src) return;
    try {
      const blob = await (await fetch(src)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      showToast("图片已复制");
    } catch {
      showToast("可右键保存图片");
    }
    return;
  }

  const del = e.target.closest(".img-del-btn");
  if (del) {
    const si = parseInt(del.dataset.si),
          izi = parseInt(del.dataset.izi),
          ii = parseInt(del.dataset.ii);
    site.sections[si]?.imageZones[izi]?.images.splice(ii, 1);
    renderSite();
    scheduleSave();
  }
});

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width,
        h = img.height,
        max = 800;
      if (w > max || h > max) {
        const r = Math.min(max / w, max / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// ===== 搜索 =====
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
  $$(".section").forEach((el) => {
    el.classList.remove("section-hidden");
    el.classList.remove("section-highlight");
  });
  searchCount.textContent = "";
}

function filterSections(query) {
  const q = query.toLowerCase().trim();
  const els = $$(".section");
  let count = 0;
  els.forEach((el) => {
    const title =
      (el.querySelector(".section-title")?.value || "").toLowerCase();
    let zoneMatch = false;
    el.querySelectorAll(".zone-title").forEach((zi) => {
      if (zi.value.toLowerCase().indexOf(q) >= 0) zoneMatch = true;
    });
    if (title.indexOf(q) >= 0 || zoneMatch) {
      el.classList.remove("section-hidden");
      el.classList.add("section-highlight");
      count++;
    } else {
      el.classList.add("section-hidden");
      el.classList.remove("section-highlight");
    }
  });
  searchCount.textContent = count + "/" + els.length + " 个分区";
}

// ===== 目录 =====
function renderTOC() {
  if (!site || !tocList) return;
  tocList.innerHTML = "";
  if (!site.sections.length) {
    tocEmpty.classList.remove("hidden");
    return;
  }
  tocEmpty.classList.add("hidden");

  site.sections.forEach((sec, si) => {
    const item = document.createElement("div");
    item.className = "toc-item";

    const tc = sec.textZones?.length || 0,
          ic = sec.imageZones?.length || 0;
    const meta = [];
    if (tc) meta.push("📝" + tc);
    if (ic) meta.push("🖼️" + ic);

    item.innerHTML =
      '<span class="toc-item-name">' +
      esc(sec.title || "未命名") +
      '</span><small class="toc-item-meta">' +
      meta.join(" ") +
      "</small>";

    item.addEventListener("click", () => {
      tocModal.classList.add("hidden");
      if (searchActive) {
        searchActive = false;
        searchBar.classList.add("hidden");
        searchInput.value = "";
        clearSearch();
      }
      const el = $$(".section")[si];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("section-highlight");
        setTimeout(() => el.classList.remove("section-highlight"), 2000);
      }
    });

    tocList.appendChild(item);
  });
}

// ===== 锁定/解锁 =====
async function handleLockAction() {
  if (!site) return;
  const hasPw = site.sitePassword && site.sitePassword.length > 0;

  if (!hasPw) {
    const pw = await customPrompt("设置密码", "设置站点密码（留空取消）：", "");
    if (pw === null) return;
    site.sitePassword = pw || "";
    siteUnlocked = false;
    siteTitleInput.disabled = !!site.sitePassword;
    renderSite();
    scheduleSave();
    showToast(pw ? "密码已设置" : "密码已清除");
    return;
  }

  if (siteUnlocked) {
    siteUnlocked = false;
    siteTitleInput.disabled = true;
    renderSite();
    return;
  }

  const pw = await customPrompt("解锁", "请输入站点密码：", "");
  if (pw === null) return;
  if (pw === site.sitePassword) {
    siteUnlocked = true;
    siteTitleInput.disabled = false;
    renderSite();
    showToast("🔓 解锁成功");
  } else {
    showToast("❌ 密码错误");
  }
}

// ===== 分享 =====
btnShare?.addEventListener("click", async () => {
  if (!siteId) return;
  const link =
    window.location.origin +
    window.location.pathname.replace(/[?#].*$/, "") +
    "?id=" +
    siteId;
  shareLink.value = link;
  qrContainer.innerHTML = '<div class="qr-loading">加载二维码...</div>';

  try {
    if (typeof QRCode === "undefined") {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src =
          "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    qrContainer.innerHTML = "";
    new QRCode(qrContainer, {
      text: link,
      width: 160,
      height: 160,
      colorDark: "#1a1a2e",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H,
    });
  } catch (e) {
    qrContainer.innerHTML = '<div class="qr-error">二维码加载失败</div>';
  }

  shareModal.classList.remove("hidden");
});

btnCloseShare?.addEventListener("click", () =>
  shareModal.classList.add("hidden")
);
shareModal?.addEventListener("click", (e) => {
  if (e.target === shareModal) shareModal.classList.add("hidden");
});

btnCopyLink?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(shareLink.value);
    showToast("链接已复制");
  } catch {
    shareLink.select();
    document.execCommand("copy");
    showToast("链接已复制");
  }
});

// ===== 创建站点 =====
btnCreateSite?.addEventListener("click", async () => {
  if (!hasToken()) {
    showToast("请先配置 GitHub Token");
    return;
  }
  try {
    const id = await gistCreate({
      id: "",
      title: "我的站点",
      sitePassword: "",
      sections: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    addOwned(id);
    window.location.search = "?id=" + id;
  } catch (e) {
    showToast("创建失败: " + e.message);
  }
});

// ===== 添加分区 =====
async function addSectionHandler() {
  if (!siteId || !siteUnlocked) return;
  const n = await customPrompt("新建分区", "给新分区命名：", "新分区");
  if (!n) return;
  site.sections.push({
    id: uid(),
    title: n,
    textZones: [],
    imageZones: [],
  });
  renderSite();
  scheduleSave();
}

btnAddSection?.addEventListener("click", addSectionHandler);
btnAddSectionBottom?.addEventListener("click", addSectionHandler);

// ===== 导入表格（Excel/CSV）=====
function loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("加载表格解析库失败"));
    document.head.appendChild(s);
  });
}

btnImportExcel?.addEventListener("click", () => {
  if (!siteId) {
    showToast("请先打开一个站点");
    return;
  }
  excelFileInput.click();
});

excelFileInput?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  excelFileInput.value = "";

  if (!siteUnlocked) {
    showToast("请先解锁站点再导入");
    return;
  }

  showToast("正在解析表格...");

  try {
    await loadSheetJS();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    if (!rows.length) {
      showToast("表格为空");
      return;
    }

    // 第一行是表头：列0=类目，列1..N=各人设名称
    const headers = rows[0].map(h => String(h).trim());
    let importedSections = 0;
    let importedBlocks = 0;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const secName = String(row[0] || "").trim();
      if (!secName) continue; // 跳过空行

      // 查找或创建分区
      let sec = site.sections.find(s => s.title === secName);
      if (!sec) {
        sec = {
          id: uid(),
          title: secName,
          textZones: [],
          imageZones: [],
        };
        site.sections.push(sec);
        importedSections++;
      }

      // 遍历各列（跳过列0=类目名）
      for (let c = 1; c < headers.length; c++) {
        const zoneTitle = headers[c] || ("列" + c);
        const content = String(row[c] || "").trim();
        if (!content) continue;

        // 查找或创建文字区
        let zone = sec.textZones.find(z => z.title === zoneTitle);
        if (!zone) {
          zone = { id: uid(), title: zoneTitle, blocks: [] };
          sec.textZones.push(zone);
        }

        // 检查是否已存在相同内容的 block
        const isDup = zone.blocks.some(b => b.content === content);
        if (!isDup) {
          zone.blocks.push({ id: uid(), content, createdAt: Date.now() });
          importedBlocks++;
        }
      }
    }

    renderSite();
    scheduleSave();
    showToast("导入完成：新增 " + importedSections + " 个分区，" + importedBlocks + " 条文字");
  } catch (err) {
    console.error("Excel import:", err);
    showToast("导入失败：" + err.message);
  }
});

// ===== 搜索/TOC 按钮 =====
btnSearch?.addEventListener("click", toggleSearch);

searchInput?.addEventListener("input", function () {
  if (this.value.trim()) filterSections(this.value);
  else clearSearch();
});

btnSearchClose?.addEventListener("click", () => {
  if (searchActive) toggleSearch();
});

btnToc?.addEventListener("click", () => {
  if (searchActive) {
    searchActive = false;
    searchBar.classList.add("hidden");
    searchInput.value = "";
    clearSearch();
  }
  renderTOC();
  tocModal.classList.remove("hidden");
});

btnCloseToc?.addEventListener("click", () =>
  tocModal.classList.add("hidden")
);
tocModal?.addEventListener("click", (e) => {
  if (e.target === tocModal) tocModal.classList.add("hidden");
});

stLock?.addEventListener("click", handleLockAction);

btnConfigureToken?.addEventListener("click", showSettingsModal);

// ===== 设置弹窗 =====
document
  .getElementById("btn-settings-home")
  ?.addEventListener("click", (e) => {
    e.preventDefault();
    showSettingsModal();
  });

btnSettings?.addEventListener("click", showSettingsModal);
btnCloseSettings?.addEventListener("click", () =>
  settingsModal.classList.add("hidden")
);
settingsModal?.addEventListener("click", (e) => {
  if (e.target === settingsModal) settingsModal.classList.add("hidden");
});

btnSaveToken?.addEventListener("click", () => {
  const t = tokenInput.value.trim();
  if (!t) {
    tokenStatus.textContent = "请输入 Token";
    return;
  }
  setToken(t);
  tokenStatus.textContent = "✅ Token 已保存";
  renderSetupBanner();
  renderSiteTokenBanner();
  btnCreateSite.disabled = false;
  setTimeout(() => settingsModal.classList.add("hidden"), 600);
});

btnClearToken?.addEventListener("click", () => {
  setToken("");
  btnCreateSite.disabled = true;
  settingsModal.classList.add("hidden");
  renderSetupBanner();
  renderSiteTokenBanner();
  showToast("已清除 Token");
});

siteTitleInput?.addEventListener("change", function () {
  if (site && siteId) {
    site.title = this.value || "我的站点";
    scheduleSave();
  }
});

// ===== 主入口 =====
(async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  renderOwnedList();
  renderSetupBanner();
  renderSiteTokenBanner();

  if (id) {
    pageHome.classList.add("hidden");
    pageSite.classList.remove("hidden");
    siteLoading.classList.remove("hidden");
    siteError.classList.add("hidden");
    sectionsContainer.classList.add("hidden");
    document.getElementById("site-footer-bar").classList.add("hidden");

    try {
      const data = await gistGet(id);
      site = data;
      site.title = site.title || "我的站点";
      siteId = id;
      isOwner = hasToken();
      siteUnlocked = !(site.sitePassword && site.sitePassword.length > 0);

      siteLoading.classList.add("hidden");
      renderSite();
      siteTitleInput.value = site.title;
      siteTitleInput.disabled = !siteUnlocked;
    } catch (e) {
      console.error("Load error:", e);
      siteLoading.classList.add("hidden");
      siteError.classList.remove("hidden");
    }
  }
})();

window.addEventListener("popstate", () => location.reload());
