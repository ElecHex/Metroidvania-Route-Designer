/* ============================================================
   ROUTE FORGE — application shell, editor interactions
   ============================================================ */
(function (global) {
  'use strict';
  const MV = global.MV;
  const $ = id => document.getElementById(id);

  const els = {
    projectName: $('projectName'),
    saveState: $('saveState'),
    undoBtn: $('undoBtn'),
    redoBtn: $('redoBtn'),
    saveBtn: $('saveBtn'),
    exportBtn: $('exportBtn'),
    importBtn: $('importBtn'),
    presetBtn: $('presetBtn'),
    paletteBtn: $('paletteBtn'),
    themeBtn: $('themeBtn'),
    helpBtn: $('helpBtn'),
    toolList: $('toolList'),
    itemKindSeg: $('itemKindSeg'),
    addRegionBtn: $('addRegionBtn'),
    showAllRegionsBtn: $('showAllRegionsBtn'),
    regionSummary: $('regionSummary'),
    regionList: $('regionList'),
    layerList: $('layerList'),
    exportPngBtn: $('exportPngBtn'),
    stage2d: $('stage2d'),
    stage3d: $('stage3d'),
    canvas2d: $('canvas2d'),
    canvas3d: $('canvas3d'),
    toolHint: $('toolHint'),
    toolHint3d: $('toolHint3d'),
    connectHint: $('connectHint'),
    canvasTooltip: $('canvasTooltip'),
    rightBody: $('rightBody'),
    statusMode: $('statusMode'),
    statusCounts: $('statusCounts'),
    statusCoords: $('statusCoords'),
    statusZoom: $('statusZoom'),
    statusAnalysis: $('statusAnalysis'),
    toast: $('toast'),
    modalRoot: $('modalRoot'),
    fileInput: $('fileInput')
  };

  const app = {
    project: null,
    analysis: null,
    selection: null,
    tool: 'select',
    mode: '2d',
    theme: 'dark',
    colorMode: 'color',
    hiddenRegions: new Set(),
    itemKind: 'ability',
    currentRegion: null,
    rightTab: 'inspect',
    layers: {
      gates: true, items: true, regions: true, path: true,
      phases: true, grid: true, names: true
    },
    view2d: null,
    view3d: null,
    history: new MV.History(100),
    dirty: false,
    lastSaved: 0,
    drag: null,
    hover: null,
    connectFrom: null,
    spaceDown: false,
    editGroup: false,
    editTimer: null,
    modal: null,
    raf: 0,
    fitted2d: true,
    fitted3d: false
  };

  let toastTimer = null;
  const persistUI = MV.debounce(() => {
    MV.saveUI({
      mode: app.mode,
      theme: app.theme,
      colorMode: app.colorMode,
      tool: app.tool,
      itemKind: app.itemKind,
      rightTab: app.rightTab,
      layers: app.layers,
      hiddenRegions: Array.from(app.hiddenRegions),
      currentRegion: app.currentRegion,
      cam2d: app.view2d ? app.view2d.cam : null,
      cam3d: app.view3d ? app.view3d.cam : null
    });
  }, 250);

  const autosave = MV.debounce(() => {
    MV.saveProject(app.project);
    app.lastSaved = Date.now();
    app.dirty = false;
    updateSaveState();
  }, 550);

  /* ============================================================
     boot
     ============================================================ */
  function boot() {
    const savedUI = MV.loadUI() || {};
    app.theme = savedUI.theme === 'light' ? 'light' : 'dark';
    applyTheme(app.theme, false);
    if (savedUI.layers && typeof savedUI.layers === 'object') {
      Object.keys(app.layers).forEach(key => {
        if (typeof savedUI.layers[key] === 'boolean') app.layers[key] = savedUI.layers[key];
      });
    }
    if (savedUI.mode === '3d') app.mode = '3d';
    if (savedUI.colorMode === 'mono' || savedUI.colorMode === 'color') app.colorMode = savedUI.colorMode;
    if (['inspect', 'progress', 'guide'].includes(savedUI.rightTab)) app.rightTab = savedUI.rightTab;
    if (['ability', 'key', 'upgrade', 'boss'].includes(savedUI.itemKind)) app.itemKind = savedUI.itemKind;
    if (['select', 'room', 'connect', 'item', 'pan'].includes(savedUI.tool)) app.tool = savedUI.tool;

    let project = MV.loadProject();
    const loadedFromStorage = !!project;
    if (!project) {
      try {
        project = MV.PRESETS[0].build();
      } catch (err) {
        console.warn('Route Forge: preset build failed, using blank project', err);
        project = MV.createBlankProject();
      }
    }
    app.project = MV.normalizeProject(project);
    app.lastSaved = loadedFromStorage ? (app.project.meta.updated || 0) : 0;
    if (Array.isArray(savedUI.hiddenRegions)) {
      app.hiddenRegions = new Set(savedUI.hiddenRegions.filter(id => app.project.regions.some(region => region.id === id)));
    }
    app.currentRegion = (app.project.regions.find(r => r.id === savedUI.currentRegion) || app.project.regions[0]).id;
    app.analysis = MV.analyze(app.project);

    const cam2 = savedUI.cam2d && typeof savedUI.cam2d.zoom === 'number' ? savedUI.cam2d : null;
    const initialW = canvasW(els.canvas2d);
    const initialH = canvasH(els.canvas2d);
    const initialCam2 = cam2
      ? cam2
      : readableCamera(MV.Render2D.fitCamera(app.project, initialW, initialH, initialW < 700 ? 44 : 100), initialW);
    app.view2d = {
      cam: initialCam2,
      layers: app.layers,
      selection: null,
      hover: null,
      analysis: app.analysis,
      tool: app.tool,
      connectFrom: null,
      pointerScreen: { x: 0, y: 0 },
      draftRoom: null
    };
    const cam3 = savedUI.cam3d && typeof savedUI.cam3d.dist === 'number' ? savedUI.cam3d : null;
    app.view3d = {
      cam: cam3 || MV.Render3D.fitCamera(app.project, canvasW(els.canvas3d), canvasH(els.canvas3d)),
      center2d: MV.Render3D.mapCenter(app.project),
      layers: app.layers,
      selection: null,
      hover: null,
      analysis: app.analysis
    };
    app.fitted3d = !!cam3;

    bindUI();
    applyModeUI();
    updateToolUI();
    refreshAll();
    updateSaveState();

    const ro = new ResizeObserver(() => scheduleRender());
    ro.observe(els.stage2d);
    ro.observe(els.stage3d);
    window.addEventListener('resize', scheduleRender);
    requestAnimationFrame(() => {
      if (app.mode === '3d' && !app.fitted3d) fit3D();
      scheduleRender();
    });
  }

  function canvasW(canvas) { return canvas.clientWidth || 1200; }
  function canvasH(canvas) { return canvas.clientHeight || 760; }

  /* ============================================================
     UI bindings
     ============================================================ */
  function bindUI() {
    els.projectName.addEventListener('input', () => {
      beforeEdit();
      app.project.meta.title = els.projectName.value || '未命名路线';
      markDirty();
      scheduleRender();
      persistUI();
    });
    els.projectName.addEventListener('blur', () => {
      if (!els.projectName.value.trim()) {
        els.projectName.value = '未命名路线';
        app.project.meta.title = els.projectName.value;
        markDirty();
      }
    });

    els.undoBtn.addEventListener('click', undo);
    els.redoBtn.addEventListener('click', redo);
    els.saveBtn.addEventListener('click', saveNow);
    els.exportBtn.addEventListener('click', exportJSON);
    els.importBtn.addEventListener('click', () => els.fileInput.click());
    els.presetBtn.addEventListener('click', openPresetModal);
    els.paletteBtn.addEventListener('click', openPaletteModal);
    els.themeBtn.addEventListener('click', () => {
      applyTheme(app.theme === 'light' ? 'dark' : 'light', true);
    });
    els.helpBtn.addEventListener('click', openHelpModal);
    els.exportPngBtn.addEventListener('click', exportPNG);
    els.fileInput.addEventListener('change', importJSON);

    document.querySelectorAll('.mode-tab').forEach(btn => {
      btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });
    document.querySelectorAll('.right-tabs button').forEach(btn => {
      btn.addEventListener('click', () => switchRightTab(btn.dataset.rtab));
    });
    els.toolList.addEventListener('click', e => {
      const btn = e.target.closest('[data-tool]');
      if (btn) setTool(btn.dataset.tool);
    });
    els.itemKindSeg.addEventListener('click', e => {
      const btn = e.target.closest('[data-kind]');
      if (!btn) return;
      app.itemKind = btn.dataset.kind;
      updateToolUI();
      persistUI();
    });
    els.addRegionBtn.addEventListener('click', addRegion);
    els.showAllRegionsBtn.addEventListener('click', showAllRegions);
    els.regionList.addEventListener('click', e => {
      if (e.target.closest('[data-region-visible]')) { e.stopPropagation(); return; }
      const focusBtn = e.target.closest('[data-focus-region]');
      if (focusBtn) {
        e.stopPropagation();
        focusRegion(focusBtn.dataset.focusRegion);
        return;
      }
      const row = e.target.closest('[data-region]');
      if (row) selectRegion(row.dataset.region);
    });
    els.regionList.addEventListener('change', e => {
      const checkbox = e.target.closest('[data-region-visible]');
      if (checkbox) toggleRegionVisibility(checkbox.dataset.regionVisible, checkbox.checked);
    });
    els.layerList.addEventListener('change', e => {
      const input = e.target.closest('[data-layer]');
      if (!input) return;
      app.layers[input.dataset.layer] = input.checked;
      syncViews();
      scheduleRender();
      persistUI();
    });

    document.querySelectorAll('[data-zoom]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.zoom === 'fit') {
          fit2D();
        } else {
          MV.Render2D.zoomAt(app.view2d, canvasW(els.canvas2d), canvasH(els.canvas2d),
            canvasW(els.canvas2d) / 2, canvasH(els.canvas2d) / 2, btn.dataset.zoom === 'in' ? 1.2 : 1 / 1.2);
          scheduleRender();
          updateStatusZoom();
        }
      });
    });
    document.querySelectorAll('[data-view3d]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.view3d;
        document.querySelectorAll('[data-view3d]').forEach(b => b.classList.remove('is-active'));
        if (preset !== 'fit') btn.classList.add('is-active');
        if (preset === 'fit') {
          fit3D();
        } else {
          app.view3d.cam = MV.Render3D.cameraPreset(preset, app.project, canvasW(els.canvas3d), canvasH(els.canvas3d));
          scheduleRender();
          updateStatusZoom();
        }
        persistUI();
      });
    });

    els.rightBody.addEventListener('input', onRightInput);
    els.rightBody.addEventListener('change', onRightChange);
    els.rightBody.addEventListener('click', onRightClick);

    bindCanvas(els.canvas2d, '2d');
    bindCanvas(els.canvas3d, '3d');

    els.modalRoot.addEventListener('click', onModalClick);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', e => {
      if (e.code === 'Space') {
        app.spaceDown = false;
        updateCursor();
      }
    });
  }

  function bindCanvas(canvas, mode) {
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => onPointerDown(e, mode));
    canvas.addEventListener('pointermove', e => onPointerMove(e, mode));
    canvas.addEventListener('pointerup', e => onPointerUp(e, mode));
    canvas.addEventListener('pointercancel', e => onPointerUp(e, mode));
    canvas.addEventListener('pointerleave', () => {
      if (!app.drag) hideTooltip();
    });
    canvas.addEventListener('dblclick', () => {
      if (app.selection && app.selection.type === 'room') focusRoom(app.selection.id);
    });
    canvas.addEventListener('wheel', e => onWheel(e, mode), { passive: false });
  }

  /* ============================================================
     rendering
     ============================================================ */
  function syncViews() {
    if (!app.view2d || !app.view3d) return;
    app.view2d.layers = app.layers;
    app.view2d.selection = app.selection;
    app.view2d.hover = app.hover;
    app.view2d.analysis = app.analysis;
    app.view2d.tool = app.tool;
    app.view2d.colorMode = app.colorMode;
    app.view2d.connectFrom = app.connectFrom;
    app.view3d.layers = app.layers;
    app.view3d.selection = app.selection;
    app.view3d.hover = app.hover;
    app.view3d.analysis = app.analysis;
    app.view3d.colorMode = app.colorMode;
  }

  function visibleProject() {
    if (!app.hiddenRegions.size) return app.project;
    const regions = app.project.regions.filter(region => !app.hiddenRegions.has(region.id));
    const regionIds = new Set(regions.map(region => region.id));
    const rooms = app.project.rooms.filter(room => regionIds.has(room.region));
    const roomIds = new Set(rooms.map(room => room.id));
    return Object.assign({}, app.project, {
      regions,
      rooms,
      links: app.project.links.filter(link => roomIds.has(link.a) && roomIds.has(link.b)),
      items: app.project.items.filter(item => roomIds.has(item.room))
    });
  }

  function scheduleRender() {
    if (app.raf) return;
    app.raf = requestAnimationFrame(() => {
      app.raf = 0;
      syncViews();
      const project = visibleProject();
      if (app.mode === '2d') {
        MV.Render2D.draw(els.canvas2d, project, app.view2d);
      } else {
        MV.Render3D.draw(els.canvas3d, project, app.view3d);
      }
      updateStatusZoom();
    });
  }

  function refreshAll() {
    updateHeader();
    renderRegionList();
    renderRightPanel();
    updateStatus();
    updateHistoryButtons();
    syncViews();
    scheduleRender();
  }

  function updateHeader() {
    if (document.activeElement !== els.projectName) {
      els.projectName.value = app.project.meta.title || '未命名路线';
    }
    updateSaveState();
  }

  function updateSaveState() {
    if (app.dirty) {
      els.saveState.textContent = '编辑中 · 未保存';
      els.saveState.classList.add('is-dirty');
    } else if (app.lastSaved) {
      els.saveState.textContent = '已保存 ' + MV.formatTime(app.lastSaved);
      els.saveState.classList.remove('is-dirty');
    } else {
      els.saveState.textContent = '本地自动保存';
      els.saveState.classList.remove('is-dirty');
    }
  }

  function updateStatus() {
    const counts = MV.projectCounts(app.project);
    const visibleRegions = counts.regions - app.hiddenRegions.size;
    els.statusMode.textContent = app.mode === '2d' ? '2D ROUTE' : '3D MASSING';
    els.statusCounts.textContent = counts.regions + ' regions / ' + counts.rooms + ' rooms / ' + counts.links + ' links / ' + counts.items + ' items' +
      (app.hiddenRegions.size ? ' · ' + visibleRegions + '/' + counts.regions + ' regions visible' : '');
    if (app.analysis) {
      const errors = app.analysis.warnings.filter(w => w.level === 'error').length;
      const warns = app.analysis.warnings.filter(w => w.level === 'warn').length;
      els.statusAnalysis.textContent = errors ? errors + ' ERROR' + (errors > 1 ? 'S' : '') : (warns ? warns + ' WARN' : 'ROUTE OK');
    } else {
      els.statusAnalysis.textContent = 'READY';
    }
    updateStatusZoom();
  }

  function updateStatusZoom() {
    if (app.mode === '2d') {
      els.statusZoom.textContent = Math.round(app.view2d.cam.zoom * 100) + '%';
    } else {
      els.statusZoom.textContent = 'DIST ' + Math.round(app.view3d.cam.dist);
    }
  }

  function updateHistoryButtons() {
    els.undoBtn.disabled = !app.history.canUndo;
    els.redoBtn.disabled = !app.history.canRedo;
  }

  function renderRegionList() {
    const activeRegion = app.selection && app.selection.type === 'region'
      ? app.selection.id
      : app.currentRegion;
    const visibleCount = app.project.regions.length - app.hiddenRegions.size;
    if (els.regionSummary) els.regionSummary.textContent = visibleCount + '/' + app.project.regions.length;
    const html = app.project.regions.map(region => {
      const count = app.project.rooms.filter(room => room.region === region.id).length;
      const color = MV.regionColor(region, app.colorMode);
      const hidden = app.hiddenRegions.has(region.id);
      return `<div class="region-row ${region.id === activeRegion ? 'is-active' : ''} ${hidden ? 'is-hidden' : ''}" data-region="${esc(region.id)}" role="button" tabindex="0" title="${esc(region.code)} / ${count} rooms">
        <input class="region-visible" type="checkbox" data-region-visible="${esc(region.id)}" ${hidden ? '' : 'checked'} title="${hidden ? '显示' : '隐藏'} ${esc(region.name)}" aria-label="${hidden ? '显示' : '隐藏'} ${esc(region.name)}">
        <span class="region-swatch" style="background:${color}"></span>
        <span class="region-name">${esc(region.name)}</span>
        <span class="region-count">${String(count).padStart(2, '0')}</span>
        <button class="region-focus" data-focus-region="${esc(region.id)}" title="聚焦区域">
          <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4.5"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3"/></svg>
        </button>
      </div>`;
    }).join('');
    els.regionList.innerHTML = html || '<div class="region-empty">还没有区域</div>';
  }

  function renderRightPanel() {
    els.rightBody.classList.toggle('is-guide', app.rightTab === 'guide');
    document.querySelectorAll('.right-tabs button').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.rtab === app.rightTab);
    });
    if (app.rightTab === 'inspect') renderInspector();
    else if (app.rightTab === 'progress') renderProgress();
    else renderGuide();
  }

  /* ============================================================
     inspector
     ============================================================ */
  function renderInspector() {
    els.rightBody.classList.remove('is-guide');
    const sel = app.selection;
    if (!sel) {
      els.rightBody.innerHTML = inspectorProject();
      return;
    }
    if (sel.type === 'room') els.rightBody.innerHTML = inspectorRoom(sel.id);
    else if (sel.type === 'link') els.rightBody.innerHTML = inspectorLink(sel.id);
    else if (sel.type === 'item') els.rightBody.innerHTML = inspectorItem(sel.id);
    else if (sel.type === 'region') els.rightBody.innerHTML = inspectorRegion(sel.id);
    else els.rightBody.innerHTML = inspectorProject();
  }

  function inspectorHead(eyebrow, title, pills) {
    return `<div class="insp-head">
      <div class="eyebrow">${eyebrow}</div>
      <h2 class="insp-title">${esc(title)}</h2>
      <div class="insp-sub">${pills.map(p => `<span class="pill ${p.solid ? 'is-solid' : ''}">${p.text}</span>`).join('')}</div>
    </div>`;
  }

  function inspectorRoom(id) {
    const room = MV.findRoom(app.project, id);
    if (!room) return inspectorProject();
    const region = app.project.regions.find(r => r.id === room.region) || app.project.regions[0];
    const type = MV.roomTypeById(room.type);
    const items = app.project.items.filter(item => item.room === room.id);
    const links = app.project.links.filter(link => link.a === room.id || link.b === room.id);
    const phase = app.analysis.roomPhase[room.id];
    const reachable = app.analysis.reachable.includes(room.id);
    const pills = [
      { text: region.code + ' / ' + region.name },
      { text: type.code },
      { text: items.length + ' ITEMS' },
      { text: reachable ? (phase !== undefined ? 'PHASE ' + String(phase).padStart(2, '0') : 'REACHABLE') : 'UNREACHABLE', solid: !reachable }
    ];
    return `${inspectorHead('ROOM / 房间', room.name, pills)}
      <div class="form-grid">
        <label class="field"><span>名称</span><input data-field="name" value="${esc(room.name)}"></label>
        <div class="form-grid two">
          <label class="field"><span>区域</span><select data-field="region">${app.project.regions.map(r => `<option value="${esc(r.id)}" ${r.id === room.region ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
          <label class="field"><span>类型</span><select data-field="type">${MV.ROOM_TYPES.map(t => `<option value="${t.id}" ${t.id === room.type ? 'selected' : ''}>${t.name}</option>`).join('')}</select></label>
        </div>
        <div class="form-grid two">
          ${numberField('X', 'x', room.x, 5)}
          ${numberField('Y', 'y', room.y, 5)}
        </div>
        <div class="form-grid two">
          ${numberField('宽度', 'w', room.w, 5, 56)}
          ${numberField('高度（2D）', 'h', room.h, 5, 36)}
        </div>
        <div class="section-label">3D 体块</div>
        <div class="form-grid three">
          ${numberField('层高', 'height', room.height, 2, 8)}
          ${numberField('基座', 'elev', room.elev, 2)}
          ${numberField('进深', 'depth', room.depth, 2, 10)}
        </div>
        <p class="hint-line">2D 宽度 / 高度控制平面轮廓；层高、基座、进深只影响 3D 体块。可在 3D 视图中直接拖动，Shift+拖动改基座高度。</p>
        <label class="field"><span>备注</span><textarea data-field="note" rows="3">${esc(room.note)}</textarea></label>
      </div>
      <div class="section-label">房间物品</div>
      <div class="item-list">
        ${items.length ? items.map(item => itemRow(item, true)).join('') : '<div class="item-empty">这间房还没有物品。</div>'}
      </div>
      <div class="btn-row"><button class="btn btn-ghost" data-action="add-item" data-room="${esc(room.id)}">+ 添加物品</button></div>
      <div class="section-label">连接</div>
      <div class="item-list">
        ${links.length ? links.map(link => linkRow(link, room.id)).join('') : '<div class="item-empty">这间房还没有连接。</div>'}
      </div>
      <div class="btn-row">
        <button class="btn" data-action="focus">聚焦房间</button>
        <button class="btn" data-action="duplicate-room">复制</button>
        <button class="btn btn-danger" data-action="delete-room">删除房间</button>
      </div>`;
  }

  function itemRow(item, showKind) {
    return `<button class="item-row" data-select-item="${esc(item.id)}">
      <span class="item-glyph kind-${esc(item.kind)}"><span>${MV.itemKindById(item.kind).short}</span></span>
      <span>${esc(item.name)}${item.optional ? ' <span class="item-kind">OPT</span>' : ''}</span>
      ${showKind ? `<span class="item-kind">${MV.itemKindById(item.kind).code}</span>` : ''}
    </button>`;
  }

  function linkRow(link, roomId) {
    const otherId = link.a === roomId ? link.b : link.a;
    const other = MV.findRoom(app.project, otherId);
    const gate = MV.gateById(link.gate);
    const open = app.analysis.openLinks[link.id] !== undefined;
    return `<button class="item-row" data-select-link="${esc(link.id)}">
      <span class="item-glyph">${gate.code}</span>
      <span>${esc(other ? other.name : otherId)} <span class="item-kind">${link.dir === 'both' ? '↔' : '→'}</span></span>
      <span class="item-kind">${open ? 'OPEN' : 'LOCKED'}</span>
    </button>`;
  }

  function inspectorLink(id) {
    const link = MV.findLink(app.project, id);
    if (!link) return inspectorProject();
    const a = MV.findRoom(app.project, link.a);
    const b = MV.findRoom(app.project, link.b);
    const gate = MV.gateById(link.gate);
    const open = app.analysis.openLinks[link.id] !== undefined;
    const missingAbilities = (link.requires || []).filter(req => !app.project.abilities.some(ability => ability.id === req));
    const pills = [
      { text: gate.code + ' / ' + gate.name },
      { text: link.dir === 'both' ? '双向' : (link.dir === 'a2b' ? 'A → B' : 'B → A') },
      { text: open ? 'OPEN' : 'LOCKED', solid: true }
    ];
    const dirSymbol = link.dir === 'both' ? '↔' : (link.dir === 'a2b' ? '→' : '←');
    return `${inspectorHead('LINK / 连接', (a ? a.name : '?') + ' ' + dirSymbol + ' ' + (b ? b.name : '?'), pills)}
      <div class="form-grid">
        <label class="field"><span>门锁类型</span><select data-field="gate">${MV.GATE_TYPES.map(g => `<option value="${g.id}" ${g.id === link.gate ? 'selected' : ''}>${g.code} · ${g.name}</option>`).join('')}</select></label>
        <div class="field-row">
          <label class="field" style="flex:1"><span>方向</span><select data-field="dir">
            <option value="both" ${link.dir === 'both' ? 'selected' : ''}>双向通行</option>
            <option value="a2b" ${link.dir === 'a2b' ? 'selected' : ''}>A → B 单向</option>
            <option value="b2a" ${link.dir === 'b2a' ? 'selected' : ''}>B → A 单向</option>
          </select></label>
          ${numberField('钥匙数', 'keyReq', link.keyReq, 1, 0)}
        </div>
        <p class="hint-line">${esc(gate.desc)} 修改门锁类型会重置下方能力需求；之后可继续自定义勾选。</p>
        <div class="section-label">能力需求</div>
        ${app.project.abilities.length ? `<div class="check-grid">${app.project.abilities.map(ability => `<label class="check-field"><input type="checkbox" data-field="requires" data-ability="${esc(ability.id)}" ${link.requires.includes(ability.id) ? 'checked' : ''}><span>${esc(ability.name)}</span></label>`).join('')}</div>` : '<p class="hint-line">项目能力表为空，请先在项目检查器中添加能力。</p>'}
        ${missingAbilities.length ? `<div class="req-list">${missingAbilities.map(id => `<span class="req-chip missing">缺失: ${esc(id)}</span>`).join('')}</div>` : ''}
        <div class="section-label">状态</div>
        <div class="req-list">
          ${link.requires.length ? link.requires.map(req => `<span class="req-chip ${app.analysis.abilities.includes(req) ? '' : 'missing'}">${esc(MV.abilityName(app.project, req))}</span>`).join('') : '<span class="req-chip">无能力门槛</span>'}
          ${link.keyReq ? `<span class="req-chip ${app.analysis.keys >= link.keyReq ? '' : 'missing'}">钥匙 ${app.analysis.keys} / ${link.keyReq}</span>` : ''}
        </div>
        <label class="field" style="margin-top:10px"><span>备注</span><textarea data-field="note" rows="2">${esc(link.note)}</textarea></label>
      </div>
      <div class="btn-row">
        <button class="btn" data-action="swap-link">反向 A/B</button>
        <button class="btn" data-action="focus">定位连接</button>
        <button class="btn btn-danger" data-action="delete-link">删除连接</button>
      </div>`;
  }

  function inspectorItem(id) {
    const item = MV.findItem(app.project, id);
    if (!item) return inspectorProject();
    const room = MV.findRoom(app.project, item.room);
    const kind = MV.itemKindById(item.kind);
    const reachable = app.analysis.reachable.includes(item.room);
    const grantName = item.grants ? MV.abilityName(app.project, item.grants) : '无';
    return `${inspectorHead('ITEM / 物品', item.name, [
      { text: kind.code },
      { text: room ? room.name : item.room },
      { text: reachable ? 'REACHABLE' : 'UNREACHABLE', solid: !reachable }
    ])}
      <div class="form-grid">
        <label class="field"><span>名称</span><input data-field="name" value="${esc(item.name)}"></label>
        <div class="form-grid two">
          <label class="field"><span>类别</span><select data-field="kind">${MV.ITEM_KINDS.map(k => `<option value="${k.id}" ${k.id === item.kind ? 'selected' : ''}>${k.name}</option>`).join('')}</select></label>
          <label class="field"><span>所在房间</span><select data-field="room">${app.project.rooms.map(r => `<option value="${esc(r.id)}" ${r.id === item.room ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>授予能力</span><select data-field="grants">
          <option value="">不授予</option>
          ${app.project.abilities.map(a => `<option value="${esc(a.id)}" ${a.id === item.grants ? 'selected' : ''}>${esc(a.name)} · ${esc(a.id)}</option>`).join('')}
        </select></label>
        ${item.kind === 'key' ? `<div class="form-grid two">${numberField('钥匙数量', 'keyCount', item.keyCount, 1, 1)}<div></div></div>` : ''}
        <label class="check-field"><input type="checkbox" data-field="optional" ${item.optional ? 'checked' : ''}><span>可选内容（不参与主线判定）</span></label>
        <label class="field"><span>备注</span><textarea data-field="note" rows="2">${esc(item.note)}</textarea></label>
      </div>
      <p class="hint-line">授予能力：拾取后立即加入能力集合。用于能力道具、Boss 旗标或唯一钥匙。钥匙数量：会计入全局钥匙预算。</p>
      <div class="btn-row">
        <button class="btn" data-action="focus">定位物品</button>
        <button class="btn btn-danger" data-action="delete-item">删除物品</button>
      </div>`;
  }

  function inspectorRegion(id) {
    const region = app.project.regions.find(r => r.id === id);
    if (!region) return inspectorProject();
    const rooms = app.project.rooms.filter(room => room.region === id);
    const items = app.project.items.filter(item => rooms.some(room => room.id === item.room));
    return `${inspectorHead('REGION / 区域', region.name, [
      { text: region.code },
      { text: rooms.length + ' ROOMS' },
      { text: items.length + ' ITEMS' }
    ])}
      <div class="form-grid">
        <label class="field"><span>名称</span><input data-field="name" value="${esc(region.name)}"></label>
        <div class="form-grid two">
          <label class="field"><span>代号</span><input data-field="code" value="${esc(region.code)}" maxlength="6"></label>
          <label class="field"><span>灰度色调</span><select data-field="tone">${MV.REGION_TONES.map(t => `<option value="${t.id}" ${t.id === region.tone ? 'selected' : ''}>TONE ${t.id} / ${t.color}</option>`).join('')}</select></label>
        </div>
        <div class="form-grid two">
          <label class="field"><span>区域颜色</span><input type="color" data-field="color" value="${esc(region.color)}"></label>
          <div class="field"><span>颜色用途</span><div class="color-note">彩色模式下用于房间顶边、3D 体块、标签与连线。</div></div>
        </div>
        ${numberField('3D 基座高度', 'elev', region.elev, 10)}
      </div>
      <p class="hint-line">区域用于给房间分组、着色和统计。新增房间会放入当前选中的区域。基座高度只影响 3D 视图，可把不同区域叠成不同楼层。</p>
      <div class="btn-row">
        <button class="btn" data-action="set-current-region">设为当前区域</button>
        <button class="btn" data-action="solo-region">仅显示此区域</button>
        <button class="btn" data-action="focus-region">聚焦区域</button>
        <button class="btn btn-danger" data-action="delete-region" ${rooms.length ? 'disabled title="先清空该区域的房间"' : ''}>删除区域</button>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" data-action="show-all-regions">显示全部区域</button>
      </div>`;
  }

  function inspectorProject() {
    const counts = MV.projectCounts(app.project);
    const errors = app.analysis.warnings.filter(w => w.level === 'error').length;
    return `${inspectorHead('PROJECT / 项目', app.project.meta.title || '未命名路线', [
      { text: (app.project.meta.preset || 'custom').toUpperCase() },
      { text: counts.rooms + ' ROOMS' },
      { text: errors ? errors + ' ERRORS' : 'STRUCTURE OK', solid: true }
    ])}
      <div class="stat-grid">
        <div class="stat-cell"><div class="s-label">REACHABLE</div><div class="s-value">${app.analysis.stats.reachableRooms}<span style="font-size:11px;color:var(--ink-4)"> / ${counts.rooms}</span></div><div class="s-sub">从起点可达的房间</div></div>
        <div class="stat-cell"><div class="s-label">KEYS</div><div class="s-value">${app.analysis.keys}<span style="font-size:11px;color:var(--ink-4)"> / ${app.analysis.keysTotal}</span></div><div class="s-sub">已收集 / 全图钥匙</div></div>
        <div class="stat-cell"><div class="s-label">GATES</div><div class="s-value">${app.analysis.openCount}<span style="font-size:11px;color:var(--ink-4)"> / ${counts.links}</span></div><div class="s-sub">可通行 / 全部门锁</div></div>
        <div class="stat-cell"><div class="s-label">ITEMS</div><div class="s-value">${counts.items}</div><div class="s-sub">${counts.optional} 个可选 / ${counts.bosses} 个 Boss</div></div>
      </div>
      <div class="form-grid">
        <label class="field"><span>项目标题</span><input data-field="title" value="${esc(app.project.meta.title || '未命名路线')}"></label>
        <div class="form-grid two">
          <label class="field"><span>起点房间</span><select data-field="startRoom">${app.project.rooms.map(r => `<option value="${esc(r.id)}" ${r.id === app.project.startRoom ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
          <label class="field"><span>终点房间</span><select data-field="goalRoom">${app.project.rooms.map(r => `<option value="${esc(r.id)}" ${r.id === app.project.goalRoom ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>项目备注</span><textarea data-field="notes" rows="3">${esc(app.project.meta.notes)}</textarea></label>
      </div>
      <div class="section-label">起始能力</div>
      <div class="check-grid">
        ${app.project.abilities.map(a => `<label class="check-field"><input type="checkbox" data-field="startAbility" data-ability="${esc(a.id)}" ${app.project.startAbilities.includes(a.id) ? 'checked' : ''}><span>${esc(a.name)}</span></label>`).join('')}
      </div>
      <div class="section-label">能力表</div>
      <div class="ability-list">
        ${app.project.abilities.map(a => `<div class="ability-row">
          <div><div class="a-name">${esc(a.name)}</div><div class="a-id">${esc(a.id)}</div></div>
          <button class="ability-del" data-action="delete-ability" data-ability="${esc(a.id)}" title="删除能力">×</button>
        </div>`).join('')}
      </div>
      <div class="inline-form">
        <input id="newAbilityName" placeholder="新能力名称，例如：二段跳" maxlength="24">
        <button data-action="add-ability" title="添加能力">+</button>
      </div>
      <p class="hint-line">能力表是门锁与道具的共享词汇。被引用的能力不能删除。</p>
      <div class="btn-row">
        <button class="btn" data-action="fit-all">适应全部</button>
        <button class="btn" data-action="spread-layout">舒展布局</button>
        <button class="btn" data-action="focus-goal">定位终点</button>
        <button class="btn" data-action="open-presets">载入预设</button>
      </div>
      <div class="section-label">参考</div>
      <div class="hint-line">${esc(app.project.meta.preset || 'custom')} · ${counts.regions} 区域 · ${counts.rooms} 房间 · ${counts.links} 连接</div>`;
  }

  function numberField(label, field, value, step, min) {
    return `<label class="field"><span>${label}</span><input type="number" data-field="${field}" value="${Number(value) || 0}" step="${step || 1}" ${min != null ? `min="${min}"` : ''}></label>`;
  }

  /* ============================================================
     right panel events
     ============================================================ */
  function onRightInput(e) {
    const target = e.target;
    if (!target.matches('[data-field]')) return;
    const field = target.dataset.field;
    if (['select', 'startAbility', 'requires', 'optional', 'gate', 'kind', 'region', 'type', 'room', 'tone', 'dir', 'startRoom', 'goalRoom'].includes(field)) return;
    beforeEdit();
    if (!applyField(field, target.value, target)) return;
    markDirty();
    app.analysis = MV.analyze(app.project);
    updateHeader();
    updateStatus();
    renderRegionList();
    scheduleRender();
    if (app.rightTab === 'progress') renderProgress();
    persistUI();
  }

  function onRightChange(e) {
    const target = e.target;
    const progressLayer = target.dataset.progressLayer;
    if (progressLayer) {
      app.layers[progressLayer] = target.checked;
      els.layerList.querySelectorAll('[data-layer="' + progressLayer + '"]').forEach(input => { input.checked = target.checked; });
      syncViews();
      scheduleRender();
      persistUI();
      return;
    }
    if (!target.matches('[data-field]')) return;
    const field = target.dataset.field;
    beforeEdit();
    if (!applyField(field, target.type === 'checkbox' ? target.checked : target.value, target)) return;
    markDirty();
    app.analysis = MV.analyze(app.project);
    refreshAll();
    persistUI();
  }

  function applyField(field, value, target) {
    const sel = app.selection;
    if (!sel) {
      if (field === 'title') { app.project.meta.title = value || '未命名路线'; return true; }
      if (field === 'startRoom') { app.project.startRoom = value; return true; }
      if (field === 'goalRoom') { app.project.goalRoom = value; return true; }
      if (field === 'notes') { app.project.meta.notes = value; return true; }
      if (field === 'startAbility') {
        const id = target.dataset.ability;
        const set = new Set(app.project.startAbilities);
        if (value) set.add(id); else set.delete(id);
        app.project.startAbilities = Array.from(set);
        return true;
      }
      return false;
    }
    if (sel.type === 'room') {
      const room = MV.findRoom(app.project, sel.id);
      if (!room) return false;
      if (field === 'name') { room.name = value || '未命名房间'; return true; }
      if (field === 'region') { room.region = value; app.currentRegion = value; return true; }
      if (field === 'type') { room.type = value; return true; }
      if (field === 'note') { room.note = value; return true; }
      if (['x', 'y', 'w', 'h', 'height', 'elev', 'depth'].includes(field)) {
        const num = Number(value);
        if (!Number.isFinite(num)) return false;
        if (field === 'w') room.w = Math.max(MV.ROOM_MIN_W, num);
        else if (field === 'h') room.h = Math.max(MV.ROOM_MIN_H, num);
        else if (field === 'height') room.height = MV.clamp(num, 8, 400);
        else if (field === 'depth') room.depth = Math.max(10, num);
        else if (field === 'elev') room.elev = MV.clamp(num, -300, 300);
        else room[field] = num;
        return true;
      }
      return false;
    }
    if (sel.type === 'link') {
      const link = MV.findLink(app.project, sel.id);
      if (!link) return false;
      if (field === 'gate') {
        const gate = MV.gateById(value);
        link.gate = gate.id;
        link.requires = gate.requires.slice();
        link.keyReq = gate.keyReq;
        return true;
      }
      if (field === 'dir') { link.dir = value; return true; }
      if (field === 'note') { link.note = value; return true; }
      if (field === 'keyReq') { link.keyReq = Math.max(0, Number(value) || 0); return true; }
      if (field === 'requires') {
        const id = target.dataset.ability;
        const set = new Set(link.requires);
        if (value) set.add(id); else set.delete(id);
        link.requires = Array.from(set);
        return true;
      }
      return false;
    }
    if (sel.type === 'item') {
      const item = MV.findItem(app.project, sel.id);
      if (!item) return false;
      if (field === 'name') { item.name = value || '未命名物品'; return true; }
      if (field === 'kind') {
        item.kind = value;
        if (value === 'upgrade') item.optional = true;
        if (value !== 'key') item.keyCount = 1;
        return true;
      }
      if (field === 'room') { item.room = value; return true; }
      if (field === 'grants') { item.grants = value || ''; return true; }
      if (field === 'keyCount') { item.keyCount = Math.max(1, Number(value) || 1); return true; }
      if (field === 'optional') { item.optional = !!value; return true; }
      if (field === 'note') { item.note = value; return true; }
      return false;
    }
    if (sel.type === 'region') {
      const region = app.project.regions.find(r => r.id === sel.id);
      if (!region) return false;
      if (field === 'name') { region.name = value || '未命名区域'; return true; }
      if (field === 'code') { region.code = String(value || 'ZONE').toUpperCase().slice(0, 6); return true; }
      if (field === 'tone') { region.tone = MV.clamp(Number(value) || 0, 0, MV.REGION_TONES.length - 1); return true; }
      if (field === 'color') { region.color = MV.normalizeHexColor(value, region.color); return true; }
      if (field === 'elev') { region.elev = MV.clamp(Number(value) || 0, -500, 500); return true; }
      return false;
    }
    return false;
  }

  function onRightClick(e) {
    const selectRoomBtn = e.target.closest('[data-select-room]');
    if (selectRoomBtn) { select('room', selectRoomBtn.dataset.selectRoom); return; }
    const selectLinkBtn = e.target.closest('[data-select-link]');
    if (selectLinkBtn) { select('link', selectLinkBtn.dataset.selectLink); return; }
    const selectItemBtn = e.target.closest('[data-select-item]');
    if (selectItemBtn) { select('item', selectItemBtn.dataset.selectItem); return; }
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.dataset.action;
    if (action === 'delete-room') deleteSelection();
    else if (action === 'delete-link') deleteSelection();
    else if (action === 'delete-item') deleteSelection();
    else if (action === 'delete-region') deleteSelection();
    else if (action === 'duplicate-room') duplicateRoom();
    else if (action === 'add-item') addItemToRoom(actionBtn.dataset.room || (app.selection && app.selection.id));
    else if (action === 'focus') focusSelection();
    else if (action === 'focus-goal') { if (app.project.goalRoom) { select('room', app.project.goalRoom, true); focusRoom(app.project.goalRoom); } }
    else if (action === 'fit-all') fitAll();
    else if (action === 'spread-layout') spreadLayout();
    else if (action === 'swap-link') swapLink();
    else if (action === 'set-current-region') { app.currentRegion = app.selection.id; renderRegionList(); persistUI(); toast('当前区域已切换'); }
    else if (action === 'solo-region') { if (app.selection && app.selection.type === 'region') soloRegion(app.selection.id); }
    else if (action === 'show-all-regions') showAllRegions();
    else if (action === 'focus-region') focusRegion(app.selection.id);
    else if (action === 'delete-ability') deleteAbility(actionBtn.dataset.ability);
    else if (action === 'add-ability') addAbility();
    else if (action === 'open-presets') openPresetModal();
  }

  /* ============================================================
     progress
     ============================================================ */
  function renderProgress() {
    els.rightBody.classList.remove('is-guide');
    const a = app.analysis;
    if (!a) return;
    const errors = a.warnings.filter(w => w.level === 'error');
    const warns = a.warnings.filter(w => w.level === 'warn');
    const infos = a.warnings.filter(w => w.level === 'info');
    const ordered = errors.concat(warns, infos);
    const roomById = {};
    app.project.rooms.forEach(room => { roomById[room.id] = room; });
    const linkById = {};
    app.project.links.forEach(link => { linkById[link.id] = link; });

    const steps = Object.keys(a.timelineGroups).map(Number).sort((x, y) => x - y);
    const timelineHTML = steps.length ? steps.map(step => {
      const entries = a.timelineGroups[step];
      const unlocks = (a.unlockSteps[step] || []).map(linkId => {
        const link = linkById[linkId];
        if (!link) return '';
        const gate = MV.gateById(link.gate);
        return `<span class="tl-unlock" title="${esc(gate.name)}">${gate.code}</span>`;
      }).join('');
      const isGoal = a.goalReachedStep === step;
      return `<div class="tl-step ${isGoal ? 'is-goal' : ''}">
        <div class="tl-step-label">STEP ${String(step).padStart(2, '0')}${isGoal ? ' / GOAL' : ''}</div>
        ${entries.map(entry => {
          const room = roomById[entry.roomId];
          return `<button class="tl-item" data-select-room="${esc(entry.roomId)}" title="定位 ${esc(room ? room.name : entry.roomId)}">
            <span>${esc(entry.name)}</span>
            <span class="tl-room">${esc(room ? room.name : entry.roomId)}</span>
            ${entry.optional ? '<span class="tl-unlock">OPT</span>' : ''}
          </button>`;
        }).join('')}
        ${unlocks ? `<div class="tl-unlocks">${unlocks}</div>` : ''}
      </div>`;
    }).join('') : '<div class="hint-line">还没有可收集的道具。放置能力道具、钥匙或 Boss 后会生成时间轴。</div>';

    const regionHTML = a.regionStats.map(region => {
      const pct = region.totalRooms ? Math.round(region.reachableRooms / region.totalRooms * 100) : 0;
      return `<div class="region-cov-row">
        <span class="region-swatch" style="background:${MV.regionTone(region.tone).color};height:12px"></span>
        <span>${esc(region.name)}</span>
        <span class="rc-count">${region.reachableRooms}/${region.totalRooms}</span>
        <span class="rc-bar"><i style="width:${pct}%"></i></span>
      </div>`;
    }).join('');

    const gateHTML = a.gateStats.length ? `<table class="gate-table">
      <thead><tr><th>门锁</th><th>可通行 / 总数</th></tr></thead>
      <tbody>${a.gateStats.map(gate => `<tr class="${gate.open === gate.total ? '' : 'is-locked'}"><td>${gate.code} · ${esc(gate.name)}</td><td>${gate.open} / ${gate.total}</td></tr>`).join('')}</tbody>
    </table>` : '<div class="hint-line">还没有连接。</div>';

    const pathHTML = a.path.length ? a.path.map((roomId, i) => {
      const room = roomById[roomId];
      return `<button class="path-row" data-select-room="${esc(roomId)}"><span class="pi">${String(i + 1).padStart(2, '0')}</span><span>${esc(room ? room.name : roomId)}</span></button>`;
    }).join('') : '<div class="hint-line">终点不可达或尚未设置终点。</div>';

    const warningsHTML = ordered.length ? ordered.map(w => `<div class="warn-card is-${w.level}">
      <div class="w-head">${w.level === 'error' ? 'ERROR' : (w.level === 'warn' ? 'WARNING' : 'INFO')} / ${esc(w.title)}</div>
      <div>${esc(w.text)}</div>
    </div>`).join('') : '<div class="warn-card is-info"><div class="w-head">INFO / 结构检查</div><div>未发现结构性问题。</div></div>';

    els.rightBody.innerHTML = `
      <div class="progress-status ${a.goalReached ? 'is-ok' : 'is-bad'}">
        <div class="ps-label">ROUTE STATUS</div>
        <div class="ps-value">${a.goalReached ? '路线闭合' : '路线未闭合'}</div>
        <div class="ps-sub">${a.goalReached ? '终点可达 · 主线 ' + a.path.length + ' 个房间 · ' + (a.goalReachedStep + 1) + ' 个阶段' : '从起点无法抵达终点，见下方警告。'}</div>
      </div>
      <div class="stat-grid">
        <div class="stat-cell"><div class="s-label">REACHABLE ROOMS</div><div class="s-value">${a.stats.reachableRooms}<span style="font-size:11px;color:var(--ink-4)"> / ${a.stats.rooms}</span></div><div class="bar"><i style="width:${a.stats.rooms ? a.stats.reachableRooms / a.stats.rooms * 100 : 0}%"></i></div></div>
        <div class="stat-cell"><div class="s-label">OPEN GATES</div><div class="s-value">${a.openCount}<span style="font-size:11px;color:var(--ink-4)"> / ${a.totalLinks}</span></div><div class="bar"><i style="width:${a.totalLinks ? a.openCount / a.totalLinks * 100 : 0}%"></i></div></div>
        <div class="stat-cell"><div class="s-label">KEYS</div><div class="s-value">${a.keys}<span style="font-size:11px;color:var(--ink-4)"> / ${a.keysTotal}</span></div><div class="bar"><i style="width:${a.keysTotal ? a.keys / a.keysTotal * 100 : 0}%"></i></div></div>
        <div class="stat-cell"><div class="s-label">ACQUIRED</div><div class="s-value">${a.stats.collectedItems}<span style="font-size:11px;color:var(--ink-4)"> / ${a.stats.items}</span></div><div class="bar"><i style="width:${a.stats.items ? a.stats.collectedItems / a.stats.items * 100 : 0}%"></i></div></div>
      </div>
      <div class="section-label">警告</div>
      <div class="warn-list">${warningsHTML}</div>
      <div class="section-label">进度时间轴</div>
      <div class="timeline">${timelineHTML}</div>
      <div class="section-label">区域覆盖</div>
      <div class="region-coverage">${regionHTML || '<div class="hint-line">没有区域。</div>'}</div>
      <div class="section-label">门锁统计</div>
      ${gateHTML}
      <div class="section-label">主线路径</div>
      <div class="path-list">${pathHTML}</div>
      <div class="section-label">显示</div>
      <div class="toggle-line"><span>主线高亮</span><label class="check-field"><input type="checkbox" data-progress-layer="path" ${app.layers.path ? 'checked' : ''}><span>显示</span></label></div>
      <div class="toggle-line"><span>阶段着色</span><label class="check-field"><input type="checkbox" data-progress-layer="phases" ${app.layers.phases ? 'checked' : ''}><span>显示</span></label></div>
      <div class="toggle-line"><span>房间名称</span><label class="check-field"><input type="checkbox" data-progress-layer="names" ${app.layers.names ? 'checked' : ''}><span>显示</span></label></div>
      <div class="btn-row"><button class="btn btn-ghost btn-wide" data-action="focus-goal">定位终点房间</button></div>
    `;
  }

  /* ============================================================
     guide
     ============================================================ */
  function renderGuide() {
    els.rightBody.classList.add('is-guide');
    const sources = (app.project.meta.sources && app.project.meta.sources.length)
      ? app.project.meta.sources
      : [
        ['Metroid Recon — Prime upgrades', 'https://www.metroid.retropixel.net/games/mprime/items1.php'],
        ['StrategyWiki — Metroid Prime Locations', 'https://strategywiki.org/wiki/Metroid_Prime/Locations'],
        ['Metroid Wiki — X-Ray Visor', 'https://www.metroidwiki.org/wiki/X-Ray_Visor'],
        ['Hollow Knight Wiki', 'https://hollowknight.wiki/']
      ];
    const gateRows = MV.GATE_TYPES.filter(g => g.id !== 'open').map(g => {
      const mp1Names = {
        missile: '导弹', iceBeam: '冰冻光束', waveBeam: '波导光束', plasmaBeam: '等离子光束',
        morphBall: '变形球', bomb: '变形球炸弹', boostBall: '加速球', spiderBall: '蜘蛛球',
        grappleBeam: '抓钩光束', powerBomb: '强力炸弹', scanVisor: '扫描视镜',
        thermalVisor: '热能视镜', xRayVisor: 'X 光视镜', variaSuit: '瓦利亚服',
        gravitySuit: '重力服', phazonSuit: 'Phazon 服'
      };
      const reqName = id => {
        const found = MV.abilityName(app.project, id);
        return found === id ? (mp1Names[id] || id) : found;
      };
      const reqs = g.requires.length
        ? g.requires.map(reqName).join(' + ')
        : (g.keyReq ? g.keyReq + ' 把钥匙' : '无 / 自定义');
      return `<tr><td>${g.code} · ${g.name}</td><td>${esc(reqs)}</td><td>${esc(g.desc)}</td></tr>`;
    }).join('');

    els.rightBody.innerHTML = `<div class="guide">
      <h1>设计指南</h1>
      <div class="guide-kicker">METROIDVANIA / LEVEL ROUTE NOTES / MP-01</div>

      <section>
        <h2>00 / 先定义“锁”</h2>
        <p>银河城路线的本质不是房间数量，而是<strong>锁与钥匙的因果链</strong>。每一道门都应该问三个问题：它要求什么能力？这个能力在哪里获得？获得它需要先通过哪些门？本工具的可达性分析会自动重复这个推理，直到路线闭合或卡死。</p>
        <div class="guide-quote">好的银河城地图让玩家在“我记得那里还有一扇打不开的门”和“我现在能打开它了”之间来回移动。</div>
      </section>

      <section>
        <h2>01 / 密特罗德 Prime 的结构解剖</h2>
        <div class="guide-card"><h3>区域环与中枢</h3><p>Tallon Overworld 是玩家据点与飞船所在；Magmoor Caverns 是全图地铁，连接除 Impact Crater 外的所有区域，且没有 Boss；Chozo Ruins 在东北，Phendrana Drifts 只能经 Magmoor 抵达，Phazon Mines 是南部的三层终局工业区，Impact Crater 由 12 枚鸟人神器封印。这个“中枢 + 放射状区域 + 终局隔离区”结构，正是预设 01 的骨架。</p></div>
        <div class="guide-card"><h3>门锁矩阵</h3><p>MP1 把能力直接编码进门：蓝门 / 导弹门 / 冰冻门 / 波导门 / 等离子门，加上变形球通道、炸弹槽、加速球半管、蜘蛛球轨道与抓钩点。检查器中的门锁预设就是这套矩阵；任何连接都可以继续叠加自定义能力需求。</p></div>
        <div class="guide-card"><h3>空间锁，而不只是门锁</h3><p>变形球把“房间几何”变成钥匙：通风管、半管、磁轨、炸弹槽都是同一套能力的空间表达。做 3D 时尤其重要——同一个门锁在 3D 房间里可能是一条竖井、一段轨道或一个需要冲刺的斜坡。</p></div>
        <div class="guide-card"><h3>视镜与环境软门槛</h3><p>热能视镜、X 光视镜、瓦利亚服、重力服、Phazon 服分别把“看不见”“过不去”“待不住”变成门槛。它们比硬门更柔和，也更容易制造回溯时的“原来这里可以过去”。预设中保留了萨杜斯需要热能视镜、最终战需要 X 光视镜、沉船需要重力服等关键节点。</p></div>
        <div class="guide-card"><h3>神器预算</h3><p>12 枚神器是全局钥匙预算，而不是单点钥匙。它们把终局从“再打一个 Boss”变成“重新理解整张地图”。进度面板会实时显示钥匙收集数与封印需求，预算不足会直接报错。</p></div>
        <div class="guide-card"><h3>序章的单向门</h3><p>Orpheon 作为可玩序章，在逃生后不再回头。预设用一条单向连接表达它。单向边是路线设计工具必须支持的结构：它能让“初始区域”和“可回溯区域”在逻辑上分离。</p></div>
      </section>

      <section>
        <h2>02 / 这个工具如何辅助 3D 银河城</h2>
        <ul>
          <li><strong>2D 路线</strong>回答“玩家按什么顺序获得什么”，适合做锁链、钥匙预算和可选内容密度。</li>
          <li><strong>3D 地图</strong>回答“这些房间长什么样、如何垂直连接”，参考 MP1 地图的体块化读法：房间是块，连接是线，区域是底板。</li>
          <li><strong>阶段着色</strong>把可达性分析的结果投射回地图，让你一眼看到前中后期的空间分布。</li>
          <li><strong>语义配色</strong>：区域色、阶段色、门锁色和道具色分别承载不同信息，可在配色面板中自定义。</li>
          <li><strong>区域过滤</strong>：可只显示一个或多个区域；过滤只影响地图显示，分析与路线判定仍基于完整项目。</li>
          <li><strong>主线高亮</strong>用最短路径给出终局路线骨架；它不替代完整流程，但能快速暴露“主路过长 / 主路过短 / 终局区域太早暴露”等问题。</li>
          <li><strong>门锁统计</strong>检查门锁类型是否过于单一。全图都是导弹门，会让能力节奏变得扁平。</li>
        </ul>
      </section>

      <section>
        <h2>03 / 设计检查表</h2>
        <ul>
          <li>起点区域是否有一间“安全屋”，让玩家理解操作与地图语言？</li>
          <li>前 15 分钟是否至少获得一个改变移动方式的能力？</li>
          <li>每个区域是否有一个可记忆的地标房间 / 视觉母题？</li>
          <li>是否存在至少一条“早期看见、后期回来”的捷径或伏笔？</li>
          <li>Boss 前是否有存档 / 补给 / 安全屋？</li>
          <li>终局钥匙是否分布在不同区域，迫使玩家回顾整张地图？</li>
          <li>主线最短路径是否避免了“所有房间都必须去”的线性化？</li>
          <li>可选强化是否奖励探索，但不成为通关必需？</li>
          <li>单向门是否被用于制造“回不去”的紧张感，而不是制造软锁？</li>
        </ul>
      </section>

      <section>
        <h2>04 / 门锁速查</h2>
        <table class="matrix">
          <thead><tr><th>类型</th><th>需求</th><th>说明</th></tr></thead>
          <tbody>${gateRows}</tbody>
        </table>
      </section>

      <section>
        <h2>05 / 参考与说明</h2>
        <p>预设是基于公开地图、攻略与 Wiki 整理的<strong>结构化参考</strong>，用于演示锁链与区域关系，不是官方地图的一比一复刻。房间坐标、部分道具位置与门锁方向为设计演示做了简化。</p>
        <div class="guide-sources">
          ${sources.map(src => `<a href="${esc(src[1])}" target="_blank" rel="noreferrer">${esc(src[0])} ↗</a>`).join('')}
        </div>
      </section>
    </div>`;
  }

  /* ============================================================
     selection / editing operations
     ============================================================ */
  function select(type, id, keepTab) {
    app.selection = id ? { type, id } : null;
    if (!keepTab) app.rightTab = 'inspect';
    if (type === 'room') {
      const room = MV.findRoom(app.project, id);
      if (room) app.currentRegion = room.region;
    }
    if (type === 'item') {
      const item = MV.findItem(app.project, id);
      if (item) {
        const room = MV.findRoom(app.project, item.room);
        if (room) app.currentRegion = room.region;
      }
    }
    if (type === 'region') {
      app.currentRegion = id;
    }
    renderRightPanel();
    renderRegionList();
    syncViews();
    scheduleRender();
    hideTooltip();
    persistUI();
  }

  function selectRegion(id) {
    app.currentRegion = id;
    select('region', id);
  }

  function clearSelection() {
    app.selection = null;
    renderRightPanel();
    renderRegionList();
    scheduleRender();
    persistUI();
  }

  function beforeEdit() {
    if (!app.editGroup) {
      app.history.push(app.project);
      app.editGroup = true;
      updateHistoryButtons();
    }
    clearTimeout(app.editTimer);
    app.editTimer = setTimeout(() => { app.editGroup = false; }, 700);
  }

  function snapshot() {
    app.history.push(app.project);
    app.editGroup = false;
    clearTimeout(app.editTimer);
    updateHistoryButtons();
    markDirty();
  }

  function markDirty() {
    app.dirty = true;
    updateSaveState();
    autosave();
  }

  function commitAfterDrag() {
    app.analysis = MV.analyze(app.project);
    markDirty();
    updateStatus();
    renderRightPanel();
    renderRegionList();
    scheduleRender();
    persistUI();
  }

  function undo() {
    if (!app.history.canUndo) return;
    const restored = app.history.undo(app.project);
    if (!restored) return;
    app.project = MV.normalizeProject(restored);
    app.editGroup = false;
    validateSelection();
    app.analysis = MV.analyze(app.project);
    markDirty();
    refreshAll();
    toast('已撤销');
  }

  function redo() {
    if (!app.history.canRedo) return;
    const restored = app.history.redo(app.project);
    if (!restored) return;
    app.project = MV.normalizeProject(restored);
    app.editGroup = false;
    validateSelection();
    app.analysis = MV.analyze(app.project);
    markDirty();
    refreshAll();
    toast('已重做');
  }

  function validateSelection() {
    if (!app.selection) return;
    const sel = app.selection;
    const exists = sel.type === 'room' ? !!MV.findRoom(app.project, sel.id)
      : sel.type === 'link' ? !!MV.findLink(app.project, sel.id)
        : sel.type === 'item' ? !!MV.findItem(app.project, sel.id)
          : sel.type === 'region' ? app.project.regions.some(r => r.id === sel.id)
            : true;
    if (!exists) app.selection = null;
    if (!app.project.regions.some(r => r.id === app.currentRegion)) {
      app.currentRegion = app.project.regions[0].id;
    }
  }

  function deleteSelection() {
    const sel = app.selection;
    if (!sel) return;
    if (sel.type === 'region') {
      const roomCount = app.project.rooms.filter(room => room.region === sel.id).length;
      if (roomCount) { toast('该区域还有房间，先清空再删除', true); return; }
      if (app.project.regions.length <= 1) { toast('至少保留一个区域', true); return; }
      snapshot();
      app.project.regions = app.project.regions.filter(region => region.id !== sel.id);
      app.hiddenRegions.delete(sel.id);
      app.selection = null;
      app.currentRegion = app.project.regions[0].id;
      app.analysis = MV.analyze(app.project);
      markDirty();
      refreshAll();
      toast('区域已删除');
      return;
    }
    if (sel.type === 'room') {
      snapshot();
      const roomId = sel.id;
      app.project.rooms = app.project.rooms.filter(room => room.id !== roomId);
      app.project.links = app.project.links.filter(link => link.a !== roomId && link.b !== roomId);
      app.project.items = app.project.items.filter(item => item.room !== roomId);
      if (!app.project.rooms.length) {
        app.project = MV.createBlankProject();
        app.currentRegion = app.project.regions[0].id;
      } else {
        if (app.project.startRoom === roomId) app.project.startRoom = app.project.rooms[0].id;
        if (app.project.goalRoom === roomId) app.project.goalRoom = app.project.rooms[app.project.rooms.length - 1].id;
      }
      app.selection = null;
      app.analysis = MV.analyze(app.project);
      validateSelection();
      markDirty();
      refreshAll();
      toast('房间已删除（可撤销）');
      return;
    }
    if (sel.type === 'link') {
      snapshot();
      app.project.links = app.project.links.filter(link => link.id !== sel.id);
      app.selection = null;
      app.analysis = MV.analyze(app.project);
      markDirty();
      refreshAll();
      toast('连接已删除');
      return;
    }
    if (sel.type === 'item') {
      snapshot();
      app.project.items = app.project.items.filter(item => item.id !== sel.id);
      app.selection = null;
      app.analysis = MV.analyze(app.project);
      markDirty();
      refreshAll();
      toast('物品已删除');
    }
  }

  function duplicateRoom() {
    if (!app.selection || app.selection.type !== 'room') return;
    const source = MV.findRoom(app.project, app.selection.id);
    if (!source) return;
    snapshot();
    const room = MV.clone(source);
    room.id = MV.uid('room');
    room.name = source.name + ' 副本';
    room.x = source.x + 28;
    room.y = source.y + 28;
    app.project.rooms.push(room);
    app.selection = { type: 'room', id: room.id };
    app.analysis = MV.analyze(app.project);
    markDirty();
    refreshAll();
    toast('房间已复制（不含物品与连接）');
  }

  function addRegion() {
    snapshot();
    const index = app.project.regions.length;
    const region = {
      id: MV.uid('region'),
      name: '新区域 ' + (index + 1),
      code: 'Z' + String(index + 1).padStart(2, '0'),
      tone: index % MV.REGION_TONES.length,
      color: MV.REGION_COLORS[index % MV.REGION_COLORS.length]
    };
    app.project.regions.push(region);
    app.currentRegion = region.id;
    app.selection = { type: 'region', id: region.id };
    app.analysis = MV.analyze(app.project);
    markDirty();
    refreshAll();
    toast('区域已添加');
  }

  function selectionInRegion(regionId) {
    const sel = app.selection;
    if (!sel) return false;
    if (sel.type === 'region') return sel.id === regionId;
    if (sel.type === 'room') {
      const room = MV.findRoom(app.project, sel.id);
      return !!room && room.region === regionId;
    }
    if (sel.type === 'item') {
      const item = MV.findItem(app.project, sel.id);
      const room = item ? MV.findRoom(app.project, item.room) : null;
      return !!room && room.region === regionId;
    }
    if (sel.type === 'link') {
      const link = MV.findLink(app.project, sel.id);
      if (!link) return false;
      const a = MV.findRoom(app.project, link.a);
      const b = MV.findRoom(app.project, link.b);
      return !!((a && a.region === regionId) || (b && b.region === regionId));
    }
    return false;
  }

  function clearSelectionIfHidden() {
    if (!app.selection) return;
    if (app.selection.type === 'region' && app.hiddenRegions.has(app.selection.id)) {
      app.selection = null;
      renderRightPanel();
      return;
    }
    if (app.selection.type === 'room' || app.selection.type === 'item' || app.selection.type === 'link') {
      for (const id of app.hiddenRegions) {
        if (selectionInRegion(id)) {
          app.selection = null;
          renderRightPanel();
          return;
        }
      }
    }
  }

  function toggleRegionVisibility(regionId, visible) {
    const region = app.project.regions.find(r => r.id === regionId);
    if (!region) return;
    if (visible) app.hiddenRegions.delete(regionId);
    else app.hiddenRegions.add(regionId);
    if (!visible && app.currentRegion === regionId) {
      const firstVisible = app.project.regions.find(r => !app.hiddenRegions.has(r.id));
      if (firstVisible) app.currentRegion = firstVisible.id;
    }
    clearSelectionIfHidden();
    app.hover = null;
    hideTooltip();
    renderRegionList();
    syncViews();
    scheduleRender();
    updateStatus();
    persistUI();
  }

  function showAllRegions() {
    if (!app.hiddenRegions.size) {
      toast('当前已显示全部区域');
      return;
    }
    app.hiddenRegions.clear();
    app.hover = null;
    clearSelectionIfHidden();
    renderRegionList();
    syncViews();
    if (app.mode === '2d') fit2DReadable();
    else fit3D();
    updateStatus();
    persistUI();
    toast('已显示全部区域');
  }

  function soloRegion(regionId) {
    const region = app.project.regions.find(r => r.id === regionId);
    if (!region) return;
    app.hiddenRegions = new Set(
      app.project.regions.filter(r => r.id !== regionId).map(r => r.id)
    );
    app.currentRegion = regionId;
    app.hover = null;
    clearSelectionIfHidden();
    renderRegionList();
    syncViews();
    if (app.mode === '2d') focusRegion(regionId);
    else fit3D();
    updateStatus();
    persistUI();
    toast('仅显示区域：' + region.name);
  }

  function spreadLayout() {
    if (!app.project.rooms.length) return;
    snapshot();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    app.project.rooms.forEach(room => {
      minX = Math.min(minX, room.x);
      minY = Math.min(minY, room.y);
      maxX = Math.max(maxX, room.x + room.w);
      maxY = Math.max(maxY, room.y + room.h);
    });
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    app.project.rooms.forEach(room => {
      const cx = room.x + room.w / 2;
      const cy = room.y + room.h / 2;
      room.x = Math.round((centerX + (cx - centerX) * 1.18 - room.w / 2) / 5) * 5;
      room.y = Math.round((centerY + (cy - centerY) * 1.18 - room.h / 2) / 5) * 5;
    });
    markDirty();
    app.analysis = MV.analyze(app.project);
    refreshAll();
    toast('布局已舒展（可撤销）');
  }

  function addItemToRoom(roomId) {
    const room = MV.findRoom(app.project, roomId);
    if (!room) { toast('请先选择一间房', true); return; }
    snapshot();
    const kind = app.itemKind;
    let name = '新物品';
    let grants = '';
    let optional = false;
    if (kind === 'ability') {
      const granted = new Set(app.project.items.filter(item => item.grants).map(item => item.grants));
      const ability = app.project.abilities.find(a => !granted.has(a.id));
      if (ability) {
        name = ability.name + '道具';
        grants = ability.id;
      } else {
        name = '能力道具 ' + (app.project.items.filter(item => item.kind === 'ability').length + 1);
      }
    } else if (kind === 'key') {
      name = '钥匙 ' + (app.project.items.filter(item => item.kind === 'key').length + 1);
    } else if (kind === 'upgrade') {
      name = '可选强化 ' + (app.project.items.filter(item => item.kind === 'upgrade').length + 1);
      optional = true;
    } else if (kind === 'boss') {
      name = 'Boss ' + (app.project.items.filter(item => item.kind === 'boss').length + 1);
    }
    const item = {
      id: MV.uid('item'),
      name: name,
      kind: kind,
      room: room.id,
      grants: grants,
      keyCount: 1,
      optional: optional,
      note: ''
    };
    app.project.items.push(item);
    app.selection = { type: 'item', id: item.id };
    app.tool = 'select';
    app.analysis = MV.analyze(app.project);
    markDirty();
    updateToolUI();
    refreshAll();
    toast('已添加：' + item.name);
  }

  function swapLink() {
    if (!app.selection || app.selection.type !== 'link') return;
    const link = MV.findLink(app.project, app.selection.id);
    if (!link) return;
    snapshot();
    const a = link.a;
    link.a = link.b;
    link.b = a;
    if (link.dir === 'a2b') link.dir = 'b2a';
    else if (link.dir === 'b2a') link.dir = 'a2b';
    app.analysis = MV.analyze(app.project);
    markDirty();
    refreshAll();
    toast('连接方向已反转');
  }

  function addAbility() {
    const input = document.getElementById('newAbilityName');
    if (!input) return;
    const name = input.value.trim();
    if (!name) { toast('请输入能力名称', true); return; }
    snapshot();
    const id = 'ab_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
    app.project.abilities.push({ id, name });
    app.analysis = MV.analyze(app.project);
    markDirty();
    refreshAll();
    toast('能力已添加：' + name);
  }

  function deleteAbility(id) {
    if (!id) return;
    const usedByItem = app.project.items.some(item => item.grants === id);
    const usedByLink = app.project.links.some(link => (link.requires || []).includes(id));
    const starting = app.project.startAbilities.includes(id);
    if (usedByItem || usedByLink || starting) {
      toast('该能力仍被道具 / 门锁 / 起始能力引用，无法删除', true);
      return;
    }
    snapshot();
    app.project.abilities = app.project.abilities.filter(ability => ability.id !== id);
    app.analysis = MV.analyze(app.project);
    markDirty();
    refreshAll();
    toast('能力已删除');
  }

  /* ============================================================
     tools / modes / camera
     ============================================================ */
  function setTool(tool) {
    app.tool = tool;
    app.connectFrom = null;
    if (tool !== 'select') hideTooltip();
    updateToolUI();
    syncViews();
    scheduleRender();
    persistUI();
  }

  function updateToolUI() {
    document.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.tool === app.tool);
    });
    document.querySelectorAll('#itemKindSeg [data-kind]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.kind === app.itemKind);
    });
    const kindName = MV.itemKindById(app.itemKind).name;
    const hints = {
      select: '选择：单击房间，拖动移动，拖角缩放',
      room: '房间：在空白处拖出房间，自动归入当前区域',
      connect: '连接：依次点击两个房间创建门锁连接',
      item: '物品：点击房间放置「' + kindName + '」',
      pan: '平移：拖动平移画布，滚轮缩放'
    };
    els.toolHint.textContent = hints[app.tool] || hints.select;
    if (app.tool === 'connect') {
      const from = app.connectFrom ? MV.findRoom(app.project, app.connectFrom) : null;
      els.connectHint.hidden = false;
      els.connectHint.textContent = from ? '起点：' + from.name + ' — 点击目标房间（Esc 取消）' : '连接模式：点击第一个房间';
    } else {
      els.connectHint.hidden = true;
    }
    const kindLabel = app.itemKind === 'ability' ? '能力' : app.itemKind === 'key' ? '钥匙' : app.itemKind === 'upgrade' ? '强化' : 'Boss';
    els.itemKindSeg.title = '当前放置：' + kindLabel;
    updateCursor();
  }

  function updateCursor() {
    let cursor = 'default';
    if (app.mode === '2d') {
      if (app.spaceDown) cursor = app.drag ? 'grabbing' : 'grab';
      else if (app.tool === 'room' || app.tool === 'connect') cursor = 'crosshair';
      else if (app.tool === 'item') cursor = 'copy';
      else if (app.tool === 'pan') cursor = 'grab';
    }
    els.canvas2d.style.cursor = cursor;
    els.canvas3d.style.cursor = 'default';
  }

  function applyTheme(theme, persist) {
    app.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = app.theme;
    MV.setCanvasTheme(app.theme);
    if (els.themeBtn) {
      const label = app.theme === 'light' ? '切换到黑夜模式' : '切换到白天模式';
      els.themeBtn.title = label;
      els.themeBtn.setAttribute('aria-label', label);
    }
    if (app.view2d && app.view3d) scheduleRender();
    if (persist) persistUI();
  }

  function switchMode(mode) {
    if (app.mode === mode) return;
    app.mode = mode;
    app.hover = null;
    hideTooltip();
    applyModeUI();
    requestAnimationFrame(() => {
      if (mode === '2d' && !app.fitted2d) fit2DReadable();
      if (mode === '3d' && !app.fitted3d) fit3D();
      scheduleRender();
      updateStatus();
    });
    syncViews();
    scheduleRender();
    updateStatus();
    persistUI();
  }

  function applyModeUI() {
    document.querySelectorAll('.mode-tab').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.mode === app.mode);
    });
    els.stage2d.classList.toggle('is-active', app.mode === '2d');
    els.stage3d.classList.toggle('is-active', app.mode === '3d');
    els.statusMode.textContent = app.mode === '2d' ? '2D ROUTE' : '3D MASSING';
    if (app.mode === '2d') els.toolHint.textContent = '选择：单击房间，拖动移动，拖角缩放';
    updateCursor();
  }

  function switchRightTab(tab) {
    app.rightTab = tab;
    renderRightPanel();
    persistUI();
  }

  function fit2D() {
    const W = els.canvas2d.clientWidth;
    const H = els.canvas2d.clientHeight;
    if (!W || !H) {
      app.fitted2d = false;
      return;
    }
    app.view2d.cam = MV.Render2D.fitCamera(visibleProject(), W, H, W < 700 ? 44 : 100);
    app.fitted2d = true;
    scheduleRender();
    updateStatusZoom();
    persistUI();
  }

  function readableCamera(cam, W) {
    const min = W >= 700 ? 0.42 : 0.3;
    if (cam.zoom < min) cam.zoom = min;
    return cam;
  }

  function fit2DReadable() {
    fit2D();
    app.view2d.cam = readableCamera(app.view2d.cam, canvasW(els.canvas2d));
    scheduleRender();
    updateStatusZoom();
    persistUI();
  }

  function fit3D() {
    const W = els.canvas3d.clientWidth;
    const H = els.canvas3d.clientHeight;
    if (!W || !H) {
      app.fitted3d = false;
      return;
    }
    app.view3d.center2d = MV.Render3D.mapCenter(visibleProject());
    app.view3d.cam = MV.Render3D.fitCamera(visibleProject(), W, H);
    app.fitted3d = true;
    scheduleRender();
    updateStatusZoom();
    persistUI();
  }

  function fitAll() {
    if (app.mode === '2d') {
      fit2D();
      app.fitted3d = false;
    } else {
      fit3D();
      app.fitted2d = false;
    }
    toast('视图已适应全部房间');
  }

  function focusRoom(roomId) {
    const room = MV.findRoom(app.project, roomId);
    if (!room) return;
    if (app.mode === '2d') {
      const W = canvasW(els.canvas2d), H = canvasH(els.canvas2d);
      app.view2d.cam.zoom = MV.clamp(Math.min((W - 260) / Math.max(120, room.w), (H - 240) / Math.max(80, room.h)), 0.35, 2.4);
      app.view2d.cam.x = room.x + room.w / 2;
      app.view2d.cam.y = room.y + room.h / 2;
    } else {
      MV.Render3D.focusRoom(app.project, app.view3d, room.id, canvasW(els.canvas3d), canvasH(els.canvas3d));
    }
    scheduleRender();
    updateStatusZoom();
    persistUI();
  }

  function focusSelection() {
    const sel = app.selection;
    if (!sel) { fitAll(); return; }
    if (sel.type === 'room') { focusRoom(sel.id); return; }
    if (sel.type === 'item') {
      const item = MV.findItem(app.project, sel.id);
      if (item) focusRoom(item.room);
      return;
    }
    if (sel.type === 'link') {
      const link = MV.findLink(app.project, sel.id);
      if (!link) return;
      const a = MV.findRoom(app.project, link.a);
      const b = MV.findRoom(app.project, link.b);
      if (!a || !b) return;
      if (app.mode === '2d') {
        const minX = Math.min(a.x, b.x) - 60, minY = Math.min(a.y, b.y) - 60;
        const maxX = Math.max(a.x + a.w, b.x + b.w) + 60, maxY = Math.max(a.y + a.h, b.y + b.h) + 60;
        const W = canvasW(els.canvas2d), H = canvasH(els.canvas2d);
        app.view2d.cam.zoom = MV.clamp(Math.min(W / (maxX - minX), H / (maxY - minY)), 0.2, 1.8);
        app.view2d.cam.x = (minX + maxX) / 2;
        app.view2d.cam.y = (minY + maxY) / 2;
        scheduleRender();
        updateStatusZoom();
      } else {
        focusRoom(a.id);
      }
      return;
    }
    if (sel.type === 'region') focusRegion(sel.id);
  }

  function focusRegion(regionId) {
    const rooms = app.project.rooms.filter(room => room.region === regionId);
    if (!rooms.length) { toast('该区域没有房间', true); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    rooms.forEach(room => {
      minX = Math.min(minX, room.x);
      minY = Math.min(minY, room.y);
      maxX = Math.max(maxX, room.x + room.w);
      maxY = Math.max(maxY, room.y + room.h);
    });
    if (app.mode === '2d') {
      const W = canvasW(els.canvas2d), H = canvasH(els.canvas2d);
      app.view2d.cam.zoom = MV.clamp(Math.min((W - 180) / (maxX - minX), (H - 180) / (maxY - minY)), 0.2, 2);
      app.view2d.cam.x = (minX + maxX) / 2;
      app.view2d.cam.y = (minY + maxY) / 2;
      scheduleRender();
      updateStatusZoom();
    } else {
      switchMode('2d');
      requestAnimationFrame(() => focusRegion(regionId));
      return;
    }
    persistUI();
  }

  /* ============================================================
     pointer: 2D
     ============================================================ */
  function pointerPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function snap(value, step) {
    const s = step || 5;
    return Math.round(value / s) * s;
  }

  function onPointerDown(e, mode) {
    const canvas = mode === '2d' ? els.canvas2d : els.canvas3d;
    const pos = pointerPos(e, canvas);
    const W = canvasW(canvas), H = canvasH(canvas);

    if (mode === '2d') {
      if (e.button === 2 || e.button === 1 || app.spaceDown || app.tool === 'pan') {
        app.drag = {
          kind: 'pan', startX: pos.x, startY: pos.y,
          startCam: { x: app.view2d.cam.x, y: app.view2d.cam.y },
          canvas
        };
        canvas.setPointerCapture(e.pointerId);
        updateCursor();
        return;
      }
      if (e.button !== 0) return;

      if (app.tool === 'room') {
        const w = MV.Render2D.screenToWorld(pos.x, pos.y, app.view2d.cam, W, H);
        app.drag = {
          kind: 'create', startX: pos.x, startY: pos.y,
          startWorld: { x: snap(w.x), y: snap(w.y) },
          canvas, moved: false
        };
        app.view2d.draftRoom = { x: snap(w.x), y: snap(w.y), w: 0, h: 0 };
        canvas.setPointerCapture(e.pointerId);
        scheduleRender();
        return;
      }

      if (app.tool === 'connect') {
        const hit = MV.Render2D.pick(app.project, app.view2d, W, H, pos.x, pos.y);
        if (hit && hit.type === 'room') {
          if (!app.connectFrom) {
            app.connectFrom = hit.id;
            updateToolUI();
            syncViews();
            scheduleRender();
          } else if (app.connectFrom !== hit.id) {
            createConnection(app.connectFrom, hit.id);
          }
        }
        return;
      }

      if (app.tool === 'item') {
        const hit = MV.Render2D.pick(app.project, app.view2d, W, H, pos.x, pos.y);
        if (hit && hit.type === 'room') addItemToRoom(hit.id);
        return;
      }

      /* select */
      if (app.selection && app.selection.type === 'room') {
        const handle = MV.Render2D.pickHandle(app.view2d, pos.x, pos.y);
        if (handle) {
          const room = MV.findRoom(app.project, handle.roomId);
          if (room) {
            select('room', room.id);
            app.drag = {
              kind: 'resize', handle: handle.id, roomId: room.id,
              startRoom: { x: room.x, y: room.y, w: room.w, h: room.h },
              canvas, historyPushed: false, moved: false
            };
            canvas.setPointerCapture(e.pointerId);
            return;
          }
        }
      }

      const hit = MV.Render2D.pick(app.project, app.view2d, W, H, pos.x, pos.y);
      if (!hit) { clearSelection(); hideTooltip(); return; }
      if (hit.type === 'room') {
        const room = MV.findRoom(app.project, hit.id);
        if (!room) return;
        select('room', hit.id);
        const w = MV.Render2D.screenToWorld(pos.x, pos.y, app.view2d.cam, W, H);
        app.drag = {
          kind: 'move', roomId: room.id,
          offsetX: w.x - room.x, offsetY: w.y - room.y,
          canvas, historyPushed: false, moved: false
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
      if (hit.type === 'link') select('link', hit.id);
      else if (hit.type === 'item') select('item', hit.id);
      return;
    }

    /* ---------- 3D ---------- */
    if (e.button === 2 || e.altKey) {
      app.drag = {
        kind: 'orbit', startX: pos.x, startY: pos.y,
        startYaw: app.view3d.cam.yaw, startPitch: app.view3d.cam.pitch,
        canvas
      };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button === 1) {
      app.drag = {
        kind: 'pan3d', startX: pos.x, startY: pos.y,
        startTarget: { x: app.view3d.cam.target.x, y: app.view3d.cam.target.y, z: app.view3d.cam.target.z },
        canvas
      };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;

    const hit = MV.Render3D.pick(visibleProject(), app.view3d, W, H, pos.x, pos.y);
    if (!hit) { clearSelection(); hideTooltip(); return; }
    const room = MV.findRoom(app.project, hit.id);
    if (!room) return;
    select('room', hit.id);
    app.drag = {
      kind: 'move3d', roomId: room.id, canvas,
      historyPushed: false, moved: false,
      shift: e.shiftKey,
      startX: pos.x, startY: pos.y,
      startRoomX: room.x, startRoomY: room.y,
      startElev: room.elev
    };
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e, mode) {
    const canvas = mode === '2d' ? els.canvas2d : els.canvas3d;
    const pos = pointerPos(e, canvas);
    const W = canvasW(canvas), H = canvasH(canvas);

    if (app.mode === '2d') {
      els.statusCoords.textContent = coords2D(pos);
      app.view2d.pointerScreen = pos;
    }

    if (app.drag) {
      const drag = app.drag;
      if (drag.kind === 'pan') {
        const zoom = app.view2d.cam.zoom;
        app.view2d.cam.x = drag.startCam.x - (pos.x - drag.startX) / zoom;
        app.view2d.cam.y = drag.startCam.y - (pos.y - drag.startY) / zoom;
        scheduleRender();
        return;
      }
      if (drag.kind === 'create' && mode === '2d') {
        const w = MV.Render2D.screenToWorld(pos.x, pos.y, app.view2d.cam, W, H);
        const x1 = drag.startWorld.x, y1 = drag.startWorld.y;
        const x2 = snap(w.x), y2 = snap(w.y);
        app.view2d.draftRoom = {
          x: Math.min(x1, x2), y: Math.min(y1, y2),
          w: Math.abs(x2 - x1), h: Math.abs(y2 - y1)
        };
        drag.moved = Math.abs(pos.x - drag.startX) > 3 || Math.abs(pos.y - drag.startY) > 3;
        scheduleRender();
        return;
      }
      if (drag.kind === 'move' && mode === '2d') {
        if (!drag.historyPushed) { snapshot(); drag.historyPushed = true; }
        const room = MV.findRoom(app.project, drag.roomId);
        if (!room) return;
        const w = MV.Render2D.screenToWorld(pos.x, pos.y, app.view2d.cam, W, H);
        room.x = snap(w.x - drag.offsetX);
        room.y = snap(w.y - drag.offsetY);
        drag.moved = true;
        scheduleRender();
        return;
      }
      if (drag.kind === 'resize' && mode === '2d') {
        if (!drag.historyPushed) { snapshot(); drag.historyPushed = true; }
        const room = MV.findRoom(app.project, drag.roomId);
        if (!room) return;
        const w = MV.Render2D.screenToWorld(pos.x, pos.y, app.view2d.cam, W, H);
        const s = drag.startRoom;
        const right = s.x + s.w, bottom = s.y + s.h;
        let x = s.x, y = s.y, width = s.w, height = s.h;
        const mx = snap(w.x), my = snap(w.y);
        if (drag.handle === 'se') {
          width = Math.max(MV.ROOM_MIN_W, mx - s.x);
          height = Math.max(MV.ROOM_MIN_H, my - s.y);
        } else if (drag.handle === 'sw') {
          x = Math.min(mx, right - MV.ROOM_MIN_W);
          width = right - x;
          height = Math.max(MV.ROOM_MIN_H, my - s.y);
        } else if (drag.handle === 'ne') {
          width = Math.max(MV.ROOM_MIN_W, mx - s.x);
          y = Math.min(my, bottom - MV.ROOM_MIN_H);
          height = bottom - y;
        } else if (drag.handle === 'nw') {
          x = Math.min(mx, right - MV.ROOM_MIN_W);
          y = Math.min(my, bottom - MV.ROOM_MIN_H);
          width = right - x;
          height = bottom - y;
        }
        room.x = x; room.y = y; room.w = width; room.h = height;
        drag.moved = true;
        scheduleRender();
        return;
      }
      if (drag.kind === 'orbit' && mode === '3d') {
        app.view3d.cam.yaw = drag.startYaw - (pos.x - drag.startX) * 0.008;
        app.view3d.cam.pitch = MV.clamp(drag.startPitch + (pos.y - drag.startY) * 0.006, 0.08, 1.36);
        drag.moved = true;
        scheduleRender();
        updateStatus3D();
        return;
      }
      if (drag.kind === 'pan3d' && mode === '3d') {
        const scale = app.view3d.cam.dist * 0.0016;
        const yaw = app.view3d.cam.yaw;
        const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
        const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
        const dx = pos.x - drag.startX;
        const dy = pos.y - drag.startY;
        app.view3d.cam.target.x = drag.startTarget.x + (-dx * right.x + dy * forward.x) * scale;
        app.view3d.cam.target.z = drag.startTarget.z + (-dx * right.z + dy * forward.z) * scale;
        drag.moved = true;
        scheduleRender();
        return;
      }
      if (drag.kind === 'move3d' && mode === '3d') {
        if (!drag.historyPushed) { snapshot(); drag.historyPushed = true; }
        const room = MV.findRoom(app.project, drag.roomId);
        if (!room) return;
        if (e.shiftKey) {
          const dy = pos.y - drag.startY;
          room.elev = MV.clamp(snap(drag.startElev - dy * 0.8, 2), -300, 300);
        } else {
          const dist = app.view3d.cam.dist;
          const worldPerPixel = 2 * dist * Math.tan(25 * Math.PI / 180) / H;
          const projectPerPixel = worldPerPixel / MV.Render3D.SCALE;
          const yaw = app.view3d.cam.yaw;
          const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
          const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
          const dx = pos.x - drag.startX;
          const dy = pos.y - drag.startY;
          room.x = snap(drag.startRoomX + (dx * right.x - dy * forward.x) * projectPerPixel, 10);
          room.y = snap(drag.startRoomY + (dx * right.z - dy * forward.z) * projectPerPixel, 10);
        }
        drag.moved = true;
        scheduleRender();
        updateStatus3D();
        return;
      }
    }

    if (mode === '2d') {
      const hit = MV.Render2D.pick(app.project, app.view2d, W, H, pos.x, pos.y);
      updateHover(hit, pos);
      if (app.tool === 'connect') scheduleRender();
    } else {
      const hit = MV.Render3D.pick(visibleProject(), app.view3d, W, H, pos.x, pos.y);
      updateHover(hit, pos);
      els.statusCoords.textContent = 'YAW ' + Math.round(app.view3d.cam.yaw * 180 / Math.PI) + '° / PITCH ' + Math.round(app.view3d.cam.pitch * 180 / Math.PI) + '°';
    }
  }

  function onPointerUp(e, mode) {
    const drag = app.drag;
    if (!drag) return;
    app.drag = null;
    updateCursor();

    if (drag.kind === 'create') {
      const draft = app.view2d.draftRoom;
      app.view2d.draftRoom = null;
      let rect;
      if (!draft || (draft.w < MV.ROOM_MIN_W || draft.h < MV.ROOM_MIN_H)) {
        rect = {
          x: drag.startWorld.x, y: drag.startWorld.y,
          w: 180, h: 100
        };
      } else {
        rect = draft;
      }
      snapshot();
      const regionId = app.project.regions.some(r => r.id === app.currentRegion)
        ? app.currentRegion
        : app.project.regions[0].id;
      const index = app.project.rooms.length + 1;
      const room = {
        id: MV.uid('room'),
        name: '新房间 ' + index,
        region: regionId,
        x: snap(rect.x), y: snap(rect.y),
        w: Math.max(MV.ROOM_MIN_W, snap(rect.w)),
        h: Math.max(MV.ROOM_MIN_H, snap(rect.h)),
        type: 'normal',
        height: 38, elev: 0, depth: 38, note: ''
      };
      app.project.rooms.push(room);
      app.selection = { type: 'room', id: room.id };
      app.tool = 'select';
      app.analysis = MV.analyze(app.project);
      markDirty();
      updateToolUI();
      refreshAll();
      toast('房间已创建');
      return;
    }

    if (['move', 'resize', 'move3d'].includes(drag.kind)) {
      if (drag.moved) {
        commitAfterDrag();
      } else {
        scheduleRender();
      }
      return;
    }
    if (drag.kind === 'pan' || drag.kind === 'orbit' || drag.kind === 'pan3d') {
      scheduleRender();
      updateStatusZoom();
      persistUI();
    }
  }

  function onWheel(e, mode) {
    e.preventDefault();
    if (mode === '2d') {
      const pos = pointerPos(e, els.canvas2d);
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      MV.Render2D.zoomAt(app.view2d, canvasW(els.canvas2d), canvasH(els.canvas2d), pos.x, pos.y, factor);
      scheduleRender();
      updateStatusZoom();
      persistUI();
    } else {
      app.view3d.cam.dist = MV.clamp(app.view3d.cam.dist * (e.deltaY < 0 ? 0.9 : 1.1), 5, 160);
      scheduleRender();
      updateStatusZoom();
      persistUI();
    }
  }

  function createConnection(a, b) {
    if (a === b) return;
    const exists = app.project.links.find(link =>
      (link.a === a && link.b === b) || (link.a === b && link.b === a)
    );
    if (exists) {
      app.connectFrom = null;
      app.tool = 'select';
      app.selection = { type: 'link', id: exists.id };
      updateToolUI();
      refreshAll();
      toast('这两个房间之间已有连接');
      return;
    }
    snapshot();
    const link = {
      id: MV.uid('link'),
      a: a,
      b: b,
      gate: 'open',
      requires: [],
      keyReq: 0,
      dir: 'both',
      note: ''
    };
    app.project.links.push(link);
    app.connectFrom = null;
    app.tool = 'select';
    app.selection = { type: 'link', id: link.id };
    app.analysis = MV.analyze(app.project);
    markDirty();
    updateToolUI();
    refreshAll();
    toast('连接已创建，可在检查器中设置门锁');
  }

  /* ============================================================
     hover / tooltip
     ============================================================ */
  function updateHover(hit, pos) {
    const same = (app.hover && hit && app.hover.type === hit.type && app.hover.id === hit.id)
      || (!app.hover && !hit);
    app.hover = hit;
    if (!same) {
      syncViews();
      scheduleRender();
    }
    if (hit) showTooltip(hit, pos);
    else hideTooltip();
  }

  function showTooltip(hit, pos) {
    let html = '';
    if (hit.type === 'room') {
      const room = MV.findRoom(app.project, hit.id);
      if (!room) return hideTooltip();
      const region = app.project.regions.find(r => r.id === room.region);
      const type = MV.roomTypeById(room.type);
      const items = app.project.items.filter(item => item.room === room.id);
      const phase = app.analysis.roomPhase[room.id];
      html = `<div class="tt-kicker">${esc(region ? region.code : 'ZONE')} / ${type.code}${phase !== undefined ? ' / PHASE ' + String(phase).padStart(2, '0') : ' / UNREACHABLE'}</div>
        <div class="tt-title">${esc(room.name)}</div>
        <div class="tt-meta">${Math.round(room.w)} × ${Math.round(room.h)} · H ${Math.round(room.height)} / E ${Math.round(room.elev)} / D ${Math.round(room.depth)}</div>
        ${items.length ? `<div class="tt-list">${items.slice(0, 6).map(item => `<span class="tt-tag">${esc(item.name)}</span>`).join('')}${items.length > 6 ? `<span class="tt-tag">+${items.length - 6}</span>` : ''}</div>` : ''}`;
    } else if (hit.type === 'link') {
      const link = MV.findLink(app.project, hit.id);
      if (!link) return hideTooltip();
      const a = MV.findRoom(app.project, link.a);
      const b = MV.findRoom(app.project, link.b);
      const gate = MV.gateById(link.gate);
      const open = app.analysis.openLinks[link.id] !== undefined;
      const reqs = (link.requires || []).map(id => MV.abilityName(app.project, id));
      const dir = link.dir === 'both' ? '↔' : (link.dir === 'a2b' ? '→' : '←');
      html = `<div class="tt-kicker">LINK / ${gate.code}${open ? ' / OPEN' : ' / LOCKED'}</div>
        <div class="tt-title">${esc(a ? a.name : link.a)} ${dir} ${esc(b ? b.name : link.b)}</div>
        <div class="tt-meta">${esc(gate.name)}${link.keyReq ? ' · 钥匙 ' + link.keyReq : ''}${reqs.length ? ' · ' + esc(reqs.join(' + ')) : ''}</div>`;
    } else if (hit.type === 'item') {
      const item = MV.findItem(app.project, hit.id);
      if (!item) return hideTooltip();
      const room = MV.findRoom(app.project, item.room);
      html = `<div class="tt-kicker">${MV.itemKindById(item.kind).code}${item.optional ? ' / OPTIONAL' : ''}</div>
        <div class="tt-title">${esc(item.name)}</div>
        <div class="tt-meta">${esc(room ? room.name : item.room)}${item.grants ? ' · 授予 ' + esc(MV.abilityName(app.project, item.grants)) : ''}</div>`;
    } else {
      return hideTooltip();
    }
    els.canvasTooltip.innerHTML = html;
    els.canvasTooltip.hidden = false;
    const stageRect = (app.mode === '2d' ? els.stage2d : els.stage3d).getBoundingClientRect();
    const maxW = stageRect.width;
    const maxH = stageRect.height;
    const tw = els.canvasTooltip.offsetWidth;
    const th = els.canvasTooltip.offsetHeight;
    let left = pos.x + 14;
    let top = pos.y + 18;
    if (left + tw > maxW - 8) left = pos.x - tw - 14;
    if (top + th > maxH - 8) top = pos.y - th - 14;
    els.canvasTooltip.style.left = Math.max(8, left) + 'px';
    els.canvasTooltip.style.top = Math.max(8, top) + 'px';
  }

  function hideTooltip() {
    els.canvasTooltip.hidden = true;
  }

  function coords2D(pos) {
    const w = MV.Render2D.screenToWorld(pos.x, pos.y, app.view2d.cam, canvasW(els.canvas2d), canvasH(els.canvas2d));
    return 'X ' + Math.round(w.x) + '  Y ' + Math.round(w.y);
  }

  function updateStatus3D() {
    els.statusCoords.textContent = 'YAW ' + Math.round(app.view3d.cam.yaw * 180 / Math.PI) + '° / PITCH ' + Math.round(app.view3d.cam.pitch * 180 / Math.PI) + '°';
  }

  /* ============================================================
     save / export / import
     ============================================================ */
  function saveNow() {
    const ts = MV.saveProject(app.project);
    if (ts) {
      app.lastSaved = ts;
      app.dirty = false;
      updateSaveState();
      toast('已保存到浏览器本地');
    } else {
      toast('保存失败：浏览器存储不可用', true);
    }
    persistUI();
  }

  function exportJSON() {
    const name = MV.slugify(app.project.meta.title || 'route') + '.routeforge.json';
    MV.download(name, JSON.stringify(app.project, null, 2), 'application/json');
    toast('已导出 JSON 存档');
  }

  function importJSON(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const project = MV.normalizeProject(parsed);
        const counts = MV.projectCounts(project);
        confirmDialog(
          '导入存档',
          '将载入「' + project.meta.title + '」：' + counts.regions + ' 个区域 / ' + counts.rooms + ' 个房间。当前项目会先备份到浏览器。',
          () => replaceProject(project),
          '载入存档'
        );
      } catch (err) {
        console.error(err);
        toast('导入失败：不是有效的 Route Forge JSON', true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function exportPNG() {
    MV.Render2D.exportPNG(visibleProject(), app.view2d).then(result => {
      const name = MV.slugify(app.project.meta.title || 'route') + '-route.png';
      MV.download(name, result.blob);
      toast('路线 PNG 已导出');
    }).catch(err => {
      console.error(err);
      toast('PNG 导出失败', true);
    });
  }

  function backupCurrent() {
    try {
      if (app.project && app.project.rooms.length) {
        localStorage.setItem('routeforge.backup.v1', JSON.stringify(app.project));
      }
    } catch (err) { /* ignore */ }
  }

  function replaceProject(project) {
    backupCurrent();
    app.project = MV.normalizeProject(project);
    app.history.clear();
    app.selection = null;
    app.hover = null;
    app.hiddenRegions.clear();
    app.currentRegion = app.project.regions[0].id;
    app.analysis = MV.analyze(app.project);
    app.dirty = false;
    app.lastSaved = Date.now();
    MV.saveProject(app.project);
    app.view3d.center2d = MV.Render3D.mapCenter(app.project);
    if (app.mode === '2d') {
      fit2DReadable();
      app.fitted3d = false;
    } else {
      fit3D();
      app.fitted2d = false;
    }
    refreshAll();
    persistUI();
    toast('已载入：' + app.project.meta.title);
  }

  /* ============================================================
     presets / modals
     ============================================================ */
  const PHASE_PRESETS = {
    spectrum: ['#6ea8fe', '#8b7cf6', '#c77dff', '#f08a5d', '#f2c94c'],
    cool: ['#56ccf2', '#5b8def', '#7c6cf2', '#9b8cff', '#56d6c9'],
    warm: ['#f2994a', '#eb5757', '#e07a5f', '#f2c94c', '#f7768e'],
    earth: ['#8fbc8f', '#a3b18a', '#d4a373', '#bc6c25', '#e9c46a'],
    neon: ['#00e5ff', '#7c4dff', '#ff2d95', '#ffb300', '#aeea00']
  };

  function setColorMode(mode) {
    app.colorMode = mode === 'mono' ? 'mono' : 'color';
    document.querySelectorAll('[data-color-mode]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.colorMode === app.colorMode);
    });
    syncViews();
    renderRegionList();
    scheduleRender();
    updateStatus();
    persistUI();
  }

  function phasePreviewCss(colors) {
    return 'linear-gradient(90deg,' + colors.join(',') + ')';
  }

  function updatePaletteModalValues() {
    if (!app.modal) return;
    const preview = app.modal.querySelector('#phasePreview');
    if (preview) preview.style.background = phasePreviewCss(app.project.phaseColors);
    app.modal.querySelectorAll('[data-phase-color]').forEach(input => {
      const index = Number(input.dataset.phaseColor);
      if (app.project.phaseColors[index]) input.value = app.project.phaseColors[index];
    });
    app.modal.querySelectorAll('[data-region-color]').forEach(input => {
      const region = app.project.regions.find(r => r.id === input.dataset.regionColor);
      if (region) input.value = region.color;
    });
    app.modal.querySelectorAll('[data-color-mode]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.colorMode === app.colorMode);
    });
  }

  function openPaletteModal() {
    const phaseInputs = app.project.phaseColors.map((color, index) => `
      <label class="color-chip">
        <input type="color" data-phase-color="${index}" value="${esc(color)}" aria-label="阶段色 ${index + 1}">
        <span>${String(index + 1).padStart(2, '0')}</span>
      </label>`).join('');
    const regionInputs = app.project.regions.map(region => `
      <div class="region-color-row">
        <span class="region-color-name"><i style="background:${MV.regionColor(region, 'color')}"></i>${esc(region.name)}</span>
        <input type="color" data-region-color="${esc(region.id)}" value="${esc(region.color)}" aria-label="${esc(region.name)} 颜色">
      </div>`).join('');
    const gateLegend = MV.GATE_TYPES.filter(g => g.id !== 'open').map(g => `
      <span class="gate-color-chip"><i style="background:${g.color}"></i>${g.code} ${esc(g.name)}</span>`).join('');
    openModal(`<div class="modal palette-modal">
      <div class="modal-head">
        <div>
          <div class="modal-kicker">PALETTE / 配色</div>
          <h2>彩色模式与自定义颜色</h2>
          <p>颜色不是装饰：区域、阶段、门锁和道具各自有语义。单色模式保留蓝图风格。</p>
        </div>
        <button class="modal-close" data-close aria-label="关闭">×</button>
      </div>
      <div class="modal-body">
        <div class="section-label">显示模式</div>
        <div class="segmented palette-mode">
          <button data-color-mode="color" class="${app.colorMode === 'color' ? 'is-active' : ''}">彩色</button>
          <button data-color-mode="mono" class="${app.colorMode === 'mono' ? 'is-active' : ''}">单色</button>
        </div>
        <p class="hint-line">彩色模式：阶段色带用于房间与 3D 体块，区域色用于边界/顶边/标签，门锁与道具使用各自的语义色。单色模式只使用主题灰度。</p>

        <div class="section-label">阶段色带</div>
        <div class="phase-preview" id="phasePreview" style="background:${phasePreviewCss(app.project.phaseColors)}"></div>
        <div class="phase-inputs">${phaseInputs}</div>
        <div class="palette-presets">
          ${Object.keys(PHASE_PRESETS).map(key => `<button class="palette-preset" data-phase-preset="${key}"><i style="background:${phasePreviewCss(PHASE_PRESETS[key])}"></i><span>${key === 'spectrum' ? '光谱' : key === 'cool' ? '冷色' : key === 'warm' ? '暖色' : key === 'earth' ? '大地' : '霓虹'}</span></button>`).join('')}
        </div>

        <div class="section-label">区域颜色</div>
        <div class="region-color-list">${regionInputs}</div>

        <div class="section-label">门锁颜色</div>
        <div class="gate-color-legend">${gateLegend}</div>
        <div class="btn-row">
          <button class="btn btn-ghost" data-reset-colors>恢复默认配色</button>
        </div>
      </div>
      <div class="modal-foot"><button class="btn btn-primary" data-close>完成</button></div>
    </div>`, {
      onMount(overlay) {
        overlay.querySelectorAll('[data-color-mode]').forEach(btn => {
          btn.addEventListener('click', () => setColorMode(btn.dataset.colorMode));
        });
        overlay.querySelectorAll('[data-phase-color]').forEach(input => {
          input.addEventListener('input', () => {
            beforeEdit();
            const index = Number(input.dataset.phaseColor);
            app.project.phaseColors[index] = MV.normalizeHexColor(input.value, app.project.phaseColors[index]);
            updatePaletteModalValues();
            markDirty();
            scheduleRender();
          });
        });
        overlay.querySelectorAll('[data-region-color]').forEach(input => {
          input.addEventListener('input', () => {
            beforeEdit();
            const region = app.project.regions.find(r => r.id === input.dataset.regionColor);
            if (!region) return;
            region.color = MV.normalizeHexColor(input.value, region.color);
            renderRegionList();
            markDirty();
            scheduleRender();
          });
        });
        overlay.querySelectorAll('[data-phase-preset]').forEach(btn => {
          btn.addEventListener('click', () => {
            beforeEdit();
            const preset = PHASE_PRESETS[btn.dataset.phasePreset];
            if (preset) app.project.phaseColors = preset.slice();
            updatePaletteModalValues();
            markDirty();
            scheduleRender();
          });
        });
        overlay.querySelector('[data-reset-colors]').addEventListener('click', () => {
          beforeEdit();
          app.project.phaseColors = MV.DEFAULT_PHASE_COLORS.slice();
          app.project.regions.forEach(region => {
            region.color = MV.REGION_COLORS[region.tone % MV.REGION_COLORS.length];
          });
          updatePaletteModalValues();
          renderRegionList();
          markDirty();
          scheduleRender();
          toast('配色已恢复默认');
        });
      }
    });
  }

  function openPresetModal() {
    const activeId = app.project.meta.preset || 'mp1';
    let selected = activeId;
    const cards = MV.PRESETS.map(preset => {
      let counts = null;
      try { counts = MV.projectCounts(preset.build()); } catch (err) { counts = null; }
      return `<button class="preset-card ${preset.id === activeId ? 'is-active' : ''}" data-preset-card="${preset.id}">
        <span class="pc-mark"></span>
        <span class="pc-index">${preset.index} / ${preset.subtitle}</span>
        <span class="pc-name">${preset.name}</span>
        <span class="pc-desc">${preset.desc}</span>
        <span class="pc-meta">${counts ? counts.regions + ' REGIONS · ' + counts.rooms + ' ROOMS · ' + counts.items + ' ITEMS' : ''}</span>
      </button>`;
    }).join('');
    openModal(`<div class="modal">
      <div class="modal-head">
        <div>
          <div class="modal-kicker">LEVEL PRESETS / 参考路线</div>
          <h2>载入一个经典结构</h2>
          <p>预设会替换当前项目，并在浏览器中保留一份上一版备份。建议先导出 JSON。</p>
        </div>
        <button class="modal-close" data-close aria-label="关闭">×</button>
      </div>
      <div class="modal-body"><div class="preset-grid">${cards}</div></div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-close>取消</button>
        <button class="btn btn-primary" data-load-preset>载入所选预设</button>
      </div>
    </div>`, {
      onMount(overlay) {
        const cardEls = overlay.querySelectorAll('[data-preset-card]');
        cardEls.forEach(card => {
          card.addEventListener('click', () => {
            selected = card.dataset.presetCard;
            cardEls.forEach(c => c.classList.toggle('is-active', c === card));
          });
        });
        overlay.querySelector('[data-load-preset]').addEventListener('click', () => {
          const preset = MV.PRESETS.find(p => p.id === selected);
          if (!preset) return;
          closeModal();
          confirmDialog(
            '载入预设：' + preset.name,
            '当前项目会先备份到浏览器，然后被这个预设替换。可以继续用撤销 / 导出管理你的版本。',
            () => {
              try {
                replaceProject(preset.build());
              } catch (err) {
                console.error(err);
                toast('预设载入失败', true);
              }
            },
            '载入并替换'
          );
        });
      }
    });
  }

  function openHelpModal() {
    const rows = [
      ['V / R / C / I / H', '选择 / 房间 / 连接 / 物品 / 平移'],
      ['1 / 2', '2D 路线 / 3D 地图'],
      ['拖动房间', '移动位置'],
      ['拖动角点', '缩放房间'],
      ['空格 + 拖动 / 中键', '平移画布'],
      ['滚轮', '缩放 2D / 拉近 3D'],
      ['右键拖动（3D）', '旋转相机'],
      ['中键拖动（3D）', '平移相机'],
      ['Shift + 拖动（3D）', '调整房间基座高度'],
      ['F', '聚焦当前选择'],
      ['Delete', '删除当前选择'],
      ['Ctrl / Cmd + Z', '撤销'],
      ['Ctrl / Cmd + Shift + Z', '重做'],
      ['Ctrl / Cmd + S', '保存到浏览器'],
      ['Esc', '取消连接 / 关闭弹窗']
    ];
    openModal(`<div class="modal">
      <div class="modal-head">
        <div>
          <div class="modal-kicker">MANUAL / ROUTE FORGE</div>
          <h2>操作与说明</h2>
          <p>一个面向 3D 银河城的 2D 路线 + 3D 体块设计器。</p>
        </div>
        <button class="modal-close" data-close aria-label="关闭">×</button>
      </div>
      <div class="modal-body">
        <div class="shortcut-grid">${rows.map(row => `<div class="shortcut-row"><span>${row[1]}</span><kbd>${row[0]}</kbd></div>`).join('')}</div>
        <div class="section-label">外观与配色</div>
        <p class="about-copy">顶栏的太阳 / 月亮按钮切换白天与黑夜主题；调色盘按钮打开配色面板，可在彩色与单色之间切换，逐段编辑阶段色带，并为每个区域单独指定颜色。彩色模式下，房间顶边表示区域、底边表示阶段，门锁与道具使用各自的语义色。</p>
        <div class="section-label">区域过滤</div>
        <p class="about-copy">左侧区域列表的复选框控制 2D / 3D 显示，可同时隐藏多个区域；区域检查器里有“仅显示此区域”，区域标题右侧的“全部”恢复所有区域。过滤只影响地图显示，不改变进度分析与路线判定。</p>
        <div class="section-label">数据</div>
        <p class="about-copy">项目自动保存在浏览器 localStorage。顶栏的保存按钮会立即写入；导出 JSON 是长期备份的可靠方式。导入时会先备份当前项目到 <span class="mono">routeforge.backup.v1</span>。PNG 导出会重新排版整张 2D 路线图，不依赖当前缩放。</p>
        <div class="section-label">预设说明</div>
        <p class="about-copy"><strong>密特罗德 Prime</strong> 预设是基于公开资料的<strong>结构化复刻</strong>，保留了区域环、Magmoor 中枢、光束门矩阵、变形球空间锁、视镜锁、环境门槛与 12 神器终局，但不保证每个房间的坐标与道具位置与官方完全一致。其余预设为压缩后的结构参考。</p>
        <div class="section-label">设计原则</div>
        <p class="about-copy">先画出“玩家必须获得什么”，再画出“这些能力如何改变空间通行”。2D 视图负责因果链，3D 视图负责空间体块与垂直关系；进度面板用可达性分析检查锁死、钥匙预算与不可达房间。</p>
      </div>
      <div class="modal-foot"><button class="btn btn-primary" data-close>关闭</button></div>
    </div>`);
  }

  function confirmDialog(title, message, onConfirm, confirmLabel) {
    openModal(`<div class="modal is-sm">
      <div class="modal-head">
        <div><div class="modal-kicker">CONFIRM / 确认</div><h2>${esc(title)}</h2></div>
        <button class="modal-close" data-close aria-label="关闭">×</button>
      </div>
      <div class="modal-body"><p class="about-copy">${esc(message)}</p></div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-close>取消</button>
        <button class="btn btn-primary" data-confirm>${esc(confirmLabel || '确认')}</button>
      </div>
    </div>`, {
      onMount(overlay) {
        overlay.querySelector('[data-confirm]').addEventListener('click', () => {
          closeModal();
          onConfirm();
        });
      }
    });
  }

  function openModal(html, options) {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = html;
    els.modalRoot.appendChild(overlay);
    app.modal = overlay;
    overlay.addEventListener('mousedown', e => {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', closeModal);
    });
    if (options && typeof options.onMount === 'function') options.onMount(overlay);
    const focusTarget = overlay.querySelector('input, button.btn-primary, button');
    if (focusTarget) setTimeout(() => focusTarget.focus(), 30);
  }

  function onModalClick(e) {
    if (e.target === els.modalRoot) closeModal();
  }

  function closeModal() {
    if (app.modal) {
      app.modal.remove();
      app.modal = null;
    }
    els.modalRoot.innerHTML = '';
  }

  /* ============================================================
     toast
     ============================================================ */
  function toast(message, isError) {
    els.toast.textContent = message;
    els.toast.classList.toggle('is-error', !!isError);
    els.toast.hidden = false;
    requestAnimationFrame(() => els.toast.classList.add('is-visible'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('is-visible');
      setTimeout(() => { els.toast.hidden = true; }, 200);
    }, 2400);
  }

  /* ============================================================
     keyboard
     ============================================================ */
  function isTyping() {
    const el = document.activeElement;
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
  }

  function onKeyDown(e) {
    if (app.modal) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
      return;
    }
    const key = e.key;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && key.toLowerCase() === 's') {
      e.preventDefault();
      saveNow();
      return;
    }
    if (isTyping()) return;

    if (mod && key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
      return;
    }
    if (mod && key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }

    if (key === ' ' || e.code === 'Space') {
      if (document.activeElement && /BUTTON|A/.test(document.activeElement.tagName)) return;
      e.preventDefault();
      app.spaceDown = true;
      updateCursor();
      return;
    }
    if (key === 'Escape') {
      if (app.connectFrom) {
        app.connectFrom = null;
        updateToolUI();
        syncViews();
        scheduleRender();
      } else if (app.selection) {
        clearSelection();
      } else {
        hideTooltip();
      }
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      if (app.selection) { e.preventDefault(); deleteSelection(); }
      return;
    }
    if (key === '1') { switchMode('2d'); return; }
    if (key === '2') { switchMode('3d'); return; }
    if (key.toLowerCase() === 'v') { setTool('select'); return; }
    if (key.toLowerCase() === 'r') { setTool('room'); return; }
    if (key.toLowerCase() === 'c') { setTool('connect'); return; }
    if (key.toLowerCase() === 'i') { setTool('item'); return; }
    if (key.toLowerCase() === 'h') { setTool('pan'); return; }
    if (key.toLowerCase() === 'f') { focusSelection(); return; }
    if (key === '?' || (key === '/' && e.shiftKey)) { openHelpModal(); return; }
  }

  /* ============================================================
     misc helpers
     ============================================================ */
  function esc(value) { return MV.escapeHtml(value); }

  /* small read-only inspection API for automation / debugging */
  global.RouteForge = {
    version: '01',
    getProject: () => MV.clone(app.project),
    getAnalysis: () => MV.clone(app.analysis),
    getView: () => ({
      mode: app.mode,
      theme: app.theme,
      colorMode: app.colorMode,
      cam2d: MV.clone(app.view2d.cam),
      cam3d: MV.clone(app.view3d.cam),
      center2d: MV.clone(app.view3d.center2d),
      selection: app.selection ? MV.clone(app.selection) : null
    })
  };

  boot();
})(window);
