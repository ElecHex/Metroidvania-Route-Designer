/* ============================================================
   ROUTE FORGE — ability lock timeline
   Step-ordered progression view: items acquired, locks opened.
   ============================================================ */
(function (global) {
  'use strict';
  const MV = global.MV = global.MV || {};
  const L = MV.L;

  const FONT_UI = '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei", sans-serif';
  const FONT_MONO = '"Cascadia Mono", "Consolas", "Microsoft YaHei", monospace';

  let lastLayout = { width: 0, height: 0, cam: null, nodes: [], gateChips: [], graph: null };
  let treeCache = { project: null, analysis: null, regionKey: '', lang: '', graph: null };

  function makeNode(id, type, opts) {
    return Object.assign({
      id, type, x: 0, y: 0, w: 200, h: 46,
      optional: false, main: false, step: 0
    }, opts || {});
  }

  function buildLockTree(project, analysis) {
    if (!project || !analysis) {
      return { nodes: [], gateChips: [], steps: [], bounds: { minX: 0, minY: 0, maxX: 800, maxY: 400 }, meta: { items: 0, gates: 0, steps: 0, optional: 0, keys: 0, unreachableItems: 0 } };
    }
    const regionKey = (project.regions || []).map(region => region.color).join('|');
    if (treeCache.graph && treeCache.project === project && treeCache.analysis === analysis && treeCache.regionKey === regionKey && treeCache.lang === MV.getLang()) {
      return treeCache.graph;
    }
    const roomMap = {};
    const regionMap = {};
    const linkMap = {};
    project.rooms.forEach(room => { roomMap[room.id] = room; });
    project.regions.forEach(region => { regionMap[region.id] = region; });
    project.links.forEach(link => { linkMap[link.id] = link; });
    const reachable = new Set(analysis.reachable || []);
    const roomPhase = analysis.roomPhase || {};
    const startAbilities = new Set(project.startAbilities || []);
    const pathRooms = new Set(analysis.path || []);
    const pathLinks = new Set(analysis.pathLinks || []);
    const phaseOf = roomId => roomPhase[roomId] == null ? 999 : roomPhase[roomId];

    function isProgressionGate(link) {
      if (!link) return false;
      if (Number(link.keyReq) > 0) return true;
      return (link.requires || []).some(req => !startAbilities.has(req));
    }

    const items = (project.items || []).filter(item => reachable.has(item.room));
    const includedItems = items.filter(item => {
      if (item.kind === 'collectible') return false;
      if (item.kind === 'custom' && !item.grants) return false;
      return item.kind !== 'key' || !!item.grants;
    });
    const collectibles = items.filter(item => item.kind === 'collectible');
    const unpickedKeys = items.filter(item => item.kind === 'key' && !item.grants);

    const itemStep = {};
    const itemOrder = {};
    (analysis.timeline || []).forEach((entry, index) => {
      itemStep[entry.itemId] = entry.step;
      itemOrder[entry.itemId] = index;
    });

    const startRoom = roomMap[project.startRoom] || project.rooms[0];
    const startRegion = startRoom ? regionMap[startRoom.region] : null;
    const root = makeNode('root', 'root', {
      label: startRoom ? startRoom.name : 'START',
      sub: startRegion ? startRegion.code + ' · ' + startRegion.name : 'START',
      icon: 'S',
      roomId: startRoom ? startRoom.id : '',
      w: 210, h: 48, main: true, color: '#ffffff', step: 0
    });

    const itemNodes = includedItems.map(item => {
      const room = roomMap[item.room];
      const region = room ? regionMap[room.region] : null;
      const kind = MV.itemKindById(item.kind);
      return makeNode('item:' + item.id, 'item', {
        itemId: item.id,
        kind: item.kind,
        label: item.name,
        sub: kind.name + ' · ' + (region ? region.code : '---') + ' · ' + (room ? room.name : ''),
        icon: kind.short,
        color: kind.color,
        regionColor: region ? MV.regionColor(region, 'color') : '#8f98a8',
        optional: !!item.optional,
        main: pathRooms.has(item.room) && !item.optional,
        step: itemStep[item.id] != null ? itemStep[item.id] : (phaseOf(item.room) === 999 ? 0 : phaseOf(item.room))
      });
    });
    itemNodes.sort((a, b) => {
      if (a.step !== b.step) return a.step - b.step;
      return (itemOrder[a.itemId] || 0) - (itemOrder[b.itemId] || 0);
    });

    const keyGates = project.links.filter(link => Number(link.keyReq) > 0 && isProgressionGate(link));
    let keypool = null;
    if (unpickedKeys.length && keyGates.length) {
      const keyRegions = new Set(unpickedKeys.map(item => {
        const room = roomMap[item.room];
        return room ? room.region : null;
      }).filter(Boolean));
      keypool = makeNode('keypool', 'keypool', {
        label: L('钥匙 / 神器 ×', 'Keys / Artifacts ×') + unpickedKeys.length,
        sub: L(keyRegions.size + ' 个区域 · 全局钥匙预算', keyRegions.size + ' regions · global key budget'),
        icon: 'KY',
        color: '#ffd54f',
        w: 200, h: 48, step: 0
      });
    }

    const maxItemStep = itemNodes.reduce((max, node) => Math.max(max, node.step), 0);
    const maxGateStep = Object.keys(analysis.unlockSteps || {}).reduce((max, key) => Math.max(max, Number(key) || 0), 0);
    const stepCount = Math.max(analysis.stepCount || 1, maxItemStep + 1, maxGateStep + 1);

    const gateChipsAll = [];
    const usedGates = new Set();
    const steps = [];
    for (let stepIndex = 0; stepIndex < stepCount; stepIndex++) {
      const stepItems = itemNodes.filter(node => node.step === stepIndex);
      const gateIds = new Set(analysis.unlockSteps && analysis.unlockSteps[stepIndex] ? analysis.unlockSteps[stepIndex] : []);
      project.links.forEach(link => {
        if (!isProgressionGate(link)) return;
        if (analysis.openLinks && analysis.openLinks[link.id] === stepIndex) gateIds.add(link.id);
      });
      const gates = [];
      gateIds.forEach(linkId => {
        if (usedGates.has(linkId)) return;
        const link = linkMap[linkId];
        if (!isProgressionGate(link)) return;
        const gate = MV.gateById(link.gate);
        const a = roomMap[link.a];
        const b = roomMap[link.b];
        const target = (phaseOf(link.a) >= phaseOf(link.b) ? a : b) || b || a;
        const requirements = (link.requires || [])
          .filter(req => !startAbilities.has(req))
          .map(req => MV.abilityName(project, req));
        if (Number(link.keyReq) > 0) requirements.push(L('钥匙 ×', 'Keys ×') + link.keyReq);
        usedGates.add(linkId);
        gates.push({
          type: 'gate',
          linkId,
          code: gate.code,
          name: gate.name,
          color: gate.color,
          requires: requirements,
          targetRoom: target ? target.name : '?',
          main: pathLinks.has(linkId),
          step: stepIndex
        });
      });
      steps.push({ index: stepIndex, items: stepItems, gates });
      gateChipsAll.push(...gates);
    }

    /* -------- fixed step-based layout -------- */
    const usedSteps = steps.filter(step => step.items.length || step.gates.length);
    const cols = 4;
    const cardW = 200, cardH = 40, gateH = 36;
    const gapX = 14, gapY = 6;
    const headerH = 22, stepGap = 18;
    const contentW = cols * cardW + (cols - 1) * gapX;
    root.x = 105;
    root.y = 22;
    root.h = 44;
    if (keypool) {
      keypool.x = contentW - 100;
      keypool.y = 22;
      keypool.h = 44;
    }
    let y = 74;
    usedSteps.forEach(step => {
      step.top = y;
      step.header = { x: 0, y, w: contentW, h: headerH };
      const itemsTop = y + headerH + 6;
      step.items.forEach((node, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        node.x = col * (cardW + gapX) + cardW / 2;
        node.y = itemsTop + row * (cardH + gapY) + cardH / 2;
        node.w = cardW;
        node.h = cardH;
      });
      const itemRows = Math.max(1, Math.ceil(step.items.length / cols));
      const gatesTop = itemsTop + itemRows * (cardH + gapY) + 1;
      step.gates.forEach((chip, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        chip.x = col * (cardW + gapX) + cardW / 2;
        chip.y = gatesTop + row * (gateH + gapY) + gateH / 2;
        chip.w = cardW;
        chip.h = gateH;
      });
      const gateRows = Math.ceil(step.gates.length / cols);
      const bottom = step.gates.length
        ? gatesTop + gateRows * (gateH + gapY)
        : itemsTop + itemRows * (cardH + gapY);
      step.bottom = bottom;
      step.rect = { x: -10, y: y - 3, w: contentW + 20, h: bottom - y + 6 };
      y = bottom + stepGap;
    });

    const bounds = {
      minX: -24, minY: 0,
      maxX: contentW + 24,
      maxY: Math.max(y, 200)
    };
    const nodes = [root];
    if (keypool) nodes.push(keypool);
    nodes.push(...itemNodes);

    const graph = {
      nodes,
      gateChips: gateChipsAll,
      steps: usedSteps,
      rootId: 'root',
      bounds,
      meta: {
        nodes: nodes.length,
        items: includedItems.length,
        gates: usedGates.size,
        steps: usedSteps.length,
        layers: usedSteps.length,
        keys: unpickedKeys.length,
        optional: includedItems.filter(item => item.optional).length,
        unreachableItems: (project.items || []).filter(item => !reachable.has(item.room)).length,
        collectibles: collectibles.length,
        cycles: 0
      }
    };
    treeCache = { project, analysis, regionKey, lang: MV.getLang(), graph };
    return graph;
  }

  function worldToScreen(wx, wy, cam, W, H) {
    return { x: (wx - cam.x) * cam.zoom + W / 2, y: (wy - cam.y) * cam.zoom + H / 2 };
  }

  function fitCamera(graph, W, H, padding) {
    const pad = padding == null ? 60 : padding;
    if (!graph || !graph.bounds) return { x: 0, y: 0, zoom: 1 };
    const b = graph.bounds;
    const width = Math.max(100, b.maxX - b.minX);
    const height = Math.max(100, b.maxY - b.minY);
    return {
      x: (b.minX + b.maxX) / 2,
      y: (b.minY + b.maxY) / 2,
      zoom: MV.clamp(Math.min((W - pad * 2) / width, (H - pad * 2) / height), 0.1, 1.5)
    };
  }

  function zoomAt(view, W, H, sx, sy, factor) {
    const beforeX = (sx - W / 2) / view.cam.zoom + view.cam.x;
    const beforeY = (sy - H / 2) / view.cam.zoom + view.cam.y;
    view.cam.zoom = MV.clamp(view.cam.zoom * factor, 0.08, 2.2);
    const afterX = (sx - W / 2) / view.cam.zoom + view.cam.x;
    const afterY = (sy - H / 2) / view.cam.zoom + view.cam.y;
    view.cam.x += beforeX - afterX;
    view.cam.y += beforeY - afterY;
  }

  function truncate(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const next = result + text[i];
      if (ctx.measureText(next + '…').width > maxWidth) break;
      result = next;
    }
    return result + '…';
  }

  function screenRect(x, y, w, h, cam, W, H) {
    const p = worldToScreen(x, y, cam, W, H);
    const sw = w * cam.zoom;
    const sh = h * cam.zoom;
    return { left: p.x - sw / 2, top: p.y - sh / 2, w: sw, h: sh, cx: p.x, cy: p.y };
  }

  function drawStep(ctx, step, project, view, cam, W, H, theme) {
    const r = step.rect;
    const p = worldToScreen(r.x, r.y, cam, W, H);
    const w = r.w * cam.zoom;
    const h = r.h * cam.zoom;
    if (p.x > W + 200 || p.y > H + 200 || p.x + w < -200 || p.y + h < -200) return;
    const phaseColor = MV.phaseColor(project, step.index, Math.max(1, (view.analysis.stepCount || 1) - 1));
    const dimmed = view.mainOnly && step.items.length && step.items.every(item => !item.main) && step.gates.every(gate => !gate.main);
    ctx.save();
    ctx.globalAlpha = dimmed ? 0.22 : 1;
    ctx.fillStyle = MV.hexToRgba(phaseColor, theme.name === 'light' ? 0.035 : 0.04);
    ctx.fillRect(p.x, p.y, w, h);
    ctx.strokeStyle = MV.hexToRgba(phaseColor, theme.name === 'light' ? 0.25 : 0.32);
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x + 0.5, p.y + 0.5, w - 1, h - 1);
    ctx.fillStyle = MV.hexToRgba(phaseColor, 0.92);
    ctx.fillRect(p.x, p.y, 3, h);

    /* timeline spine + step dot */
    const dotX = p.x + 10;
    const dotY = p.y + 14 * cam.zoom;
    ctx.fillStyle = phaseColor;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
    ctx.fill();

    const headerY = p.y + Math.min(Math.max(10, r.h - 4), 12);
    ctx.font = '8px ' + FONT_MONO;
    ctx.fillStyle = theme.name === 'light' ? MV.mixColor(phaseColor, theme.ink, 0.3) : phaseColor;
    ctx.fillText('STEP ' + String(step.index).padStart(2, '0'), p.x + 19, headerY);
    ctx.font = '9px ' + FONT_UI;
    ctx.fillStyle = theme.ink;
    const title = step.index === 0 ? L('起始 / 初始收集', 'START / INITIAL') : (step.index === (view.analysis.stepCount || 1) - 1 ? L('终局', 'ENDGAME') : L('推进', 'PROGRESS'));
    ctx.fillText(title, p.x + 79, headerY);
    if (r.h >= 20) {
      ctx.font = '7px ' + FONT_MONO;
      ctx.fillStyle = theme.inkDim;
      ctx.fillText(step.items.length + ' ITEMS · ' + step.gates.length + ' LOCKS', p.x + w - 150, headerY);
    }
    ctx.strokeStyle = MV.hexToRgba(phaseColor, 0.25);
    ctx.beginPath();
    ctx.moveTo(p.x + 19, p.y + Math.min(r.h - 2, 23));
    ctx.lineTo(p.x + w - 8, p.y + Math.min(r.h - 2, 23));
    ctx.stroke();
    ctx.restore();
  }

  function drawItemNode(ctx, node, view, cam, W, H, theme) {
    const r = screenRect(node.x, node.y, node.w, node.h, cam, W, H);
    if (r.left > W + 100 || r.top > H + 100 || r.left + r.w < -100 || r.top + r.h < -100) return;
    const colorOn = view.colorMode !== 'mono';
    const selected = view.selection && (
      (view.selection.type === 'item' && view.selection.id === node.itemId) ||
      (view.selection.type === 'room' && node.type === 'root' && view.selection.id === node.roomId)
    );
    const hover = view.hover && view.hover.id === node.id;
    const dimmed = view.mainOnly && !node.main;
    const color = colorOn ? node.color : theme.inkDim;
    let fill = node.type === 'root'
      ? theme.accent
      : (colorOn ? MV.mixColor(theme.roomFill, node.color, 0.08) : theme.roomFill);
    if (hover) fill = theme.roomHover;
    if (selected) fill = theme.roomSelected;
    ctx.save();
    ctx.globalAlpha = dimmed ? 0.2 : (node.optional ? 0.72 : 1);
    ctx.fillStyle = fill;
    ctx.fillRect(r.left, r.top, r.w, r.h);
    ctx.strokeStyle = selected || hover ? theme.accent : (color || theme.roomBorder);
    ctx.lineWidth = selected ? 2 : (node.main ? 1.3 : 0.9);
    if (node.optional) ctx.setLineDash([4, 3]);
    ctx.strokeRect(r.left + 0.5, r.top + 0.5, r.w - 1, r.h - 1);
    ctx.setLineDash([]);
    if (node.main) {
      ctx.fillStyle = theme.accent;
      ctx.fillRect(r.left + r.w - 3, r.top + 1, 2, r.h - 2);
    }
    if (node.regionColor) {
      ctx.fillStyle = colorOn ? node.regionColor : theme.inkGhost;
      ctx.fillRect(r.left, r.top, 2, r.h);
    }

    const compact = r.h < 32;
    const showIcon = !compact && r.w >= 82;
    let textX = r.left + 7;
    if (showIcon) {
      const iconSize = Math.min(20, r.h - 14);
      const iconX = r.left + 7;
      const iconY = r.top + (r.h - iconSize) / 2;
      ctx.fillStyle = colorOn ? MV.hexToRgba(node.color, 0.2) : theme.roomHover;
      ctx.fillRect(iconX, iconY, iconSize, iconSize);
      ctx.strokeStyle = node.color || theme.roomBorder;
      ctx.strokeRect(iconX + 0.5, iconY + 0.5, iconSize - 1, iconSize - 1);
      ctx.font = '6.5px ' + FONT_MONO;
      ctx.fillStyle = node.type === 'root' ? theme.accentInk : (colorOn ? node.color : theme.ink);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.icon || '·', iconX + iconSize / 2, iconY + iconSize / 2 + 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      textX = iconX + iconSize + 6;
    }
    const maxText = r.w - (textX - r.left) - 7;
    ctx.font = (compact ? '8.5px ' : '9px ') + FONT_UI;
    ctx.fillStyle = node.type === 'root' ? theme.accentInk : theme.ink;
    ctx.fillText(truncate(ctx, node.label, Math.max(20, maxText)), textX, r.top + (compact ? r.h * 0.45 : r.h * 0.4));
    if (!compact || r.h >= 23) {
      ctx.font = '6.5px ' + FONT_MONO;
      ctx.fillStyle = node.type === 'root' ? theme.accentInk : theme.inkDim;
      const subY = compact ? r.top + r.h * 0.82 : r.top + r.h * 0.4 + 12;
      ctx.fillText(truncate(ctx, node.sub || '', Math.max(20, maxText)), textX, subY);
    }
    ctx.restore();
  }

  function drawGateChip(ctx, chip, view, cam, W, H, theme) {
    const r = screenRect(chip.x, chip.y, chip.w, chip.h, cam, W, H);
    if (r.left > W + 100 || r.top > H + 100 || r.left + r.w < -100 || r.top + r.h < -100) return;
    const colorOn = view.colorMode !== 'mono';
    const selected = view.selection && view.selection.type === 'link' && view.selection.id === chip.linkId;
    const hover = view.hover && view.hover.chip && view.hover.linkId === chip.linkId;
    const dimmed = view.mainOnly && !chip.main;
    const accent = colorOn ? chip.color : theme.inkDim;
    let fill = colorOn ? MV.mixColor(theme.roomFill, chip.color, 0.09) : theme.roomFill;
    if (hover) fill = theme.roomHover;
    if (selected) fill = theme.roomSelected;
    ctx.save();
    ctx.globalAlpha = dimmed ? 0.2 : 1;
    ctx.fillStyle = fill;
    ctx.fillRect(r.left, r.top, r.w, r.h);
    ctx.strokeStyle = selected || hover ? theme.accent : accent;
    ctx.lineWidth = selected ? 2 : (chip.main ? 1.3 : 0.9);
    ctx.strokeRect(r.left + 0.5, r.top + 0.5, r.w - 1, r.h - 1);
    ctx.fillStyle = colorOn ? MV.hexToRgba(chip.color, 0.9) : theme.inkGhost;
    ctx.fillRect(r.left, r.top, 3, r.h);
    if (r.w > 58) {
      const badgeW = Math.max(20, Math.min(26, r.w * 0.18));
      ctx.fillStyle = colorOn ? MV.hexToRgba(chip.color, 0.18) : theme.roomHover;
      ctx.fillRect(r.left + 7, r.top + 5, badgeW, 12);
      ctx.strokeStyle = accent;
      ctx.strokeRect(r.left + 7.5, r.top + 5.5, badgeW - 1, 11);
      ctx.font = '6.5px ' + FONT_MONO;
      ctx.fillStyle = colorOn ? accent : theme.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chip.code, r.left + 7 + badgeW / 2, r.top + 11.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const textX = r.left + 7 + badgeW + 5;
      const maxText = r.w - (textX - r.left) - 7;
      ctx.font = '8.5px ' + FONT_UI;
      ctx.fillStyle = theme.ink;
      ctx.fillText(truncate(ctx, chip.name, Math.max(20, maxText)), textX, r.top + 12);
      if (r.h >= 20) {
        const requireText = chip.requires.length ? '← ' + chip.requires.join(' + ') : L('← 无门槛', '← No requirement');
        ctx.font = '6.5px ' + FONT_MONO;
        ctx.fillStyle = theme.inkDim;
        const subY = r.h >= 30 ? r.top + 24 : r.top + r.h - 4;
        ctx.fillText(truncate(ctx, requireText + '  → ' + chip.targetRoom, Math.max(20, maxText)), textX, subY);
      }
    }
    lastLayout.gateChips.push({
      left: r.left, top: r.top, w: r.w, h: r.h,
      linkId: chip.linkId, chip
    });
    ctx.restore();
  }

  function draw(canvas, project, view) {
    const W = Math.max(1, canvas.clientWidth);
    const H = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.round(W * dpr);
    const bh = Math.round(H * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const theme = MV.canvasTheme();
    const graph = buildLockTree(project, view.analysis);
    const cam = view.cam;
    lastLayout = { width: W, height: H, cam, nodes: [], gateChips: [], graph };

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);
    const gradient = ctx.createRadialGradient(W * 0.5, H * 0.4, 20, W * 0.5, H * 0.4, Math.max(W, H) * 0.8);
    gradient.addColorStop(0, theme.bgGlow);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    let step = 50 * cam.zoom;
    while (step < 14) step *= 4;
    if (step < 90) {
      ctx.fillStyle = theme.grid;
      const offsetX = ((-cam.x * cam.zoom + W / 2) % step + step) % step;
      const offsetY = ((-cam.y * cam.zoom + H / 2) % step + step) % step;
      for (let x = offsetX; x < W; x += step) {
        for (let y = offsetY; y < H; y += step) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    graph.steps.forEach(stepData => drawStep(ctx, stepData, project, view, cam, W, H, theme));
    graph.nodes.forEach(node => {
      drawItemNode(ctx, node, view, cam, W, H, theme);
      const rect = screenRect(node.x, node.y, node.w, node.h, cam, W, H);
      if (rect.left < W + 100 && rect.top < H + 100 && rect.left + rect.w > -100 && rect.top + rect.h > -100) {
        lastLayout.nodes.push(Object.assign(rect, { id: node.id, node }));
      }
    });
    graph.gateChips.forEach(chip => drawGateChip(ctx, chip, view, cam, W, H, theme));

    /* vertical spine */
    if (graph.steps.length) {
      const first = graph.steps[0];
      const last = graph.steps[graph.steps.length - 1];
      const a = worldToScreen(-14, first.top + 14, cam, W, H);
      const b = worldToScreen(-14, last.top + 14, cam, W, H);
      ctx.save();
      ctx.strokeStyle = MV.hexToRgba(theme.ink, 0.14);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      graph.steps.forEach(stepData => {
        const p = worldToScreen(-14, stepData.top + 14, cam, W, H);
        const phaseColor = MV.phaseColor(project, stepData.index, Math.max(1, (view.analysis.stepCount || 1) - 1));
        ctx.fillStyle = phaseColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }
    return lastLayout;
  }

  function pick(view, W, H, x, y) {
    if (!lastLayout || lastLayout.width !== W || lastLayout.height !== H) return null;
    for (let i = lastLayout.nodes.length - 1; i >= 0; i--) {
      const entry = lastLayout.nodes[i];
      if (!entry) continue;
      if (x >= entry.left && x <= entry.left + entry.w && y >= entry.top && y <= entry.top + entry.h) {
        return entry.node;
      }
    }
    for (let i = lastLayout.gateChips.length - 1; i >= 0; i--) {
      const entry = lastLayout.gateChips[i];
      if (x >= entry.left && x <= entry.left + entry.w && y >= entry.top && y <= entry.top + entry.h) {
        return {
          type: 'gate',
          linkId: entry.linkId,
          label: entry.chip.name,
          icon: entry.chip.code,
          sub: entry.chip.requires.join(' + ') + ' → ' + entry.chip.targetRoom,
          chip: true
        };
      }
    }
    return null;
  }

  MV.buildLockTree = buildLockTree;
  MV.RenderTree = {
    draw,
    pick,
    fitCamera,
    zoomAt,
    buildGraph: buildLockTree,
    getLayout: () => lastLayout
  };
})(window);
