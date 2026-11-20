/* ============================================================
   ROUTE FORGE — application shell, editor interactions
   ============================================================ */
(function (global) {
  'use strict';
  const MV = global.MV;
  const L = MV.L;
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
    jumpBtn: $('jumpBtn'),
    showAllRegionsBtn: $('showAllRegionsBtn'),
    regionSummary: $('regionSummary'),
    regionList: $('regionList'),
    layerList: $('layerList'),
    snapToggle: $('snapToggle'),
    langBtn: $('langBtn'),
    fontSizeControl: $('fontSizeControl'),
    exportPngBtn: $('exportPngBtn'),
    stage2d: $('stage2d'),
    stage3d: $('stage3d'),
    stageTree: $('stageTree'),
    canvas2d: $('canvas2d'),
    canvas3d: $('canvas3d'),
    canvasTree: $('canvasTree'),
    treeSummary: $('treeSummary'),
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
    lang: 'zh',
    fontScale: 1.15,
    hiddenRegions: new Set(),
    itemKind: 'ability',
    currentRegion: null,
    rightTab: 'inspect',
    lastPanelKey: null,
    snap: true,
    layers: {
      gates: true, items: true, regions: true, path: true,
      phases: true, grid: true, names: true
    },
    view2d: null,
    view3d: null,
    viewTree: null,
    history: new MV.History(100),
    dirty: false,
    lastSaved: 0,
    drag: null,
    treeDrag: null,
    lastTreeClick: null,
    hover: null,
    treeHover: null,
    treeMainOnly: false,
    connectFrom: null,
    spaceDown: false,
    editGroup: false,
    editTimer: null,
    modal: null,
    raf: 0,
    fitted2d: true,
    fitted3d: false,
    fittedTree: false
  };

  let toastTimer = null;
  let roomClipboard = null;
  const persistUI = MV.debounce(() => {
    MV.saveUI({
      mode: app.mode,
      theme: app.theme,
      colorMode: app.colorMode,
      tool: app.tool,
      itemKind: app.itemKind,
      rightTab: app.rightTab,
      fontScale: app.fontScale,
      snap: app.snap,
      lang: app.lang,
      layers: app.layers,
      hiddenRegions: Array.from(app.hiddenRegions),
      currentRegion: app.currentRegion,
      cam2d: app.view2d ? app.view2d.cam : null,
      cam3d: app.view3d ? app.view3d.cam : null,
      camTree: app.viewTree ? app.viewTree.cam : null,
      treeMainOnly: app.treeMainOnly
    });
  }, 250);

  const autosave = MV.debounce(() => {
    MV.saveProject(app.project);
    app.lastSaved = Date.now();
    app.dirty = false;
    updateSaveState();
  }, 550);

  function flushAutosave() {
    if (!app.dirty) return;
    const ts = MV.saveProject(app.project);
    if (ts) {
      app.lastSaved = ts;
      app.dirty = false;
      updateSaveState();
    }
  }

  /* ============================================================
     boot
     ============================================================ */
  function boot() {
    const savedUI = MV.loadUI() || {};
    app.lang = savedUI.lang === 'en' ? 'en' : 'zh';
    MV.setLang(app.lang);
    MV.applyI18n();
    app.theme = savedUI.theme === 'light' ? 'light' : 'dark';
    applyTheme(app.theme, false);
    const savedScale = Number(savedUI.fontScale);
    app.fontScale = savedScale >= 1 && savedScale <= 1.5 ? savedScale : 1.15;
    app.snap = savedUI.snap !== false;
    applyFontScale(app.fontScale, false);
    if (els.snapToggle) els.snapToggle.checked = app.snap;
    if (savedUI.layers && typeof savedUI.layers === 'object') {
      Object.keys(app.layers).forEach(key => {
        if (typeof savedUI.layers[key] === 'boolean') app.layers[key] = savedUI.layers[key];
      });
    }
    if (savedUI.mode === '3d') app.mode = '3d';
    if (savedUI.mode === 'tree') app.mode = 'tree';
    if (typeof savedUI.treeMainOnly === 'boolean') app.treeMainOnly = savedUI.treeMainOnly;
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
    const camTree = savedUI.camTree && typeof savedUI.camTree.zoom === 'number' ? savedUI.camTree : null;
    app.viewTree = {
      cam: camTree || { x: 0, y: 0, zoom: 0.5 },
      selection: null,
      hover: null,
      analysis: app.analysis,
      mainOnly: app.treeMainOnly
    };
    app.fittedTree = !!camTree;

    bindUI();
    applyModeUI();
    updateToolUI();
    refreshAll();
    updateSaveState();

    const ro = new ResizeObserver(() => scheduleRender());
    ro.observe(els.stage2d);
    ro.observe(els.stage3d);
    ro.observe(els.stageTree);
    window.addEventListener('resize', scheduleRender);
    window.addEventListener('beforeunload', flushAutosave);
    window.addEventListener('pagehide', flushAutosave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushAutosave();
    });
    requestAnimationFrame(() => {
      if (app.mode === '3d' && !app.fitted3d) fit3D();
      if (app.mode === 'tree' && !app.fittedTree) fitTree(true);
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
      app.project.meta.title = els.projectName.value || L('未命名路线', 'Untitled Route');
      markDirty();
      scheduleRender();
      persistUI();
    });
    els.projectName.addEventListener('blur', () => {
      if (!els.projectName.value.trim()) {
        els.projectName.value = L('未命名路线', 'Untitled Route');
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
    els.jumpBtn.addEventListener('click', openJumpModal);
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
    els.snapToggle.addEventListener('change', () => {
      app.snap = els.snapToggle.checked;
      persistUI();
      toast(L('网格吸附：', 'Snap grid: ') + (app.snap ? L('开启（5px）', 'on (5px)') : L('关闭', 'off')));
    });
    els.langBtn.addEventListener('click', () => {
      applyLanguage(app.lang === 'zh' ? 'en' : 'zh', true);
    });
    els.fontSizeControl.addEventListener('click', e => {
      const btn = e.target.closest('[data-font-scale]');
      if (!btn) return;
      applyFontScale(Number(btn.dataset.fontScale), true);
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
    bindTreeCanvas(els.canvasTree);

    document.querySelectorAll('[data-tree-fit]').forEach(btn => {
      btn.addEventListener('click', () => fitTree(false));
    });
    document.querySelectorAll('[data-tree-main]').forEach(btn => {
      btn.addEventListener('click', () => {
        app.treeMainOnly = !app.treeMainOnly;
        app.viewTree.mainOnly = app.treeMainOnly;
        btn.classList.toggle('is-active', app.treeMainOnly);
        syncViews();
        scheduleRender();
        persistUI();
      });
    });

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

  function selectTreeNode(node) {
    if (!node) return;
    if (node.type === 'item') select('item', node.itemId);
    else if (node.type === 'gate') select('link', node.linkId);
    else if (node.type === 'root') select('room', app.project.startRoom);
    else if (node.type === 'keypool') {
      app.selection = null;
      app.rightTab = 'inspect';
      renderRightPanel();
      toast(L('全局钥匙池：', 'Global key pool: ') + node.sub);
    }
  }

  function focusTreeNode(node) {
    if (!node || node.type === 'keypool') return;
    selectTreeNode(node);
    switchMode('2d');
    requestAnimationFrame(() => focusSelection());
  }

  function bindTreeCanvas(canvas) {
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      const pos = pointerPos(e, canvas);
      const W = canvasW(canvas), H = canvasH(canvas);
      if (e.button === 1 || e.button === 2 || app.spaceDown) {
        app.treeDrag = {
          startX: pos.x, startY: pos.y,
          startCam: { x: app.viewTree.cam.x, y: app.viewTree.cam.y },
          canvas, moved: false
        };
        canvas.setPointerCapture(e.pointerId);
        updateCursor();
        return;
      }
      if (e.button !== 0) return;
      const hit = MV.RenderTree.pick(app.viewTree, W, H, pos.x, pos.y);
      if (hit) {
        const now = Date.now();
        if (app.lastTreeClick && app.lastTreeClick.id === hit.id && now - app.lastTreeClick.time < 340) {
          app.lastTreeClick = null;
          focusTreeNode(hit);
          return;
        }
        app.lastTreeClick = { id: hit.id, time: now };
        selectTreeNode(hit);
        return;
      }
      app.lastTreeClick = null;
      app.treeDrag = {
        startX: pos.x, startY: pos.y,
        startCam: { x: app.viewTree.cam.x, y: app.viewTree.cam.y },
        canvas, moved: false
      };
      canvas.setPointerCapture(e.pointerId);
      updateCursor();
    });
    canvas.addEventListener('pointermove', e => {
      const pos = pointerPos(e, canvas);
      const W = canvasW(canvas), H = canvasH(canvas);
      if (app.treeDrag) {
        const drag = app.treeDrag;
        if (Math.abs(pos.x - drag.startX) + Math.abs(pos.y - drag.startY) > 2) drag.moved = true;
        const zoom = app.viewTree.cam.zoom;
        app.viewTree.cam.x = drag.startCam.x - (pos.x - drag.startX) / zoom;
        app.viewTree.cam.y = drag.startCam.y - (pos.y - drag.startY) / zoom;
        scheduleRender();
        return;
      }
      const hit = MV.RenderTree.pick(app.viewTree, W, H, pos.x, pos.y);
      const same = (hit && app.treeHover && hit.id === app.treeHover.id) || (!hit && !app.treeHover);
      if (!same) {
        app.treeHover = hit;
        app.viewTree.hover = hit;
        scheduleRender();
      }
    });
    canvas.addEventListener('pointerup', e => {
      if (!app.treeDrag) return;
      const moved = app.treeDrag.moved;
      app.treeDrag = null;
      updateCursor();
      scheduleRender();
      if (moved) persistUI();
    });
    canvas.addEventListener('pointercancel', () => {
      app.treeDrag = null;
      updateCursor();
    });
    canvas.addEventListener('pointerleave', () => {
      if (!app.treeDrag && app.treeHover) {
        app.treeHover = null;
        app.viewTree.hover = null;
        scheduleRender();
      }
    });
    canvas.addEventListener('dblclick', e => {
      const pos = pointerPos(e, canvas);
      const hit = MV.RenderTree.pick(app.viewTree, canvasW(canvas), canvasH(canvas), pos.x, pos.y);
      if (hit) focusTreeNode(hit);
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const pos = pointerPos(e, canvas);
      MV.RenderTree.zoomAt(app.viewTree, canvasW(canvas), canvasH(canvas), pos.x, pos.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
      scheduleRender();
      updateStatusZoom();
      persistUI();
    }, { passive: false });
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
    app.viewTree.selection = app.selection;
    app.viewTree.hover = app.treeHover;
    app.viewTree.analysis = app.analysis;
    app.viewTree.mainOnly = app.treeMainOnly;
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
      if (app.mode === 'tree') {
        MV.RenderTree.draw(els.canvasTree, app.project, app.viewTree);
      } else {
        const project = visibleProject();
        if (app.mode === '2d') {
          MV.Render2D.draw(els.canvas2d, project, app.view2d);
        } else {
          MV.Render3D.draw(els.canvas3d, project, app.view3d);
        }
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
    updateTreeSummary();
    syncViews();
    scheduleRender();
  }

  function updateTreeSummary() {
    if (!els.treeSummary || !app.analysis) return;
    const graph = MV.buildLockTree(app.project, app.analysis);
    const meta = graph.meta;
    els.treeSummary.textContent = meta.items + ' items / ' + meta.steps + ' steps / ' + meta.gates + ' locks' +
      (meta.optional ? ' / ' + meta.optional + ' optional' : '') +
      (meta.cycles ? ' / ' + meta.cycles + ' cycles' : '');
    const mainBtn = document.querySelector('[data-tree-main]');
    if (mainBtn) mainBtn.classList.toggle('is-active', app.treeMainOnly);
  }

  function updateHeader() {
    if (document.activeElement !== els.projectName) {
      els.projectName.value = app.project.meta.title || L('未命名路线', 'Untitled Route');
    }
    updateSaveState();
  }

  function updateSaveState() {
    if (app.dirty) {
      els.saveState.textContent = L('编辑中 · 未保存', 'Editing · unsaved');
      els.saveState.classList.add('is-dirty');
    } else if (app.lastSaved) {
      els.saveState.textContent = L('已保存 ', 'Saved ') + MV.formatTime(app.lastSaved);
      els.saveState.classList.remove('is-dirty');
    } else {
      els.saveState.textContent = L('本地自动保存', 'Autosaved locally');
      els.saveState.classList.remove('is-dirty');
    }
  }

  function updateStatus() {
    const counts = MV.projectCounts(app.project);
    const visibleRegions = counts.regions - app.hiddenRegions.size;
    els.statusMode.textContent = app.mode === '2d' ? '2D ROUTE' : (app.mode === '3d' ? '3D MASSING' : 'LOCK TREE');
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
    } else if (app.mode === '3d') {
      els.statusZoom.textContent = 'DIST ' + Math.round(app.view3d.cam.dist);
    } else {
      els.statusZoom.textContent = Math.round(app.viewTree.cam.zoom * 100) + '%';
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
      return `<div class="region-row ${region.id === activeRegion ? 'is-active' : ''} ${hidden ? 'is-hidden' : ''}" data-region="${esc(region.id)}" role="button" tabindex="0" title="${esc(region.code)} / ${count} ${L('房间', 'rooms')}">
        <input class="region-visible" type="checkbox" data-region-visible="${esc(region.id)}" ${hidden ? '' : 'checked'} title="${hidden ? L('显示', 'Show') : L('隐藏', 'Hide')} ${esc(region.name)}" aria-label="${hidden ? L('显示', 'Show') : L('隐藏', 'Hide')} ${esc(region.name)}">
        <span class="region-swatch" style="background:${color}"></span>
        <span class="region-name">${esc(region.name)}</span>
        <span class="region-count">${String(count).padStart(2, '0')}</span>
        <button class="region-focus" data-focus-region="${esc(region.id)}" title="${L('聚焦区域', 'Focus region')}">
          <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4.5"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3"/></svg>
        </button>
      </div>`;
    }).join('');
    els.regionList.innerHTML = html || '<div class="region-empty">' + L('还没有区域', 'No regions yet') + '</div>';
  }

  function renderRightPanel() {
    const panelKey = app.rightTab + '|' + (app.selection ? app.selection.type + ':' + app.selection.id : 'none');
    const scrollTop = els.rightBody.scrollTop;
    els.rightBody.classList.toggle('is-guide', app.rightTab === 'guide');
    document.querySelectorAll('.right-tabs button').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.rtab === app.rightTab);
    });
    if (app.rightTab === 'inspect') renderInspector();
    else if (app.rightTab === 'progress') renderProgress();
    else renderGuide();
    els.rightBody.scrollTop = panelKey === app.lastPanelKey ? scrollTop : 0;
    app.lastPanelKey = panelKey;
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
    return `${inspectorHead(L('ROOM / 房间', 'ROOM'), room.name, pills)}
      <div class="form-grid">
        <label class="field"><span>${L('名称', 'Name')}</span><input data-field="name" value="${esc(room.name)}"></label>
        <div class="form-grid two">
          <label class="field"><span>${L('区域', 'Region')}</span><select data-field="region">${app.project.regions.map(r => `<option value="${esc(r.id)}" ${r.id === room.region ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
          <label class="field"><span>${L('类型', 'Type')}</span><select data-field="type">${MV.ROOM_TYPES.map(t => `<option value="${t.id}" ${t.id === room.type ? 'selected' : ''}>${t.name}</option>`).join('')}</select></label>
        </div>
        <div class="form-grid two">
          ${numberField('X', 'x', room.x, 5)}
          ${numberField('Y', 'y', room.y, 5)}
        </div>
        <div class="form-grid two">
          ${numberField(L('宽度', 'Width'), 'w', room.w, 5, 56)}
          ${numberField(L('高度（2D）', 'Height (2D)'), 'h', room.h, 5, 36)}
        </div>
        <div class="section-label">${L('3D 体块', '3D Massing')}</div>
        <div class="form-grid three">
          ${numberField(L('层高', 'Height'), 'height', room.height, 2, 8)}
          ${numberField(L('基座', 'Elev'), 'elev', room.elev, 2)}
          ${numberField(L('进深', 'Depth'), 'depth', room.depth, 2, 10)}
        </div>
        <p class="hint-line">${L('2D 宽度 / 高度控制平面轮廓；层高、基座、进深只影响 3D 体块。可在 3D 视图中直接拖动，Shift+拖动改基座高度。', '2D width / height define the plan outline; height, elevation and depth only affect the 3D massing. Drag directly in the 3D view, or Shift+drag to change elevation.')}</p>
        <label class="field"><span>${L('备注', 'Note')}</span><textarea data-field="note" rows="3">${esc(room.note)}</textarea></label>
      </div>
      <div class="section-label">${L('房间物品', 'Room Items')}</div>
      <div class="item-list">
        ${items.length ? items.map(item => itemRow(item, true)).join('') : `<div class="item-empty">${L('这间房还没有物品。', 'No items in this room yet.')}</div>`}
      </div>
      <div class="btn-row"><button class="btn btn-ghost" data-action="add-item" data-room="${esc(room.id)}">+ ${L('添加物品', 'Add Item')}</button></div>
      <div class="section-label">${L('连接', 'Links')}</div>
      <div class="item-list">
        ${links.length ? links.map(link => linkRow(link, room.id)).join('') : `<div class="item-empty">${L('这间房还没有连接。', 'No links for this room yet.')}</div>`}
      </div>
      <div class="btn-row">
        <button class="btn" data-action="focus">${L('聚焦房间', 'Focus Room')}</button>
        <button class="btn" data-action="duplicate-room">${L('复制', 'Duplicate')}</button>
        <button class="btn btn-danger" data-action="delete-room">${L('删除房间', 'Delete Room')}</button>
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
      { text: link.dir === 'both' ? L('双向', 'Two-way') : (link.dir === 'a2b' ? 'A → B' : 'B → A') },
      { text: open ? 'OPEN' : 'LOCKED', solid: true }
    ];
    const dirSymbol = link.dir === 'both' ? '↔' : (link.dir === 'a2b' ? '→' : '←');
    return `${inspectorHead(L('LINK / 连接', 'LINK'), (a ? a.name : '?') + ' ' + dirSymbol + ' ' + (b ? b.name : '?'), pills)}
      <div class="form-grid">
        <label class="field"><span>${L('门锁类型', 'Gate Type')}</span><select data-field="gate">${MV.GATE_TYPES.map(g => `<option value="${g.id}" ${g.id === link.gate ? 'selected' : ''}>${g.code} · ${g.name}</option>`).join('')}</select></label>
        <div class="field-row">
          <label class="field" style="flex:1"><span>${L('方向', 'Direction')}</span><select data-field="dir">
            <option value="both" ${link.dir === 'both' ? 'selected' : ''}>${L('双向通行', 'Two-way')}</option>
            <option value="a2b" ${link.dir === 'a2b' ? 'selected' : ''}>${L('A → B 单向', 'A → B one-way')}</option>
            <option value="b2a" ${link.dir === 'b2a' ? 'selected' : ''}>${L('B → A 单向', 'B → A one-way')}</option>
          </select></label>
          ${numberField(L('钥匙数', 'Keys'), 'keyReq', link.keyReq, 1, 0)}
        </div>
        <p class="hint-line">${esc(gate.desc)} ${L('修改门锁类型会重置下方能力需求；之后可继续自定义勾选。', 'Changing the gate type resets the ability requirements below; you can then customize them.')}</p>
        <div class="section-label">${L('能力需求', 'Ability Requirements')}</div>
        ${app.project.abilities.length ? `<div class="check-grid">${app.project.abilities.map(ability => `<label class="check-field"><input type="checkbox" data-field="requires" data-ability="${esc(ability.id)}" ${link.requires.includes(ability.id) ? 'checked' : ''}><span>${esc(MV.abilityName(app.project, ability.id))}</span></label>`).join('')}</div>` : `<p class="hint-line">${L('项目能力表为空，请先在项目检查器中添加能力。', 'The project ability list is empty. Add abilities in the project inspector first.')}</p>`}
        ${missingAbilities.length ? `<div class="req-list">${missingAbilities.map(id => `<span class="req-chip missing">${L('缺失', 'Missing')}: ${esc(id)}</span>`).join('')}</div>` : ''}
        <div class="section-label">${L('状态', 'Status')}</div>
        <div class="req-list">
          ${link.requires.length ? link.requires.map(req => `<span class="req-chip ${app.analysis.abilities.includes(req) ? '' : 'missing'}">${esc(MV.abilityName(app.project, req))}</span>`).join('') : `<span class="req-chip">${L('无能力门槛', 'No ability requirement')}</span>`}
          ${link.keyReq ? `<span class="req-chip ${app.analysis.keys >= link.keyReq ? '' : 'missing'}">${L('钥匙', 'Keys')} ${app.analysis.keys} / ${link.keyReq}</span>` : ''}
        </div>
        <label class="field" style="margin-top:10px"><span>${L('备注', 'Note')}</span><textarea data-field="note" rows="2">${esc(link.note)}</textarea></label>
      </div>
      <div class="btn-row">
        <button class="btn" data-action="swap-link">${L('反向 A/B', 'Swap A/B')}</button>
        <button class="btn" data-action="focus">${L('定位连接', 'Focus Link')}</button>
        <button class="btn btn-danger" data-action="delete-link">${L('删除连接', 'Delete Link')}</button>
      </div>`;
  }

  function inspectorItem(id) {
    const item = MV.findItem(app.project, id);
    if (!item) return inspectorProject();
    const room = MV.findRoom(app.project, item.room);
    const kind = MV.itemKindById(item.kind);
    const reachable = app.analysis.reachable.includes(item.room);
    const grantName = item.grants ? MV.abilityName(app.project, item.grants) : L('无', 'None');
    return `${inspectorHead(L('ITEM / 物品', 'ITEM'), item.name, [
      { text: kind.code },
      { text: room ? room.name : item.room },
      { text: reachable ? 'REACHABLE' : 'UNREACHABLE', solid: !reachable }
    ])}
      <div class="form-grid">
        <label class="field"><span>${L('名称', 'Name')}</span><input data-field="name" value="${esc(item.name)}"></label>
        <div class="form-grid two">
          <label class="field"><span>${L('类别', 'Kind')}</span><select data-field="kind">${MV.ITEM_KINDS.map(k => `<option value="${k.id}" ${k.id === item.kind ? 'selected' : ''}>${k.name}</option>`).join('')}</select></label>
          <label class="field"><span>${L('所在房间', 'Room')}</span><select data-field="room">${app.project.rooms.map(r => `<option value="${esc(r.id)}" ${r.id === item.room ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>${L('授予能力', 'Grants Ability')}</span><select data-field="grants">
          <option value="">${L('不授予', 'None')}</option>
          ${app.project.abilities.map(a => `<option value="${esc(a.id)}" ${a.id === item.grants ? 'selected' : ''}>${esc(MV.abilityName(app.project, a.id))} · ${esc(a.id)}</option>`).join('')}
        </select></label>
        ${item.kind === 'key' ? `<div class="form-grid two">${numberField(L('钥匙数量', 'Key Count'), 'keyCount', item.keyCount, 1, 1)}<div></div></div>` : ''}
        <label class="check-field"><input type="checkbox" data-field="optional" ${item.optional ? 'checked' : ''}><span>${L('可选内容（不参与主线判定）', 'Optional (ignored by the main path)')}</span></label>
        <label class="field"><span>${L('备注', 'Note')}</span><textarea data-field="note" rows="2">${esc(item.note)}</textarea></label>
      </div>
      <p class="hint-line">${L('授予能力：拾取后立即加入能力集合。用于能力道具、Boss 旗标或唯一钥匙。钥匙数量：会计入全局钥匙预算。', 'Grants ability: adds the ability as soon as the item is collected. Use it for ability items, boss flags or unique keys. Key count: contributes to the global key budget.')}</p>
      <div class="btn-row">
        <button class="btn" data-action="focus">${L('定位物品', 'Focus Item')}</button>
        <button class="btn btn-danger" data-action="delete-item">${L('删除物品', 'Delete Item')}</button>
      </div>`;
  }

  function inspectorRegion(id) {
    const region = app.project.regions.find(r => r.id === id);
    if (!region) return inspectorProject();
    const rooms = app.project.rooms.filter(room => room.region === id);
    const items = app.project.items.filter(item => rooms.some(room => room.id === item.room));
    return `${inspectorHead(L('REGION / 区域', 'REGION'), region.name, [
      { text: region.code },
      { text: rooms.length + ' ROOMS' },
      { text: items.length + ' ITEMS' }
    ])}
      <div class="form-grid">
        <label class="field"><span>${L('名称', 'Name')}</span><input data-field="name" value="${esc(region.name)}"></label>
        <div class="form-grid two">
          <label class="field"><span>${L('代号', 'Code')}</span><input data-field="code" value="${esc(region.code)}" maxlength="6"></label>
          <label class="field"><span>${L('灰度色调', 'Gray Tone')}</span><select data-field="tone">${MV.REGION_TONES.map(t => `<option value="${t.id}" ${t.id === region.tone ? 'selected' : ''}>TONE ${t.id} / ${t.color}</option>`).join('')}</select></label>
        </div>
        <div class="form-grid two">
          <label class="field"><span>${L('区域颜色', 'Region Color')}</span><input type="color" data-field="color" value="${esc(region.color)}"></label>
          <div class="field"><span>${L('颜色用途', 'Color Usage')}</span><div class="color-note">${L('彩色模式下用于房间顶边、3D 体块、标签与连线。', 'In color mode, used for room top edges, 3D blocks, labels and links.')}</div></div>
        </div>
        ${numberField(L('3D 基座高度', '3D Base Elevation'), 'elev', region.elev, 10)}
      </div>
      <p class="hint-line">${L('区域用于给房间分组、着色和统计。新增房间会放入当前选中的区域。基座高度只影响 3D 视图，可把不同区域叠成不同楼层。', 'Regions group, color and count rooms. New rooms go into the current region. Base elevation only affects the 3D view and lets regions sit on different floors.')}</p>
      <div class="btn-row">
        <button class="btn" data-action="set-current-region">${L('设为当前区域', 'Set Current Region')}</button>
        <button class="btn" data-action="solo-region">${L('仅显示此区域', 'Show Only This Region')}</button>
        <button class="btn" data-action="focus-region">${L('聚焦区域', 'Focus Region')}</button>
        <button class="btn btn-danger" data-action="delete-region" ${rooms.length ? 'disabled title="' + L('先清空该区域的房间', 'Empty this region first') + '"' : ''}>${L('删除区域', 'Delete Region')}</button>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" data-action="show-all-regions">${L('显示全部区域', 'Show All Regions')}</button>
      </div>`;
  }

  function inspectorProject() {
    const counts = MV.projectCounts(app.project);
    const errors = app.analysis.warnings.filter(w => w.level === 'error').length;
    return `${inspectorHead(L('PROJECT / 项目', 'PROJECT'), app.project.meta.title || L('未命名路线', 'Untitled Route'), [
      { text: (app.project.meta.preset || 'custom').toUpperCase() },
      { text: counts.rooms + ' ROOMS' },
      { text: errors ? errors + ' ERRORS' : 'STRUCTURE OK', solid: true }
    ])}
      <div class="stat-grid">
        <div class="stat-cell"><div class="s-label">REACHABLE</div><div class="s-value">${app.analysis.stats.reachableRooms}<span style="font-size:calc(11px * var(--font-scale));color:var(--ink-4)"> / ${counts.rooms}</span></div><div class="s-sub">${L('从起点可达的房间', 'Rooms reachable from start')}</div></div>
        <div class="stat-cell"><div class="s-label">KEYS</div><div class="s-value">${app.analysis.keys}<span style="font-size:calc(11px * var(--font-scale));color:var(--ink-4)"> / ${app.analysis.keysTotal}</span></div><div class="s-sub">${L('已收集 / 全图钥匙', 'Collected / total keys')}</div></div>
        <div class="stat-cell"><div class="s-label">GATES</div><div class="s-value">${app.analysis.openCount}<span style="font-size:calc(11px * var(--font-scale));color:var(--ink-4)"> / ${counts.links}</span></div><div class="s-sub">${L('可通行 / 全部门锁', 'Passable / total gates')}</div></div>
        <div class="stat-cell"><div class="s-label">ITEMS</div><div class="s-value">${counts.items}</div><div class="s-sub">${counts.optional} ${L('个可选', 'optional')} / ${counts.bosses} ${L('个 Boss', 'bosses')}</div></div>
      </div>
      <div class="form-grid">
        <label class="field"><span>${L('项目标题', 'Project Title')}</span><input data-field="title" value="${esc(app.project.meta.title || L('未命名路线', 'Untitled Route'))}"></label>
        <div class="form-grid two">
          <label class="field"><span>${L('起点房间', 'Start Room')}</span><select data-field="startRoom">${app.project.rooms.map(r => `<option value="${esc(r.id)}" ${r.id === app.project.startRoom ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
          <label class="field"><span>${L('终点房间', 'Goal Room')}</span><select data-field="goalRoom">${app.project.rooms.map(r => `<option value="${esc(r.id)}" ${r.id === app.project.goalRoom ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>${L('项目备注', 'Project Notes')}</span><textarea data-field="notes" rows="3">${esc(app.project.meta.notes)}</textarea></label>
      </div>
      <div class="section-label">${L('起始能力', 'Starting Abilities')}</div>
      <div class="check-grid">
        ${app.project.abilities.map(a => `<label class="check-field"><input type="checkbox" data-field="startAbility" data-ability="${esc(a.id)}" ${app.project.startAbilities.includes(a.id) ? 'checked' : ''}><span>${esc(MV.abilityName(app.project, a.id))}</span></label>`).join('')}
      </div>
      <div class="section-label">${L('能力表', 'Ability List')}</div>
      <div class="ability-list">
        ${app.project.abilities.map(a => `<div class="ability-row">
          <div><div class="a-name">${esc(MV.abilityName(app.project, a.id))}</div><div class="a-id">${esc(a.id)}</div></div>
          <button class="ability-del" data-action="delete-ability" data-ability="${esc(a.id)}" title="${L('删除能力', 'Delete ability')}">×</button>
        </div>`).join('')}
      </div>
      <div class="inline-form">
        <input id="newAbilityName" placeholder="${L('新能力名称，例如：二段跳', 'New ability name, e.g. Double Jump')}" maxlength="24">
        <button data-action="add-ability" title="${L('添加能力', 'Add ability')}">+</button>
      </div>
      <p class="hint-line">${L('能力表是门锁与道具的共享词汇。被引用的能力不能删除。', 'The ability list is the shared vocabulary for gates and items. Referenced abilities cannot be deleted.')}</p>
      <div class="btn-row">
        <button class="btn" data-action="fit-all">${L('适应全部', 'Fit All')}</button>
        <button class="btn" data-action="spread-layout">${L('舒展布局', 'Spread Layout')}</button>
        <button class="btn" data-action="focus-goal">${L('定位终点', 'Focus Goal')}</button>
        <button class="btn" data-action="open-presets">${L('载入预设', 'Load Preset')}</button>
      </div>
      <div class="section-label">${L('参考', 'Reference')}</div>
      <div class="hint-line">${esc(app.project.meta.preset || 'custom')} · ${counts.regions} ${L('区域', 'regions')} · ${counts.rooms} ${L('房间', 'rooms')} · ${counts.links} ${L('连接', 'links')}</div>`;
  }

  function numberField(label, field, value, step, min) {
    return `<label class="field"><span>${label}</span><input type="number" data-field="${field}" value="${Number(value) || 0}" step="${step || 1}" ${min != null ? `min="${min}"` : ''}></label>`;
  }

  /* ============================================================
     right panel events
     ============================================================ */
  const NON_STRUCTURAL_FIELDS = new Set(['x', 'y', 'w', 'h', 'height', 'elev', 'depth', 'note', 'notes', 'title', 'color', 'tone']);

  function onRightInput(e) {
    const target = e.target;
    if (!target.matches('[data-field]')) return;
    const field = target.dataset.field;
    if (['select', 'startAbility', 'requires', 'optional', 'gate', 'kind', 'region', 'type', 'room', 'tone', 'dir', 'startRoom', 'goalRoom'].includes(field)) return;
    beforeEdit();
    if (!applyField(field, target.value, target)) return;
    markDirty();
    if (!NON_STRUCTURAL_FIELDS.has(field)) {
      app.analysis = MV.analyze(app.project);
      updateStatus();
      renderRegionList();
      if (app.rightTab === 'progress') renderProgress();
    } else {
      if (field === 'tone' || field === 'color') renderRegionList();
      if (field === 'title') {
        updateHeader();
        const titleEl = els.rightBody.querySelector('.insp-title');
        if (titleEl) titleEl.textContent = app.project.meta.title;
      }
    }
    scheduleRender();
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
    /* Text / number / color fields already commit on input; their change
       event fires on blur and must not re-render the panel under the cursor. */
    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
      const type = target.type;
      if (type !== 'checkbox' && type !== 'radio') return;
    }
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
      if (field === 'title') { app.project.meta.title = value || L('未命名路线', 'Untitled Route'); return true; }
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
      if (field === 'name') { room.name = value || L('未命名房间', 'Untitled Room'); return true; }
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
      if (field === 'name') { item.name = value || L('未命名物品', 'Untitled Item'); return true; }
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
      if (field === 'name') { region.name = value || L('未命名区域', 'Untitled Region'); return true; }
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
    else if (action === 'set-current-region') { app.currentRegion = app.selection.id; renderRegionList(); persistUI(); toast(L('当前区域已切换', 'Current region changed')); }
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
          return `<button class="tl-item" data-select-room="${esc(entry.roomId)}" title="${L('定位', 'Focus')} ${esc(room ? room.name : entry.roomId)}">
            <span>${esc(entry.name)}</span>
            <span class="tl-room">${esc(room ? room.name : entry.roomId)}</span>
            ${entry.optional ? '<span class="tl-unlock">OPT</span>' : ''}
          </button>`;
        }).join('')}
        ${unlocks ? `<div class="tl-unlocks">${unlocks}</div>` : ''}
      </div>`;
    }).join('') : `<div class="hint-line">${L('还没有可收集的道具。放置能力道具、钥匙或 Boss 后会生成时间轴。', 'No collectible items yet. Place ability items, keys or bosses to generate a timeline.')}</div>`;

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
      <thead><tr><th>${L('门锁', 'Gate')}</th><th>${L('可通行 / 总数', 'Passable / total')}</th></tr></thead>
      <tbody>${a.gateStats.map(gate => `<tr class="${gate.open === gate.total ? '' : 'is-locked'}"><td>${gate.code} · ${esc(gate.name)}</td><td>${gate.open} / ${gate.total}</td></tr>`).join('')}</tbody>
    </table>` : `<div class="hint-line">${L('还没有连接。', 'No links yet.')}</div>`;

    const pathHTML = a.path.length ? a.path.map((roomId, i) => {
      const room = roomById[roomId];
      return `<button class="path-row" data-select-room="${esc(roomId)}"><span class="pi">${String(i + 1).padStart(2, '0')}</span><span>${esc(room ? room.name : roomId)}</span></button>`;
    }).join('') : `<div class="hint-line">${L('终点不可达或尚未设置终点。', 'The goal is unreachable or not set.')}</div>`;

    const warningsHTML = ordered.length ? ordered.map(w => `<div class="warn-card is-${w.level}">
      <div class="w-head">${w.level === 'error' ? 'ERROR' : (w.level === 'warn' ? 'WARNING' : 'INFO')} / ${esc(w.title)}</div>
      <div>${esc(w.text)}</div>
    </div>`).join('') : `<div class="warn-card is-info"><div class="w-head">INFO / ${L('结构检查', 'STRUCTURE CHECK')}</div><div>${L('未发现结构性问题。', 'No structural issues found.')}</div></div>`;

    els.rightBody.innerHTML = `
      <div class="progress-status ${a.goalReached ? 'is-ok' : 'is-bad'}">
        <div class="ps-label">ROUTE STATUS</div>
        <div class="ps-value">${a.goalReached ? L('路线闭合', 'Route Closed') : L('路线未闭合', 'Route Open')}</div>
        <div class="ps-sub">${a.goalReached
          ? L('终点可达 · 主线 ' + a.path.length + ' 个房间 · ' + (a.goalReachedStep + 1) + ' 个阶段', 'Goal reachable · ' + a.path.length + ' rooms on the main path · ' + (a.goalReachedStep + 1) + ' phases')
          : L('从起点无法抵达终点，见下方警告。', 'The goal cannot be reached from the start. See warnings below.')}</div>
      </div>
      <div class="stat-grid">
        <div class="stat-cell"><div class="s-label">REACHABLE ROOMS</div><div class="s-value">${a.stats.reachableRooms}<span style="font-size:calc(11px * var(--font-scale));color:var(--ink-4)"> / ${a.stats.rooms}</span></div><div class="bar"><i style="width:${a.stats.rooms ? a.stats.reachableRooms / a.stats.rooms * 100 : 0}%"></i></div></div>
        <div class="stat-cell"><div class="s-label">OPEN GATES</div><div class="s-value">${a.openCount}<span style="font-size:calc(11px * var(--font-scale));color:var(--ink-4)"> / ${a.totalLinks}</span></div><div class="bar"><i style="width:${a.totalLinks ? a.openCount / a.totalLinks * 100 : 0}%"></i></div></div>
        <div class="stat-cell"><div class="s-label">KEYS</div><div class="s-value">${a.keys}<span style="font-size:calc(11px * var(--font-scale));color:var(--ink-4)"> / ${a.keysTotal}</span></div><div class="bar"><i style="width:${a.keysTotal ? a.keys / a.keysTotal * 100 : 0}%"></i></div></div>
        <div class="stat-cell"><div class="s-label">ACQUIRED</div><div class="s-value">${a.stats.collectedItems}<span style="font-size:calc(11px * var(--font-scale));color:var(--ink-4)"> / ${a.stats.items}</span></div><div class="bar"><i style="width:${a.stats.items ? a.stats.collectedItems / a.stats.items * 100 : 0}%"></i></div></div>
      </div>
      <div class="section-label">${L('警告', 'Warnings')}</div>
      <div class="warn-list">${warningsHTML}</div>
      <div class="section-label">${L('进度时间轴', 'Progression Timeline')}</div>
      <div class="timeline">${timelineHTML}</div>
      <div class="section-label">${L('区域覆盖', 'Region Coverage')}</div>
      <div class="region-coverage">${regionHTML || `<div class="hint-line">${L('没有区域。', 'No regions.')}</div>`}</div>
      <div class="section-label">${L('门锁统计', 'Gate Stats')}</div>
      ${gateHTML}
      <div class="section-label">${L('主线路径', 'Main Path')}</div>
      <div class="path-list">${pathHTML}</div>
      <div class="section-label">${L('显示', 'Display')}</div>
      <div class="toggle-line"><span>${L('主线高亮', 'Main path')}</span><label class="check-field"><input type="checkbox" data-progress-layer="path" ${app.layers.path ? 'checked' : ''}><span>${L('显示', 'Show')}</span></label></div>
      <div class="toggle-line"><span>${L('阶段着色', 'Phase colors')}</span><label class="check-field"><input type="checkbox" data-progress-layer="phases" ${app.layers.phases ? 'checked' : ''}><span>${L('显示', 'Show')}</span></label></div>
      <div class="toggle-line"><span>${L('房间名称', 'Room names')}</span><label class="check-field"><input type="checkbox" data-progress-layer="names" ${app.layers.names ? 'checked' : ''}><span>${L('显示', 'Show')}</span></label></div>
      <div class="btn-row"><button class="btn btn-ghost btn-wide" data-action="focus-goal">${L('定位终点房间', 'Focus Goal Room')}</button></div>
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
      const mp1NamesEn = {
        missile: 'Missile Launcher', iceBeam: 'Ice Beam', waveBeam: 'Wave Beam', plasmaBeam: 'Plasma Beam',
        morphBall: 'Morph Ball', bomb: 'Morph Ball Bomb', boostBall: 'Boost Ball', spiderBall: 'Spider Ball',
        grappleBeam: 'Grapple Beam', powerBomb: 'Power Bomb', scanVisor: 'Scan Visor',
        thermalVisor: 'Thermal Visor', xRayVisor: 'X-Ray Visor', variaSuit: 'Varia Suit',
        gravitySuit: 'Gravity Suit', phazonSuit: 'Phazon Suit'
      };
      const reqName = id => {
        if (MV.getLang() === 'en' && mp1NamesEn[id]) return mp1NamesEn[id];
        const found = MV.abilityName(app.project, id);
        return found === id ? (mp1Names[id] || id) : found;
      };
      const reqs = g.requires.length
        ? g.requires.map(reqName).join(' + ')
        : (g.keyReq ? L(g.keyReq + ' 把钥匙', g.keyReq + ' keys') : L('无 / 自定义', 'None / custom'));
      return `<tr><td>${g.code} · ${g.name}</td><td>${esc(reqs)}</td><td>${esc(g.desc)}</td></tr>`;
    }).join('');

    if (MV.getLang() === 'en') {
      els.rightBody.innerHTML = `<div class="guide">
      <h1>Design Guide</h1>
      <div class="guide-kicker">METROIDVANIA / LEVEL ROUTE NOTES / MP-01</div>

      <section>
        <h2>00 / Define the “Lock” First</h2>
        <p>A Metroidvania route is defined less by room count than by the <strong>causal chain of locks and keys</strong>. Every gate should answer three questions: what ability does it require, where is that ability obtained, and which gates must be passed to obtain it? Route Forge repeats this reasoning automatically until the route closes or deadlocks.</p>
        <div class="guide-quote">A good Metroidvania map keeps the player moving between “I remember a door I couldn't open” and “I can open it now.”</div>
      </section>

      <section>
        <h2>01 / Anatomy of Metroid Prime</h2>
        <div class="guide-card"><h3>Region ring and hub</h3><p>Tallon Overworld holds the landing site and the player's base. Magmoor Caverns is the map's subway, connecting every region except Impact Crater, and contains no boss. Chozo Ruins sits to the northeast; Phendrana Drifts can only be reached through Magmoor; Phazon Mines is the three-level industrial endgame in the south; Impact Crater is sealed by twelve Chozo Artifacts. This “hub + radial regions + isolated endgame” structure is the skeleton of preset 01.</p></div>
        <div class="guide-card"><h3>Gate matrix</h3><p>MP1 encodes abilities directly into doors: blue doors, Missile Doors, Ice, Wave and Plasma Doors, plus Morph Ball tunnels, Bomb Slots, Boost Ball half-pipes, Spider Ball tracks and Grapple Points. The gate presets in the inspector are exactly this matrix; any link can carry additional custom ability requirements.</p></div>
        <div class="guide-card"><h3>Spatial locks, not just doors</h3><p>The Morph Ball turns room geometry into a key: vents, half-pipes, magnetic tracks and Bomb Slots are all spatial expressions of the same ability set. This matters in 3D—the same lock may become a shaft, a rail, or a slope that requires a boost.</p></div>
        <div class="guide-card"><h3>Visors and soft gates</h3><p>Thermal Visor, X-Ray Visor, Varia Suit, Gravity Suit and Phazon Suit turn “can't see it,” “can't cross it” and “can't survive it” into gates. They are softer than hard doors and are ideal for creating the backtracking moment of “so this was passable all along.” The preset keeps key nodes such as Thermal Visor for Thardus, X-Ray Visor for the final battle, and Gravity Suit for the sunken frigate.</p></div>
        <div class="guide-card"><h3>Artifact budget</h3><p>The twelve Artifacts are a global key budget rather than single-use keys. They turn the endgame from “fight one more boss” into “re-understand the entire map.” The progress panel shows collected keys and the seal requirement in real time, and reports an error when the budget is insufficient.</p></div>
        <div class="guide-card"><h3>The one-way prologue</h3><p>Orpheon is a playable prologue with no return after escape. The preset expresses it as a one-way link. One-way edges are essential to route design: they separate the starting region from the backtrackable map in logic.</p></div>
      </section>

      <section>
        <h2>02 / How This Tool Supports 3D Metroidvania</h2>
        <ul>
          <li><strong>2D route</strong> answers “in what order does the player acquire what”—useful for lock chains, key budgets and optional-content density.</li>
          <li><strong>3D map</strong> answers “what do these rooms look like and how do they connect vertically,” using MP1's massing language: rooms are blocks, links are solid corridors and shafts, regions are base plates.</li>
          <li><strong>Phase colors</strong> project reachability results back onto the map so the early, mid and late game are visible at a glance.</li>
          <li><strong>3D corridors</strong>: normal corridors use the target region color, locked corridors use the gate color; shafts model regional elevators and door frames mark connection points.</li>
          <li><strong>Semantic color</strong>: region, phase, gate and item colors each carry different information and can be customized in the palette panel.</li>
          <li><strong>Region filter</strong>: show one or more regions; filtering only affects display, while analysis and route validation still use the full project.</li>
          <li><strong>Main path highlight</strong> shows the shortest-path skeleton. It does not replace the full route, but quickly exposes “main path too long / too short / endgame region revealed too early.”</li>
          <li><strong>Gate stats</strong> reveal whether gate types are too uniform. A map made entirely of Missile Doors flattens the ability rhythm.</li>
          <li><strong>Ability lock tree</strong> orders abilities, keys, gates and later items by acquisition step to inspect ability rhythm, key budget and soft locks.</li>
        </ul>
      </section>

      <section>
        <h2>03 / Ability Lock Tree</h2>
        <p>The lock tree arranges “ability / key → gate → later item” vertically by <strong>acquisition step</strong>. Top to bottom is progression order: each row is a phase, with abilities, keys, bosses or optional upgrades above and the gates unlocked in that step below.</p>
        <div class="guide-card"><h3>How to read it</h3><p>Every gate card states “← requires / → leads to,” for example “← Varia Suit → Magmoor Lake.” The top holds the start room and global key pool; STEP 00 through the endgame advance downward. Dashed cards are optional upgrades; cards with a vertical line are on the main path.</p></div>
        <div class="guide-card"><h3>How to use it</h3><p>Click a card to inspect the matching item or link. Double-click a card or press F to switch to 2D and focus it. Drag to scroll through later steps, use the wheel to zoom, and press FIT to see the whole timeline. MAIN dims everything outside the main path so you can check ability and gate rhythm.</p></div>
      </section>

      <section>
        <h2>04 / Design Checklist</h2>
        <ul>
          <li>Does the starting region contain a “safe room” that teaches controls and map language?</li>
          <li>Does the player gain at least one movement-changing ability in the first 15 minutes?</li>
          <li>Does each region have a memorable landmark room or visual motif?</li>
          <li>Is there at least one shortcut or foreshadowing moment that is seen early and used later?</li>
          <li>Is there a save point, supply cache or safe room before each boss?</li>
          <li>Are endgame keys spread across different regions, forcing the player to revisit the whole map?</li>
          <li>Does the shortest main path avoid becoming a linear “visit every room” checklist?</li>
          <li>Do optional upgrades reward exploration without becoming mandatory?</li>
          <li>Are one-way doors used for tension rather than for creating soft locks?</li>
        </ul>
      </section>

      <section>
        <h2>05 / Gate Reference</h2>
        <table class="matrix">
          <thead><tr><th>Type</th><th>Requirement</th><th>Notes</th></tr></thead>
          <tbody>${gateRows}</tbody>
        </table>
      </section>

      <section>
        <h2>06 / Sources & Notes</h2>
        <p>Presets are <strong>structured references</strong> assembled from public maps, walkthroughs and wikis. They demonstrate lock chains and region relationships rather than reproducing an official map one-to-one. Room coordinates, some item placements and gate directions are simplified for design demonstration.</p>
        <div class="guide-sources">
          ${sources.map(src => `<a href="${esc(src[1])}" target="_blank" rel="noreferrer">${esc(src[0])} ↗</a>`).join('')}
        </div>
      </section>
    </div>`;
      return;
    }

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
          <li><strong>3D 地图</strong>回答“这些房间长什么样、如何垂直连接”，参考 MP1 地图的体块化读法：房间是块，连接是实体走廊与竖井，区域是底板。</li>
          <li><strong>阶段着色</strong>把可达性分析的结果投射回地图，让你一眼看到前中后期的空间分布。</li>
          <li><strong>3D 通道</strong>：普通走廊使用目标区域色，带门锁的走廊使用门锁色；竖井建模区域升降机，门框表示连接点。</li>
          <li><strong>语义配色</strong>：区域色、阶段色、门锁色和道具色分别承载不同信息，可在配色面板中自定义。</li>
          <li><strong>区域过滤</strong>：可只显示一个或多个区域；过滤只影响地图显示，分析与路线判定仍基于完整项目。</li>
          <li><strong>主线高亮</strong>用最短路径给出终局路线骨架；它不替代完整流程，但能快速暴露“主路过长 / 主路过短 / 终局区域太早暴露”等问题。</li>
          <li><strong>门锁统计</strong>检查门锁类型是否过于单一。全图都是导弹门，会让能力节奏变得扁平。</li>
          <li><strong>能力锁树</strong>按获得步骤纵向排列能力、钥匙、门锁与后续道具，专门检查能力节奏、钥匙预算和软锁。</li>
        </ul>
      </section>

      <section>
        <h2>03 / 能力锁树</h2>
        <p>能力锁树把“能力 / 钥匙 → 门锁 → 后续道具”按<strong>获得步骤</strong>纵向排列。从上到下就是推进顺序：每一行是一个阶段，上方卡片是本步获得的能力、钥匙、Boss 或可选强化，下方带颜色的卡片是本步解锁的门锁。</p>
        <div class="guide-card"><h3>怎么读</h3><p>每张门锁卡都直接写出“← 需要什么 / → 通向哪里”，例如“← 瓦利亚服 → 岩浆湖”。顶部是起始房间与全局钥匙池；下方 STEP 00 到终局按时间推进。虚线卡片是可选强化，带竖线的是主线内容。</p></div>
        <div class="guide-card"><h3>怎么用</h3><p>单击卡片在右侧检查器里查看对应物品或连接；双击卡片或按 F 切到 2D 并定位。拖动可上下查看后续步骤，滚轮缩放，FIT 查看完整时间线。用 MAIN 压暗非主线，检查能力与门锁的节奏。</p></div>
      </section>

      <section>
        <h2>04 / 设计检查表</h2>
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
        <h2>05 / 门锁速查</h2>
        <table class="matrix">
          <thead><tr><th>类型</th><th>需求</th><th>说明</th></tr></thead>
          <tbody>${gateRows}</tbody>
        </table>
      </section>

      <section>
        <h2>06 / 参考与说明</h2>
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
    toast(L('已撤销', 'Undone'));
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
    toast(L('已重做', 'Redone'));
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
      if (roomCount) { toast(L('该区域还有房间，先清空再删除', 'This region still has rooms. Empty it before deleting.'), true); return; }
      if (app.project.regions.length <= 1) { toast(L('至少保留一个区域', 'Keep at least one region'), true); return; }
      snapshot();
      app.project.regions = app.project.regions.filter(region => region.id !== sel.id);
      app.hiddenRegions.delete(sel.id);
      app.selection = null;
      app.currentRegion = app.project.regions[0].id;
      app.analysis = MV.analyze(app.project);
      markDirty();
      refreshAll();
      toast(L('区域已删除', 'Region deleted'));
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
      toast(L('房间已删除（可撤销）', 'Room deleted (undoable)'));
      return;
    }
    if (sel.type === 'link') {
      snapshot();
      app.project.links = app.project.links.filter(link => link.id !== sel.id);
      app.selection = null;
      app.analysis = MV.analyze(app.project);
      markDirty();
      refreshAll();
      toast(L('连接已删除', 'Link deleted'));
      return;
    }
    if (sel.type === 'item') {
      snapshot();
      app.project.items = app.project.items.filter(item => item.id !== sel.id);
      app.selection = null;
      app.analysis = MV.analyze(app.project);
      markDirty();
      refreshAll();
      toast(L('物品已删除', 'Item deleted'));
    }
  }

  function duplicateRoom() {
    if (!app.selection || app.selection.type !== 'room') return;
    const source = MV.findRoom(app.project, app.selection.id);
    if (!source) return;
    snapshot();
    const room = MV.clone(source);
    room.id = MV.uid('room');
    room.name = source.name + L(' 副本', ' Copy');
    room.x = source.x + 28;
    room.y = source.y + 28;
    app.project.rooms.push(room);
    const items = app.project.items.filter(item => item.room === source.id);
    items.forEach(item => {
      const copy = MV.clone(item);
      copy.id = MV.uid('item');
      copy.room = room.id;
      app.project.items.push(copy);
    });
    app.selection = { type: 'room', id: room.id };
    app.rightTab = 'inspect';
    app.currentRegion = room.region;
    app.analysis = MV.analyze(app.project);
    markDirty();
    refreshAll();
    toast(L('房间已复制', 'Room duplicated') + (items.length ? L('（含 ' + items.length + ' 个物品）', ' (with ' + items.length + ' items)') : '') + L('（连接不复制）', ' (links not copied)'));
  }

  function copyRoomSelection() {
    if (!app.selection || app.selection.type !== 'room') {
      toast(L('请先选择一个房间再复制', 'Select a room before copying'), true);
      return;
    }
    const room = MV.findRoom(app.project, app.selection.id);
    if (!room) return;
    roomClipboard = {
      room: MV.clone(room),
      items: MV.clone(app.project.items.filter(item => item.room === room.id)),
      pastes: 0
    };
    toast(L('已复制房间', 'Room copied') + (roomClipboard.items.length ? L('与 ' + roomClipboard.items.length + ' 个物品', ' with ' + roomClipboard.items.length + ' items') : '') + L('（Ctrl+V 粘贴）', ' (Ctrl+V to paste)'));
  }

  function pasteRoomClipboard() {
    if (!roomClipboard) {
      toast(L('剪贴板为空：先选中房间并按 Ctrl+C', 'Clipboard is empty. Select a room and press Ctrl+C.'), true);
      return;
    }
    const source = roomClipboard.room;
    const regionId = app.project.regions.some(region => region.id === source.region)
      ? source.region
      : (app.project.regions.find(region => region.id === app.currentRegion) || app.project.regions[0]).id;
    snapshot();
    const offset = 30 * (++roomClipboard.pastes);
    const room = MV.clone(source);
    room.id = MV.uid('room');
    room.name = source.name + L(' 副本', ' Copy');
    room.region = regionId;
    room.x = source.x + offset;
    room.y = source.y + offset;
    app.project.rooms.push(room);
    roomClipboard.items.forEach(item => {
      const copy = MV.clone(item);
      copy.id = MV.uid('item');
      copy.room = room.id;
      app.project.items.push(copy);
    });
    app.selection = { type: 'room', id: room.id };
    app.rightTab = 'inspect';
    app.currentRegion = regionId;
    app.analysis = MV.analyze(app.project);
    markDirty();
    refreshAll();
    toast(L('已粘贴房间', 'Room pasted') + (roomClipboard.items.length ? L('与 ' + roomClipboard.items.length + ' 个物品', ' with ' + roomClipboard.items.length + ' items') : '') + L('（连接不复制）', ' (links not copied)'));
  }

  function nudgeSelection(dx, dy) {
    if (!app.selection || app.selection.type !== 'room' || app.mode === 'tree') return;
    const room = MV.findRoom(app.project, app.selection.id);
    if (!room) return;
    beforeEdit();
    room.x += dx;
    room.y += dy;
    const xInput = els.rightBody.querySelector('[data-field="x"]');
    const yInput = els.rightBody.querySelector('[data-field="y"]');
    if (xInput) xInput.value = room.x;
    if (yInput) yInput.value = room.y;
    hideTooltip();
    markDirty();
    scheduleRender();
    persistUI();
  }

  function addRegion() {
    snapshot();
    const index = app.project.regions.length;
    const region = {
      id: MV.uid('region'),
      name: L('新区域 ', 'New Region ') + (index + 1),
      code: 'Z' + String(index + 1).padStart(2, '0'),
      tone: index % MV.REGION_TONES.length,
      color: MV.REGION_COLORS[index % MV.REGION_COLORS.length]
    };
    app.project.regions.push(region);
    app.currentRegion = region.id;
    app.selection = { type: 'region', id: region.id };
    app.rightTab = 'inspect';
    app.analysis = MV.analyze(app.project);
    markDirty();
    refreshAll();
    toast(L('区域已添加', 'Region added'));
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
      toast(L('当前已显示全部区域', 'All regions are already visible'));
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
    toast(L('已显示全部区域', 'All regions shown'));
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
    toast(L('仅显示区域：', 'Showing only region: ') + region.name);
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
    toast(L('布局已舒展（可撤销）', 'Layout spread (undoable)'));
  }

  function addItemToRoom(roomId) {
    const room = MV.findRoom(app.project, roomId);
    if (!room) { toast(L('请先选择一间房', 'Select a room first'), true); return; }
    snapshot();
    const kind = app.itemKind;
    let name = L('新物品', 'New Item');
    let grants = '';
    let optional = false;
    if (kind === 'ability') {
      const granted = new Set(app.project.items.filter(item => item.grants).map(item => item.grants));
      const ability = app.project.abilities.find(a => !granted.has(a.id));
      if (ability) {
        name = MV.abilityName(app.project, ability.id) + L('道具', ' Item');
        grants = ability.id;
      } else {
        name = L('能力道具 ', 'Ability Item ') + (app.project.items.filter(item => item.kind === 'ability').length + 1);
      }
    } else if (kind === 'key') {
      name = L('钥匙 ', 'Key ') + (app.project.items.filter(item => item.kind === 'key').length + 1);
    } else if (kind === 'upgrade') {
      name = L('可选强化 ', 'Optional Upgrade ') + (app.project.items.filter(item => item.kind === 'upgrade').length + 1);
      optional = true;
    } else if (kind === 'boss') {
      name = L('Boss ', 'Boss ') + (app.project.items.filter(item => item.kind === 'boss').length + 1);
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
    app.rightTab = 'inspect';
    app.tool = 'select';
    app.analysis = MV.analyze(app.project);
    markDirty();
    updateToolUI();
    refreshAll();
    toast(L('已添加：', 'Added: ') + item.name);
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
    toast(L('连接方向已反转', 'Link direction reversed'));
  }

  function addAbility() {
    const input = document.getElementById('newAbilityName');
    if (!input) return;
    const name = input.value.trim();
    if (!name) { toast(L('请输入能力名称', 'Enter an ability name'), true); return; }
    snapshot();
    const id = 'ab_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
    app.project.abilities.push({ id, name });
    app.analysis = MV.analyze(app.project);
    markDirty();
    refreshAll();
    toast(L('能力已添加：', 'Ability added: ') + name);
  }

  function deleteAbility(id) {
    if (!id) return;
    const usedByItem = app.project.items.some(item => item.grants === id);
    const usedByLink = app.project.links.some(link => (link.requires || []).includes(id));
    const starting = app.project.startAbilities.includes(id);
    if (usedByItem || usedByLink || starting) {
      toast(L('该能力仍被道具 / 门锁 / 起始能力引用，无法删除', 'This ability is still used by items, gates or starting abilities and cannot be deleted'), true);
      return;
    }
    snapshot();
    app.project.abilities = app.project.abilities.filter(ability => ability.id !== id);
    app.analysis = MV.analyze(app.project);
    markDirty();
    refreshAll();
    toast(L('能力已删除', 'Ability deleted'));
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
      select: L('选择：单击房间，拖动移动，拖角缩放', 'Select: click a room, drag to move, drag a corner to resize'),
      room: L('房间：在空白处拖出房间，自动归入当前区域', 'Room: drag on empty space to create a room in the current region'),
      connect: L('连接：依次点击两个房间创建门锁连接', 'Connect: click two rooms in sequence to create a gate link'),
      item: L('物品：点击房间放置「', 'Item: click a room to place “') + kindName + L('」', '”'),
      pan: L('平移：拖动平移画布，滚轮缩放', 'Pan: drag to move the canvas, wheel to zoom')
    };
    els.toolHint.textContent = hints[app.tool] || hints.select;
    if (app.tool === 'connect') {
      const from = app.connectFrom ? MV.findRoom(app.project, app.connectFrom) : null;
      els.connectHint.hidden = false;
      els.connectHint.textContent = from
        ? L('起点：' + from.name + ' — 点击目标房间（Esc 取消）', 'From: ' + from.name + ' — click the target room (Esc to cancel)')
        : L('连接模式：点击第一个房间', 'Connect mode: click the first room');
    } else {
      els.connectHint.hidden = true;
    }
    const kindLabel = app.itemKind === 'ability' ? L('能力', 'Ability') : app.itemKind === 'key' ? L('钥匙', 'Key') : app.itemKind === 'upgrade' ? L('强化', 'Upgrade') : 'Boss';
    els.itemKindSeg.title = L('当前放置：', 'Placing: ') + kindLabel;
    updateCursor();
  }

  function updateCursor() {
    let cursor = 'default';
    if (app.mode === '2d') {
      if (app.spaceDown) cursor = app.drag ? 'grabbing' : 'grab';
      else if (app.tool === 'room' || app.tool === 'connect') cursor = 'crosshair';
      else if (app.tool === 'item') cursor = 'copy';
      else if (app.tool === 'pan') cursor = 'grab';
    } else if (app.mode === 'tree') {
      cursor = app.treeDrag ? 'grabbing' : 'grab';
    }
    els.canvas2d.style.cursor = cursor;
    els.canvas3d.style.cursor = 'default';
    els.canvasTree.style.cursor = cursor;
  }

  function applyTheme(theme, persist) {
    app.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = app.theme;
    MV.setCanvasTheme(app.theme);
    if (els.themeBtn) {
      const label = MV.L(
        app.theme === 'light' ? '切换到黑夜模式' : '切换到白天模式',
        app.theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'
      );
      els.themeBtn.title = label;
      els.themeBtn.setAttribute('aria-label', label);
    }
    if (app.view2d && app.view3d) scheduleRender();
    if (persist) persistUI();
  }

  function applyLanguage(code, persist) {
    app.lang = code === 'en' ? 'en' : 'zh';
    MV.setLang(app.lang);
    MV.applyI18n();
    app.analysis = MV.analyze(app.project);
    applyTheme(app.theme, false);
    updateToolUI();
    refreshAll();
    if (persist) {
      persistUI();
      toast(MV.L('界面语言：中文', 'Interface language: English'));
    }
  }

  function applyFontScale(scale, persist) {
    const value = MV.clamp(Number(scale) || 1.15, 1, 1.5);
    app.fontScale = value;
    document.documentElement.style.setProperty('--font-scale', String(value));
    MV.setFontScale(value);
    document.querySelectorAll('[data-font-scale]').forEach(btn => {
      btn.classList.toggle('is-active', Math.abs(Number(btn.dataset.fontScale) - value) < 0.01);
    });
    if (app.view2d && app.view3d) scheduleRender();
    if (persist) {
      persistUI();
      toast(L('字体大小：', 'Font size: ') + Math.round(value * 100) + '%');
    }
  }

  function switchMode(mode) {
    if (app.mode === mode) return;
    app.mode = mode;
    app.hover = null;
    app.treeHover = null;
    app.lastTreeClick = null;
    hideTooltip();
    applyModeUI();
    requestAnimationFrame(() => {
      if (mode === '2d' && !app.fitted2d) fit2DReadable();
      if (mode === '3d' && !app.fitted3d) fit3D();
      if (mode === 'tree' && !app.fittedTree) fitTree(true);
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
    els.stageTree.classList.toggle('is-active', app.mode === 'tree');
    document.documentElement.dataset.mode = app.mode;
    els.statusMode.textContent = app.mode === '2d' ? '2D ROUTE' : (app.mode === '3d' ? '3D MASSING' : 'LOCK TREE');
    const mainBtn = document.querySelector('[data-tree-main]');
    if (mainBtn) mainBtn.classList.toggle('is-active', app.treeMainOnly);
    if (app.mode === '2d') els.toolHint.textContent = L('选择：单击房间，拖动移动，拖角缩放', 'Select: click a room, drag to move, drag a corner to resize');
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

  function fitTree(readable) {
    const W = els.canvasTree.clientWidth;
    const H = els.canvasTree.clientHeight;
    if (!W || !H) {
      app.fittedTree = false;
      return;
    }
    const graph = MV.buildLockTree(app.project, app.analysis);
    const cam = MV.RenderTree.fitCamera(graph, W, H, 60);
    const minZoom = W >= 700 ? 0.6 : 0.45;
    if (readable && cam.zoom < minZoom) {
      cam.zoom = minZoom;
      cam.x = graph.bounds.minX + (W / 2 - 40) / cam.zoom;
      cam.y = graph.bounds.minY + (H / 2 - 26) / cam.zoom;
    }
    app.viewTree.cam = cam;
    app.fittedTree = true;
    scheduleRender();
    updateStatusZoom();
    persistUI();
  }

  function fitAll() {
    if (app.mode === 'tree') {
      fitTree(false);
    } else if (app.mode === '2d') {
      fit2D();
      app.fitted3d = false;
    } else {
      fit3D();
      app.fitted2d = false;
    }
    toast(L('视图已适应全部内容', 'View fitted to all content'));
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
    if (app.mode === 'tree') {
      if (!sel) { fitTree(false); return; }
      switchMode('2d');
      requestAnimationFrame(() => focusSelection());
      return;
    }
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
    if (!rooms.length) { toast(L('该区域没有房间', 'This region has no rooms'), true); return; }
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
    if (!app.snap) return value;
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
        name: L('新房间 ', 'New Room ') + index,
        region: regionId,
        x: snap(rect.x), y: snap(rect.y),
        w: Math.max(MV.ROOM_MIN_W, snap(rect.w)),
        h: Math.max(MV.ROOM_MIN_H, snap(rect.h)),
        type: 'normal',
        height: 38, elev: 0, depth: 38, note: ''
      };
      app.project.rooms.push(room);
      app.selection = { type: 'room', id: room.id };
      app.rightTab = 'inspect';
      app.tool = 'select';
      app.analysis = MV.analyze(app.project);
      markDirty();
      updateToolUI();
      refreshAll();
      toast(L('房间已创建', 'Room created'));
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
      app.rightTab = 'inspect';
      updateToolUI();
      refreshAll();
      toast(L('这两个房间之间已有连接', 'A link already exists between these rooms'));
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
    app.rightTab = 'inspect';
    app.analysis = MV.analyze(app.project);
    markDirty();
    updateToolUI();
    refreshAll();
    toast(L('连接已创建，可在检查器中设置门锁', 'Link created. Set its gate in the inspector.'));
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
        <div class="tt-meta">${esc(gate.name)}${link.keyReq ? ' · ' + L('钥匙 ', 'Keys ') + link.keyReq : ''}${reqs.length ? ' · ' + esc(reqs.join(' + ')) : ''}</div>`;
    } else if (hit.type === 'item') {
      const item = MV.findItem(app.project, hit.id);
      if (!item) return hideTooltip();
      const room = MV.findRoom(app.project, item.room);
      html = `<div class="tt-kicker">${MV.itemKindById(item.kind).code}${item.optional ? ' / OPTIONAL' : ''}</div>
        <div class="tt-title">${esc(item.name)}</div>
        <div class="tt-meta">${esc(room ? room.name : item.room)}${item.grants ? ' · ' + L('授予 ', 'Grants ') + esc(MV.abilityName(app.project, item.grants)) : ''}</div>`;
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
      toast(L('已保存到浏览器本地', 'Saved to browser storage'));
    } else {
      toast(L('保存失败：浏览器存储不可用', 'Save failed: browser storage is unavailable'), true);
    }
    persistUI();
  }

  function exportJSON() {
    const name = MV.slugify(app.project.meta.title || 'route') + '.routeforge.json';
    MV.download(name, JSON.stringify(app.project, null, 2), 'application/json');
    toast(L('已导出 JSON 存档', 'JSON save exported'));
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
          L('导入存档', 'Import Save'),
          L('将载入「' + project.meta.title + '」：' + counts.regions + ' 个区域 / ' + counts.rooms + ' 个房间。当前项目会先备份到浏览器。',
            'Load “' + project.meta.title + '”: ' + counts.regions + ' regions / ' + counts.rooms + ' rooms. The current project will be backed up in the browser first.'),
          () => replaceProject(project),
          L('载入存档', 'Load Save')
        );
      } catch (err) {
        console.error(err);
        toast(L('导入失败：不是有效的 Route Forge JSON', 'Import failed: not a valid Route Forge JSON file'), true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function exportPNG() {
    MV.Render2D.exportPNG(visibleProject(), app.view2d).then(result => {
      const name = MV.slugify(app.project.meta.title || 'route') + '-route.png';
      MV.download(name, result.blob);
      toast(L('路线 PNG 已导出', 'Route PNG exported'));
    }).catch(err => {
      console.error(err);
      toast(L('PNG 导出失败', 'PNG export failed'), true);
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
    roomClipboard = null;
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
      app.fittedTree = false;
    } else if (app.mode === '3d') {
      fit3D();
      app.fitted2d = false;
      app.fittedTree = false;
    } else {
      fitTree(true);
      app.fitted2d = false;
      app.fitted3d = false;
    }
    refreshAll();
    persistUI();
    toast(L('已载入：', 'Loaded: ') + app.project.meta.title);
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
        <input type="color" data-phase-color="${index}" value="${esc(color)}" aria-label="${L('阶段色 ', 'Phase color ')}${index + 1}">
        <span>${String(index + 1).padStart(2, '0')}</span>
      </label>`).join('');
    const regionInputs = app.project.regions.map(region => `
      <div class="region-color-row">
        <span class="region-color-name"><i style="background:${MV.regionColor(region, 'color')}"></i>${esc(region.name)}</span>
        <input type="color" data-region-color="${esc(region.id)}" value="${esc(region.color)}" aria-label="${esc(region.name)} ${L('颜色', 'color')}">
      </div>`).join('');
    const gateLegend = MV.GATE_TYPES.filter(g => g.id !== 'open').map(g => `
      <span class="gate-color-chip"><i style="background:${g.color}"></i>${g.code} ${esc(g.name)}</span>`).join('');
    openModal(`<div class="modal palette-modal">
      <div class="modal-head">
        <div>
          <div class="modal-kicker">PALETTE / ${L('配色', 'COLOR')}</div>
          <h2>${L('彩色模式与自定义颜色', 'Color Mode & Custom Palette')}</h2>
          <p>${L('颜色不是装饰：区域、阶段、门锁和道具各自有语义。单色模式保留蓝图风格。', 'Color is semantic: regions, phases, gates and items each carry different meaning. Monochrome keeps the blueprint look.')}</p>
        </div>
        <button class="modal-close" data-close aria-label="${L('关闭', 'Close')}">×</button>
      </div>
      <div class="modal-body">
        <div class="section-label">${L('显示模式', 'Display Mode')}</div>
        <div class="segmented palette-mode">
          <button data-color-mode="color" class="${app.colorMode === 'color' ? 'is-active' : ''}">${L('彩色', 'Color')}</button>
          <button data-color-mode="mono" class="${app.colorMode === 'mono' ? 'is-active' : ''}">${L('单色', 'Mono')}</button>
        </div>
        <p class="hint-line">${L('彩色模式：阶段色带用于房间与 3D 体块，区域色用于边界/顶边/标签，门锁与道具使用各自的语义色。单色模式只使用主题灰度。', 'Color mode: the phase ramp drives rooms and 3D massing, region colors drive borders / top edges / labels, and gates and items use their own semantic colors. Monochrome uses only theme grays.')}</p>

        <div class="section-label">${L('阶段色带', 'Phase Ramp')}</div>
        <div class="phase-preview" id="phasePreview" style="background:${phasePreviewCss(app.project.phaseColors)}"></div>
        <div class="phase-inputs">${phaseInputs}</div>
        <div class="palette-presets">
          ${Object.keys(PHASE_PRESETS).map(key => `<button class="palette-preset" data-phase-preset="${key}"><i style="background:${phasePreviewCss(PHASE_PRESETS[key])}"></i><span>${key === 'spectrum' ? L('光谱', 'Spectrum') : key === 'cool' ? L('冷色', 'Cool') : key === 'warm' ? L('暖色', 'Warm') : key === 'earth' ? L('大地', 'Earth') : L('霓虹', 'Neon')}</span></button>`).join('')}
        </div>

        <div class="section-label">${L('区域颜色', 'Region Colors')}</div>
        <div class="region-color-list">${regionInputs}</div>

        <div class="section-label">${L('门锁颜色', 'Gate Colors')}</div>
        <div class="gate-color-legend">${gateLegend}</div>
        <p class="hint-line">${L('3D 走廊：普通通道使用目标区域色，带门锁的通道使用门锁色；选中房间时，该房间的所有走廊会高亮。', '3D corridors: normal passages use the target region color, gated passages use the gate color. Selecting a room highlights all of its corridors.')}</p>
        <div class="btn-row">
          <button class="btn btn-ghost" data-reset-colors>${L('恢复默认配色', 'Reset Palette')}</button>
        </div>
      </div>
      <div class="modal-foot"><button class="btn btn-primary" data-close>${L('完成', 'Done')}</button></div>
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
          toast(L('配色已恢复默认', 'Palette reset to defaults'));
        });
      }
    });
  }

  function openJumpModal() {
    openModal(`<div class="modal jump-modal">
      <div class="modal-head">
        <div>
          <div class="modal-kicker">JUMP / ${L('快速定位', 'QUICK JUMP')}</div>
          <h2>${L('跳到房间', 'Jump to Room')}</h2>
          <p>${L('按房间名、区域、房间类型或备注搜索。', 'Search by room name, region, room type or note.')}</p>
        </div>
        <button class="modal-close" data-close aria-label="${L('关闭', 'Close')}">×</button>
      </div>
      <div class="modal-body">
        <div class="jump-search">
          <input id="jumpInput" class="jump-input" placeholder="${L('输入房间名 / 区域代码 / 类型 / 备注…', 'Room name / region code / type / note…')}" autocomplete="off" spellcheck="false">
          <span class="jump-count" id="jumpCount"></span>
        </div>
        <div class="jump-list" id="jumpList"></div>
        <p class="hint-line">${L('↑↓ 选择 · Enter 定位 · Esc 关闭', '↑↓ select · Enter jump · Esc close')}</p>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" data-close>${L('关闭', 'Close')}</button></div>
    </div>`, {
      onMount(overlay) {
        const input = overlay.querySelector('#jumpInput');
        const list = overlay.querySelector('#jumpList');
        const count = overlay.querySelector('#jumpCount');
        let results = [];
        let active = 0;

        function collect(query) {
          const q = query.trim().toLowerCase();
          const regionMap = {};
          app.project.regions.forEach(region => { regionMap[region.id] = region; });
          const itemCounts = {};
          app.project.items.forEach(item => { itemCounts[item.room] = (itemCounts[item.room] || 0) + 1; });
          return app.project.rooms.map((room, index) => {
            const region = regionMap[room.region] || null;
            const type = MV.roomTypeById(room.type);
            const hay = [
              room.name, room.note, type.name, type.code,
              region ? region.name : '', region ? region.code : ''
            ].join(' ').toLowerCase();
            let score = 3;
            if (!q) score = 0;
            else if (room.name.toLowerCase().startsWith(q)) score = 0;
            else if (room.name.toLowerCase().includes(q)) score = 1;
            else if (hay.includes(q)) score = 2;
            else return null;
            return { room, region, type, itemCount: itemCounts[room.id] || 0, score, index };
          }).filter(Boolean)
            .sort((a, b) => a.score - b.score || a.index - b.index)
            .slice(0, 80);
        }

        function paint() {
          results = collect(input.value);
          active = MV.clamp(active, 0, Math.max(0, results.length - 1));
          count.textContent = results.length + ' / ' + app.project.rooms.length;
          if (!results.length) {
            list.innerHTML = `<div class="jump-empty">${L('没有匹配的房间', 'No matching rooms')}</div>`;
            return;
          }
          list.innerHTML = results.map((entry, index) => {
            const phase = app.analysis.roomPhase[entry.room.id];
            return `<button class="jump-row ${index === active ? 'is-active' : ''}" data-jump-index="${index}">
              <span class="jr-name">${esc(entry.room.name)}</span>
              <span class="jr-meta">${esc(entry.region ? entry.region.code : '--')} / ${esc(entry.type.code)}</span>
              <span class="jr-meta">${entry.itemCount ? entry.itemCount + ' ITEMS' : ''}${phase != null ? ' · P' + String(phase).padStart(2, '0') : ''}</span>
            </button>`;
          }).join('');
          const activeRow = list.querySelector('.is-active');
          if (activeRow) activeRow.scrollIntoView({ block: 'nearest' });
        }

        function choose(index) {
          const entry = results[index];
          if (!entry) return;
          if (app.hiddenRegions.has(entry.room.region)) {
            app.hiddenRegions.delete(entry.room.region);
            updateStatus();
          }
          closeModal();
          select('room', entry.room.id);
          if (app.mode !== '2d') switchMode('2d');
          requestAnimationFrame(() => focusRoom(entry.room.id));
        }

        input.addEventListener('input', () => {
          active = 0;
          paint();
        });
        input.addEventListener('keydown', e => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            active = Math.min(results.length - 1, active + 1);
            paint();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            active = Math.max(0, active - 1);
            paint();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            choose(active);
          }
        });
        list.addEventListener('click', e => {
          const row = e.target.closest('[data-jump-index]');
          if (row) choose(Number(row.dataset.jumpIndex));
        });
        paint();
        setTimeout(() => input.focus(), 30);
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
        <span class="pc-name">${esc(L(preset.name, preset.nameEn))}</span>
        <span class="pc-desc">${esc(L(preset.desc, preset.descEn))}</span>
        <span class="pc-meta">${counts ? counts.regions + ' REGIONS · ' + counts.rooms + ' ROOMS · ' + counts.items + ' ITEMS' : ''}</span>
      </button>`;
    }).join('');
    openModal(`<div class="modal">
      <div class="modal-head">
        <div>
          <div class="modal-kicker">LEVEL PRESETS / ${L('参考路线', 'REFERENCE ROUTES')}</div>
          <h2>${L('载入一个经典结构', 'Load a Classic Structure')}</h2>
          <p>${L('预设会替换当前项目，并在浏览器中保留一份上一版备份。建议先导出 JSON。', 'Presets replace the current project and keep a backup of the previous version in the browser. Exporting JSON first is recommended.')}</p>
        </div>
        <button class="modal-close" data-close aria-label="${L('关闭', 'Close')}">×</button>
      </div>
      <div class="modal-body"><div class="preset-grid">${cards}</div></div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-close>${L('取消', 'Cancel')}</button>
        <button class="btn btn-primary" data-load-preset>${L('载入所选预设', 'Load Selected Preset')}</button>
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
            L('载入预设：', 'Load preset: ') + L(preset.name, preset.nameEn),
            L('当前项目会先备份到浏览器，然后被这个预设替换。可以继续用撤销 / 导出管理你的版本。', 'The current project will be backed up in the browser and then replaced by this preset. You can keep managing versions with undo / export.'),
            () => {
              try {
                replaceProject(preset.build());
              } catch (err) {
                console.error(err);
                toast(L('预设载入失败', 'Failed to load preset'), true);
              }
            },
            L('载入并替换', 'Load & Replace')
          );
        });
      }
    });
  }

  function openHelpModal() {
    if (MV.getLang() === 'en') {
      const rows = [
        ['V / R / C / I / H', 'Select / Room / Connect / Item / Pan'],
        ['1 / 2 / 3', '2D Route / 3D Map / Ability Lock Tree'],
        ['F', 'Focus selection (in the lock tree, switch to 2D and locate)'],
        ['/ or Ctrl / Cmd + K', 'Quick jump to room'],
        ['Arrow keys / Shift + Arrow keys', 'Move selected room by 5 / 1 units'],
        ['Ctrl / Cmd + C / V', 'Copy / paste room (with items, without links)'],
        ['D or Ctrl / Cmd + D', 'Duplicate room in place'],
        ['Drag room', 'Move position'],
        ['Drag corner', 'Resize room'],
        ['Space + drag / middle button', 'Pan canvas'],
        ['Wheel', 'Zoom 2D / dolly 3D'],
        ['Right-drag (3D)', 'Orbit camera'],
        ['Middle-drag (3D)', 'Pan camera'],
        ['Shift + drag (3D)', 'Adjust room base elevation'],
        ['Delete', 'Delete selection'],
        ['Ctrl / Cmd + Z', 'Undo'],
        ['Ctrl / Cmd + Shift + Z', 'Redo'],
        ['Ctrl / Cmd + S', 'Save to browser'],
        ['Esc', 'Exit input / cancel connection / close modal']
      ];
      openModal(`<div class="modal">
        <div class="modal-head">
          <div>
            <div class="modal-kicker">MANUAL / ROUTE FORGE</div>
            <h2>Controls & Notes</h2>
            <p>A 2D route + 3D massing designer for 3D Metroidvania games.</p>
          </div>
          <button class="modal-close" data-close aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          <div class="shortcut-grid">${rows.map(row => `<div class="shortcut-row"><span>${row[1]}</span><kbd>${row[0]}</kbd></div>`).join('')}</div>
          <div class="section-label">Appearance & Color</div>
          <p class="about-copy">The sun / moon button in the top bar switches light and dark themes. The palette button opens color settings where you can switch between color and monochrome, edit the phase ramp segment by segment, and assign a color to each region. In color mode, a room's top edge shows its region, the bottom edge shows its phase, and gates and items use their own semantic colors.</p>
          <div class="section-label">Region Filter</div>
          <p class="about-copy">Checkboxes in the left region list control 2D / 3D visibility and can hide several regions at once. The region inspector offers “Show Only This Region,” and “All” above the list restores every region. Filtering affects display only; progression analysis and route validation still use the full project.</p>
          <div class="section-label">Fast Iteration</div>
          <p class="about-copy">Press <span class="mono">/</span> or <span class="mono">Ctrl/Cmd + K</span> to open Quick Jump and search by room name, region, type or note. With a room selected, arrow keys move it by 5 units and <span class="mono">Shift + arrows</span> by 1 unit. <span class="mono">Ctrl/Cmd + C / V</span> copies and pastes a room with its items, and <span class="mono">D</span> or <span class="mono">Ctrl/Cmd + D</span> duplicates in place. Turn off “Snap 5px” in the Layers panel for free coordinates.</p>
          <div class="section-label">Ability Lock Tree</div>
          <p class="about-copy">The third mode is the ability lock tree. It orders acquisition steps from top to bottom: each row is a phase, with abilities, keys, bosses or optional upgrades above and the gates unlocked in that step below. Every gate card states “← requires / → leads to.” Click a card to inspect the matching item or link; double-click or press F to switch to 2D and locate it.</p>
          <div class="section-label">Data</div>
          <p class="about-copy">The project autosaves to browser localStorage, and unsaved changes are flushed when the page is hidden or closed. The save button writes immediately; exporting JSON is the reliable long-term backup. Import backs up the current project to <span class="mono">routeforge.backup.v1</span>. PNG export re-lays out the entire 2D route independently of the current zoom.</p>
          <div class="section-label">Preset Notes</div>
          <p class="about-copy">The <strong>Metroid Prime</strong> preset is a <strong>structured reference</strong> assembled from public sources. It keeps the region ring, Magmoor hub, beam-gate matrix, Morph Ball spatial locks, visor locks, environmental gates and the 12-artifact endgame, but does not guarantee official room coordinates or item placements. Other presets are compressed structural references.</p>
          <div class="section-label">Design Principle</div>
          <p class="about-copy">First draw “what the player must acquire,” then draw “how those abilities change spatial traversal.” The 2D view owns the causal chain; the 3D view owns massing and vertical relationships. The progress panel uses reachability analysis to check deadlocks, key budgets and unreachable rooms.</p>
        </div>
        <div class="modal-foot"><button class="btn btn-primary" data-close>Close</button></div>
      </div>`);
      return;
    }
    const rows = [
      ['V / R / C / I / H', '选择 / 房间 / 连接 / 物品 / 平移'],
      ['1 / 2 / 3', '2D 路线 / 3D 地图 / 能力锁树'],
      ['F', '聚焦当前选择（锁树中按 F 切到 2D 定位）'],
      ['/ 或 Ctrl / Cmd + K', '快速定位房间'],
      ['方向键 / Shift + 方向键', '移动选中房间 5 / 1 单位'],
      ['Ctrl / Cmd + C / V', '复制 / 粘贴房间（含物品，不含连接）'],
      ['D 或 Ctrl / Cmd + D', '原地复制房间'],
      ['拖动房间', '移动位置'],
      ['拖动角点', '缩放房间'],
      ['空格 + 拖动 / 中键', '平移画布'],
      ['滚轮', '缩放 2D / 拉近 3D'],
      ['右键拖动（3D）', '旋转相机'],
      ['中键拖动（3D）', '平移相机'],
      ['Shift + 拖动（3D）', '调整房间基座高度'],
      ['Delete', '删除当前选择'],
      ['Ctrl / Cmd + Z', '撤销'],
      ['Ctrl / Cmd + Shift + Z', '重做'],
      ['Ctrl / Cmd + S', '保存到浏览器'],
      ['Esc', '退出输入 / 取消连接 / 关闭弹窗']
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
        <div class="section-label">快速迭代</div>
        <p class="about-copy">按 <span class="mono">/</span> 或 <span class="mono">Ctrl/Cmd + K</span> 打开快速定位，可按房间名、区域、类型或备注搜索。选中房间后，方向键按 5 单位移动，<span class="mono">Shift + 方向键</span> 按 1 单位微调；<span class="mono">Ctrl/Cmd + C / V</span> 复制粘贴房间及其物品，<span class="mono">Ctrl/Cmd + D</span> 原地复制。图层区的“网格吸附 5px”可关闭，获得自由坐标。</p>
        <div class="section-label">能力锁树</div>
        <p class="about-copy">顶栏第三个模式是能力锁树：它按获得步骤从上到下排列，每一行是一个阶段，上方卡片是本步获得的能力、钥匙、Boss 或可选强化，下方带颜色的卡片是本步解锁的门锁。每张门锁卡直接标出“← 需要什么 / → 通向哪里”。单击卡片在右侧检查器查看对应物品或连接；双击或按 F 切到 2D 定位。</p>
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
        <div><div class="modal-kicker">CONFIRM / ${L('确认', 'CONFIRM')}</div><h2>${esc(title)}</h2></div>
        <button class="modal-close" data-close aria-label="${L('关闭', 'Close')}">×</button>
      </div>
      <div class="modal-body"><p class="about-copy">${esc(message)}</p></div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-close>${L('取消', 'Cancel')}</button>
        <button class="btn btn-primary" data-confirm>${esc(confirmLabel || L('确认', 'Confirm'))}</button>
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
    if (mod && key.toLowerCase() === 'k') {
      e.preventDefault();
      openJumpModal();
      return;
    }
    if (e.key === 'Escape' && isTyping()) {
      document.activeElement.blur();
      return;
    }
    if (isTyping()) return;

    if (mod && key.toLowerCase() === 'c') {
      if (app.selection && app.selection.type === 'room') {
        e.preventDefault();
        copyRoomSelection();
      }
      return;
    }
    if (mod && key.toLowerCase() === 'v') {
      if (roomClipboard) {
        e.preventDefault();
        pasteRoomClipboard();
      }
      return;
    }
    if (mod && key.toLowerCase() === 'd') {
      if (app.selection && app.selection.type === 'room') {
        e.preventDefault();
        duplicateRoom();
      }
      return;
    }
    if (!mod && key.toLowerCase() === 'd') {
      if (app.selection && app.selection.type === 'room') {
        e.preventDefault();
        duplicateRoom();
      }
      return;
    }

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

    if (key.indexOf('Arrow') === 0) {
      if (app.selection && app.selection.type === 'room' && app.mode !== 'tree') {
        const step = e.shiftKey ? 1 : 5;
        const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
        const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
        if (dx || dy) {
          e.preventDefault();
          nudgeSelection(dx, dy);
        }
      }
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
    if (key === '3') { switchMode('tree'); return; }
    if (key.toLowerCase() === 'v') { setTool('select'); return; }
    if (key.toLowerCase() === 'r') { setTool('room'); return; }
    if (key.toLowerCase() === 'c') { setTool('connect'); return; }
    if (key.toLowerCase() === 'i') { setTool('item'); return; }
    if (key.toLowerCase() === 'h') { setTool('pan'); return; }
    if (key.toLowerCase() === 'f') { focusSelection(); return; }
    if (key === '/' && !e.shiftKey) { e.preventDefault(); openJumpModal(); return; }
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
      camTree: MV.clone(app.viewTree.cam),
      center2d: MV.clone(app.view3d.center2d),
      selection: app.selection ? MV.clone(app.selection) : null
    })
  };

  boot();
})(window);
