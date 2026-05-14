(function () {
  'use strict';

  const STYLE_ID = 'gh-stars-ext-style';
  const TOOLBAR_ID = 'gh-stars-toolbar';
  const GRID_CLASS = 'gh-stars-grid';
  const CARD_CLASS = 'gh-stars-card';
  const HIDDEN_CLASS = 'gh-stars-hide';

  const STORE_CATEGORIES = 'gh-stars-categories';
  const STORE_PREF = 'gh-stars-pref'; // 存储视图模式、尺寸

  let currentView = 'grid';
  let currentSize = 'extra-small';
  let categorizedMap = new Map();
  let pendingRepoFullName = null;

  /* ========== 偏好 & 分类数据加载 ========== */
  function loadPref() {
    try {
      const raw = localStorage.getItem(STORE_PREF);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (prefs.view) currentView = prefs.view;
      if (prefs.size) currentSize = prefs.size;
    } catch (e) {}
  }
  function savePref() {
    localStorage.setItem(STORE_PREF, JSON.stringify({
      view: currentView,
      size: currentSize
    }));
  }

  function loadCategories() {
    try {
      const raw = localStorage.getItem(STORE_CATEGORIES);
      return raw ? new Map(JSON.parse(raw)) : new Map();
    } catch (e) { return new Map(); }
  }
  function saveCategories() {
    localStorage.setItem(STORE_CATEGORIES, JSON.stringify([...categorizedMap]));
  }

  function setCategory(fullName, isCat) {
    if (isCat) categorizedMap.set(fullName, true);
    else categorizedMap.delete(fullName);
    saveCategories();
    updateAllCardsFor(fullName, isCat);
  }
  function isCategorized(fn) { return categorizedMap.has(fn); }

  function updateAllCardsFor(fullName, isCat) {
    document.querySelectorAll(`.${CARD_CLASS}[data-full-name="${fullName}"]`).forEach(card => {
      card.dataset.categorized = isCat ? 'true' : 'false';
      card.classList.toggle('categorized', isCat);
    });
    applyFilterIfNeeded();
  }

  function refreshAllCardCategories() {
    document.querySelectorAll(`.${CARD_CLASS}`).forEach(card => {
      const fn = card.dataset.fullName;
      if (fn) {
        const cat = isCategorized(fn);
        card.dataset.categorized = cat ? 'true' : 'false';
        card.classList.toggle('categorized', cat);
      }
    });
    applyFilterIfNeeded();
  }

  function applyFilterIfNeeded() {
    const cb = document.getElementById('filter-checkbox');
    if (cb && cb.checked) {
      document.querySelectorAll(`.${CARD_CLASS}`).forEach(c => {
        c.style.display = c.dataset.categorized === 'true' ? 'none' : '';
      });
    } else {
      document.querySelectorAll(`.${CARD_CLASS}`).forEach(c => c.style.display = '');
    }
  }

  /* ========== 页面判断 ========== */
  function isStarsPage() {
    const u = new URL(location.href);
    return u.pathname === '/stars' || u.searchParams.get('tab') === 'stars' || u.pathname.startsWith('/stars/');
  }
  function isListPage() {
    return location.pathname.includes('/lists/');
  }

  /* ========== 每页 100 项（强制） ========== */
  function enforcePerPage() {
    if (!isStarsPage()) return false;
    const url = new URL(location.href);

    if (isListPage()) {
      if (url.searchParams.get('per_page') !== '100') {
        url.searchParams.set('per_page', '100');
        location.replace(url.toString());
        return true;
      }
      return false;
    }

    if (!url.searchParams.get('tab')) {
      url.searchParams.set('tab', 'stars');
    }
    if (url.searchParams.get('per_page') !== '100') {
      url.searchParams.set('per_page', '100');
      location.replace(url.toString());
      return true;
    }
    if (url.pathname === '/stars' && url.search === '') {
      location.replace('/stars?tab=stars&per_page=100');
      return true;
    }
    return false;
  }

  /* ========== 样式 ========== */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${TOOLBAR_ID} { display:flex;align-items:center;gap:10px;padding:10px 0;margin-bottom:8px;border-bottom:1px solid #d0d7de;background:#fff;position:sticky;top:0;z-index:99;width:100%;flex-wrap:wrap; }
      #${TOOLBAR_ID} button,#${TOOLBAR_ID} select { background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:12px; }
      #${TOOLBAR_ID} button.active { background:#0969da;color:#fff;border-color:#0969da; }
      #${TOOLBAR_ID} label { display:flex;align-items:center;gap:4px;margin-left:auto;cursor:pointer;font-size:12px; }
      .${GRID_CLASS} { display:grid!important;gap:16px;padding:8px 0; }
      .${GRID_CLASS}.size-extra-small { grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); }
      .${GRID_CLASS}.size-small { grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); }
      .${GRID_CLASS}.size-medium { grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); }
      .${GRID_CLASS}.size-large { grid-template-columns:repeat(auto-fill,minmax(380px,1fr)); }
      .${CARD_CLASS} {
        border:1px solid #d0d7de;border-radius:12px;padding:16px;background:#fff;display:flex;flex-direction:column;
        transition:box-shadow 0.2s;min-height:170px;font-size:12px;position:relative;
      }
      .${CARD_CLASS}:hover { box-shadow:0 4px 12px rgba(0,0,0,0.08); }
      .${CARD_CLASS} .header { display:flex;align-items:center;gap:10px;margin-bottom:10px; }
      .${CARD_CLASS} .avatar { width:28px;height:28px;border-radius:6px;flex-shrink:0; }
      .${CARD_CLASS} .repo-name { font-size:14px;font-weight:600;color:#0969da;text-decoration:none;word-break:break-word; }
      .${CARD_CLASS} .repo-name:hover { text-decoration:underline; }
      .${CARD_CLASS} .desc { flex:1;font-size:12px;color:#57606a;margin-bottom:12px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden; }
      .${CARD_CLASS} .meta { display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#57606a;margin-top:auto; }
      .${CARD_CLASS} .actions { display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap; }
      .${CARD_CLASS}.categorized { border-left:3px solid #0969da; }
      .${HIDDEN_CLASS} { display:none!important; }
      .size-extra-small .${CARD_CLASS} { padding:10px;min-height:140px; }
      .size-extra-small .repo-name { font-size:12px; }
      .size-extra-small .desc { -webkit-line-clamp:2; }
    `;
    document.head.appendChild(style);
  }

  /* ========== 数据提取（stars 主页） ========== */
  function extractRepoData(item) {
    const repoLink = Array.from(item.querySelectorAll('a[href^="/"]')).find(a => {
      const href = a.getAttribute('href');
      return href && href.split('/').length >= 3 && !href.includes('/stargazers') && !href.includes('/forks') && a.textContent.trim().length > 0;
    });
    const avatar = item.querySelector('img.avatar-user, img.avatar, img[src*="avatars"]');
    const descEl = item.querySelector('.py-1 p, [itemprop="description"], .color-fg-muted.mt-2, p.mb-0, .f6');
    const desc = descEl?.textContent.trim() || '';
    const lang = item.querySelector('[itemprop="programmingLanguage"], span[class*="language-color"]');
    const stars = item.querySelector('a[href*="/stargazers"]');
    const time = item.querySelector('relative-time');
    const actions = item.querySelector('.float-right.d-flex, .starring-container');
    const actionsClone = actions ? actions.cloneNode(true) : null;
    let fullName = '';
    if (repoLink) {
      const parts = repoLink.getAttribute('href').replace(/^\//, '').split('/');
      if (parts.length >= 2) fullName = parts[0] + '/' + parts[1];
    }
    return { repoLink: repoLink?.cloneNode(true), avatar: avatar?.cloneNode(true), desc, lang: lang?.cloneNode(true), stars: stars?.cloneNode(true), time: time?.cloneNode(true), actionsClone, fullName };
  }

  /* ========== 数据提取（stars 列表页） ========== */
  function extractListRepoData(item) {
    const linkEl = item.querySelector('h2.h3 a');
    const repoLink = linkEl ? linkEl.cloneNode(true) : null;
    const descEl = item.querySelector('p[itemprop="description"]');
    const desc = descEl ? descEl.textContent.trim() : '';
    const langEl = item.querySelector('span[itemprop="programmingLanguage"]');
    const lang = langEl ? langEl.cloneNode(true) : null;
    const starsEl = item.querySelector('a[href*="/stargazers"]');
    const stars = starsEl ? starsEl.cloneNode(true) : null;
    const timeEl = item.querySelector('relative-time');
    const time = timeEl ? timeEl.cloneNode(true) : null;
    const actionsEl = item.querySelector('.float-right.d-flex');
    const actionsClone = actionsEl ? actionsEl.cloneNode(true) : null;
    let fullName = '';
    if (linkEl) {
      const parts = linkEl.getAttribute('href').replace(/^\//, '').split('/');
      if (parts.length >= 2) fullName = parts[0] + '/' + parts[1];
    }
    return {
      repoLink,
      avatar: null,
      desc,
      lang,
      stars,
      time,
      actionsClone,
      fullName
    };
  }

  function buildCard(data, showCategoryBorder = true) {
    const card = document.createElement('div');
    card.className = CARD_CLASS;
    card.dataset.fullName = data.fullName;
    if (showCategoryBorder) {
      const cat = isCategorized(data.fullName);
      card.dataset.categorized = cat ? 'true' : 'false';
      if (cat) card.classList.add('categorized');
    }

    const header = document.createElement('div'); header.className = 'header';
    if (data.avatar) { data.avatar.className = 'avatar'; header.appendChild(data.avatar); }
    if (data.repoLink) { data.repoLink.className = 'repo-name'; header.appendChild(data.repoLink); }
    card.appendChild(header);
    if (data.desc) {
      const d = document.createElement('div'); d.className = 'desc'; d.textContent = data.desc; card.appendChild(d);
    }
    const meta = document.createElement('div'); meta.className = 'meta';
    const left = document.createElement('div'); if (data.lang) left.appendChild(data.lang);
    const right = document.createElement('div'); right.style.cssText = 'display:flex;gap:8px;';
    if (data.stars) right.appendChild(data.stars);
    if (data.time) right.appendChild(data.time);
    meta.appendChild(left); meta.appendChild(right);
    card.appendChild(meta);
    if (data.actionsClone) {
      const actDiv = document.createElement('div'); actDiv.className = 'actions';
      actDiv.appendChild(data.actionsClone);
      card.appendChild(actDiv);
    }

    return card;
  }

  /* ========== 容器获取 ========== */
  function getRepoContainer() {
    const frame = document.querySelector('#user-starred-repos');
    if (!frame) return null;
    return frame.querySelector('.col-lg-12') || frame;
  }

  function getListContainer() {
    const items = document.querySelectorAll('.col-12.d-block.width-full');
    if (items.length === 0) return null;
    return items[0].parentNode;
  }

  /* ========== 视图应用 ========== */
  function applyView(container, view, size, extractFn = extractRepoData, showCategoryBorder = true) {
    if (!container) return;
    const oldGrid = container.querySelector(`.${GRID_CLASS}`);
    if (oldGrid) oldGrid.remove();
    container.querySelectorAll(`.${HIDDEN_CLASS}`).forEach(el => el.classList.remove(HIDDEN_CLASS));
    if (view === 'list') return;

    const items = Array.from(container.querySelectorAll(':scope > .col-12.d-block.width-full'));
    if (items.length === 0) return;

    const grid = document.createElement('div');
    grid.className = `${GRID_CLASS} size-${size}`;
    items.forEach(item => {
      item.classList.add(HIDDEN_CLASS);
      const data = extractFn(item);
      if (data.repoLink) grid.appendChild(buildCard(data, showCategoryBorder));
      else item.classList.remove(HIDDEN_CLASS);
    });
    container.prepend(grid);
  }

  /* ========== 点击事件（记录仓库）– 仅 stars 主页 ========== */
  function attachClickListeners() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button[aria-haspopup="dialog"], button[aria-haspopup="true"], button[aria-label*="list" i], .starred-list-button');
      if (!btn) return;

      let el = btn;
      while (el) {
        if (el.classList.contains(CARD_CLASS)) {
          pendingRepoFullName = el.dataset.fullName;
          return;
        }
        if (el.classList.contains('col-12') && el.classList.contains('d-block')) {
          const data = extractRepoData(el);
          pendingRepoFullName = data.fullName;
          return;
        }
        el = el.parentElement;
      }
    }, true);
  }

  /* ========== 对话框列表监听 – 仅 stars 主页 ========== */
  function observeDialogList() {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          const listbox = node.matches?.('ul[role="listbox"]') ? node : node.querySelector?.('ul[role="listbox"]');
          if (listbox && pendingRepoFullName) {
            checkListState(listbox);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function checkListState(listbox) {
    const options = listbox.querySelectorAll('[role="option"]');
    if (options.length === 0) return;
    const selected = [...options].filter(opt => opt.getAttribute('aria-selected') === 'true');
    const isCat = selected.length > 0;
    const repo = pendingRepoFullName;
    pendingRepoFullName = null;
    if (repo) {
      setCategory(repo, isCat);
    }
  }

  /* ========== 工具栏 ========== */
  function createToolbar(container, simpleMode = false) {
    if (!container) return;
    const frame = simpleMode ? container : document.querySelector('#user-starred-repos');
    if (!frame || document.getElementById(TOOLBAR_ID)) return;

    const toolbar = document.createElement('div');
    toolbar.id = TOOLBAR_ID;

    const listBtn = document.createElement('button'); listBtn.textContent = '☰ 列表';
    const gridBtn = document.createElement('button'); gridBtn.textContent = '⊞ 网格';
    gridBtn.className = currentView === 'grid' ? 'active' : '';
    listBtn.className = currentView === 'list' ? 'active' : '';
    toolbar.appendChild(listBtn); toolbar.appendChild(gridBtn);

    const sizeLabel = document.createElement('span'); sizeLabel.textContent = '大小:';
    const sizeSelect = document.createElement('select');
    sizeSelect.innerHTML = `
      <option value="extra-small" ${currentSize === 'extra-small' ? 'selected' : ''}>1</option>
      <option value="small" ${currentSize === 'small' ? 'selected' : ''}>2</option>
      <option value="medium" ${currentSize === 'medium' ? 'selected' : ''}>3</option>
    `;
    toolbar.appendChild(sizeLabel); toolbar.appendChild(sizeSelect);

    if (!simpleMode) {
      // stars 主页分类功能区域
      const markAllBtn = document.createElement('button');
      markAllBtn.textContent = '全部标记已分类';
      markAllBtn.addEventListener('click', () => {
        document.querySelectorAll(`.${CARD_CLASS}`).forEach(card => {
          const fn = card.dataset.fullName;
          if (fn) setCategory(fn, true);
        });
      });
      toolbar.appendChild(markAllBtn);

      const clearAllBtn = document.createElement('button');
      clearAllBtn.textContent = '清除全部分类';
      clearAllBtn.addEventListener('click', () => {
        categorizedMap.clear();
        saveCategories();
        refreshAllCardCategories();
      });
      toolbar.appendChild(clearAllBtn);

      const filterLabel = document.createElement('label');
      const filterCheck = document.createElement('input');
      filterCheck.type = 'checkbox'; filterCheck.id = 'filter-checkbox';
      filterLabel.appendChild(filterCheck);
      filterLabel.appendChild(document.createTextNode('只看未分类'));
      toolbar.appendChild(filterLabel);
    }

    if (simpleMode) {
      container.parentNode.insertBefore(toolbar, container);
    } else {
      frame.prepend(toolbar);
    }

    const applyViewMode = (v, s = currentSize) => {
      currentView = v; currentSize = s;
      savePref();
      listBtn.className = v === 'list' ? 'active' : '';
      gridBtn.className = v === 'grid' ? 'active' : '';
      if (simpleMode) {
        applyView(container, v, s, extractListRepoData, false);
      } else {
        applyView(container, v, s, extractRepoData, true);
        const filterCheck = document.getElementById('filter-checkbox');
        if (filterCheck) filterCheck.checked = false;
        applyFilterIfNeeded();
      }
    };
    listBtn.addEventListener('click', () => applyViewMode('list'));
    gridBtn.addEventListener('click', () => applyViewMode('grid', sizeSelect.value));
    sizeSelect.addEventListener('change', () => {
      if (currentView === 'grid') applyViewMode('grid', sizeSelect.value);
    });

    if (!simpleMode) {
      const filterCheck = document.getElementById('filter-checkbox');
      if (filterCheck) filterCheck.addEventListener('change', applyFilterIfNeeded);
      categorizedMap = loadCategories();
    }

    // 初次应用视图
    if (simpleMode) {
      applyView(container, currentView, currentSize, extractListRepoData, false);
    } else {
      applyView(container, currentView, currentSize, extractRepoData, true);
    }
  }

  function setupStarsSection(simpleMode = false) {
    const container = simpleMode ? getListContainer() : getRepoContainer();
    if (container) createToolbar(container, simpleMode);
  }

  function init() {
    if (!isStarsPage()) return;
    if (enforcePerPage()) return;

    injectStyles();

    if (isListPage()) {
      setupStarsSection(true);
    } else {
      setupStarsSection(false);
      attachClickListeners();
      observeDialogList();
    }
  }

  function watchTurboFrame() {
    const frame = document.querySelector('#user-starred-repos');
    if (frame) {
      frame.addEventListener('turbo:frame-load', () => {
        setTimeout(() => {
          const old = document.getElementById(TOOLBAR_ID);
          if (old) old.remove();
          if (isListPage()) {
            setupStarsSection(true);
          } else {
            setupStarsSection(false);
            attachClickListeners();
          }
        }, 100);
      });
    }
  }

  // 加载偏好
  loadPref();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); watchTurboFrame(); });
  } else {
    init();
    watchTurboFrame();
  }

  new MutationObserver(() => {
    if (isStarsPage() && !document.getElementById(TOOLBAR_ID)) {
      if (isListPage()) {
        setupStarsSection(true);
      } else {
        setupStarsSection(false);
        attachClickListeners();
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
})();