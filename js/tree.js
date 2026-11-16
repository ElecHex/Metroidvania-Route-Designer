/* ============================================================
   ROUTE FORGE — ability lock tree (Boss Keys inspired)
   ============================================================ */
(function (global) {
  'use strict';
  const MV = global.MV = global.MV || {};

  const FONT_UI = '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei", sans-serif';
  const FONT_MONO = '"Cascadia Mono", "Consolas", "Microsoft YaHei", monospace';

  let lastLayout = { width: 0, height: 0, cam: null, nodes: [], graph: null };

  function makeNode(id, type, opts) {
    return Object.assign({
      id, type, x: 0, y: 0, w: 210, h: 52,
      optional: false, main: false, cycle: false, missing: false
    }, opts || {});
  }

  function buildLockTree(project, analysis) {
    if (!project || !analysis) return { nodes: [], edges: [], meta: { nodes: 0, layers: 0 } };
    const roomMap = {};
    const regionMap = {};
    const linkMap = {};
    project.rooms.forEach(room => { roomMap[room.id] = room; });
    project.regions.forEach(region => { regionMap[region.id] = region; });
    project.links.forEach(link => { linkMap[link.id] = link; });
    const reachable = new Set(analysis.reachable || []);
    const roomPhase = analysis.roomPhase || {};
    const pathRooms = new Set(analysis.path || []);
    const pathLinks = new Set(analysis.pathLinks || []);
    const phaseOf = roomId => roomPhase[roomId] == null ? 999 : roomPhase[roomId];
    const startAbilities = new Set(project.startAbilities || []);

    const items = (project.items || []).filter(item => reachable.has(item.room));
    const includedItems = items.filter(item => item.kind !== 'key' || !!item.grants);
    const unpickedKeys = items.filter(item => item.kind === 'key' && !item.grants);

    function isProgressionGate(link) {
      if (!link) return false;
      if (Number(link.keyReq) > 0) return true;
      return (link.requires || []).some(req => !startAbilities.has(req));
    }

    const startRoom = roomMap[project.startRoom] || project.rooms[0];
    const startRegion = startRoom ? regionMap[startRoom.region] : null;
    const root = makeNode('root', 'root', {
      label: startRoom ? startRoom.name : 'START',
      sub: startRegion ? startRegion.code + ' · ' + startRegion.name : 'START',
      icon: 'S',
      roomId: startRoom ? startRoom.id : '',
      w: 200, h: 56, main: true, color: '#ffffff'
    });
    const nodes = [root];
    const itemNodes = new Map();

    includedItems.forEach(item => {
      const room = roomMap[item.room];
      const region = room ? regionMap[room.region] : null;
      const kind = MV.itemKindById(item.kind);
      const node = makeNode('item:' + item.id, 'item', {
        itemId: item.id,
        kind: item.kind,
        label: item.name,
        sub: kind.name + ' · ' + (region ? region.code : '---') + ' · ' + (room ? room.name : ''),
        icon: kind.short,
        color: kind.color,
        regionColor: region ? MV.regionColor(region, 'color') : '#8f98a8',
        optional: !!item.optional,
        main: pathRooms.has(item.room) && !item.optional
      });
      nodes.push(node);
      itemNodes.set(item.id, node);
    });

    const keyGates = project.links.filter(link => Number(link.keyReq) > 0 && isProgressionGate(link));
    let keypool = null;
    if (unpickedKeys.length && keyGates.length) {
      const keyRegions = new Set(unpickedKeys.map(item => {
        const room = roomMap[item.room];
        return room ? room.region : null;
      }).filter(Boolean));
      keypool = makeNode('keypool', 'keypool', {
        label: '钥匙 / 神器 ×' + unpickedKeys.length,
        sub: keyRegions.size + ' 个区域 · 全局钥匙预算',
        icon: 'KY',
        color: '#ffd54f',
        w: 205, h: 54
      });
      nodes.push(keypool);
    }

    const usedGates = new Set();
    function gateInfo(link) {
      const gate = MV.gateById(link.gate);
      usedGates.add(link.id);
      return {
        linkId: link.id,
        code: gate.code,
        name: gate.name,
        color: gate.color,
        requires: (link.requires || []).filter(req => !startAbilities.has(req)).map(req => MV.abilityName(project, req)),
        keyReq: Number(link.keyReq) || 0,
        main: pathLinks.has(link.id)
      };
    }

    const edges = [];
    const edgeMap = new Map();
    function addEdge(from, to, kind, gate) {
      if (!from || !to || from.id === to.id) return;
      const key = from.id + '>' + to.id;
      let edge = edgeMap.get(key);
      if (!edge) {
        edge = { from: from.id, to: to.id, kind, gates: [], main: false, optional: false };
        edgeMap.set(key, edge);
        edges.push(edge);
      }
      if (gate && !edge.gates.some(item => item.linkId === gate.linkId)) edge.gates.push(gate);
      edge.optional = edge.optional || !!from.optional || !!to.optional;
    }

    function sourceForGate(link) {
      if (!link) return null;
      if (Number(link.keyReq) > 0 && keypool) return keypool;
      const sources = [];
      (link.requires || []).filter(req => !startAbilities.has(req)).forEach(req => {
        const granting = includedItems
          .filter(item => item.grants === req)
          .sort((a, b) => phaseOf(a.room) - phaseOf(b.room));
        if (granting.length) {
          sources.push({ item: granting[0], phase: phaseOf(granting[0].room) });
        }
      });
      if (!sources.length) return null;
      sources.sort((a, b) => b.phase - a.phase);
      return itemNodes.get(sources[0].item.id);
    }

    includedItems.forEach(item => {
      const itemNode = itemNodes.get(item.id);
      const chain = (analysis.gateChains[item.room] || [])
        .filter(linkId => isProgressionGate(linkMap[linkId]));
      if (!chain.length) {
        addEdge(root, itemNode, 'root');
        return;
      }
      chain.forEach(linkId => {
        const link = linkMap[linkId];
        const source = sourceForGate(link);
        addEdge(source || root, itemNode, source ? 'gate' : 'root', gateInfo(link));
        if (!source) itemNode.missingGate = true;
      });
    });

    if (keypool) addEdge(root, keypool, 'root');

    /* keep the graph connected for layout */
    nodes.forEach(node => {
      if (node.id !== 'root' && !edges.some(edge => edge.to === node.id)) {
        addEdge(root, node, 'root');
      }
    });
    const nodeLookup = new Map(nodes.map(node => [node.id, node]));
    edges.forEach(edge => {
      const from = nodeLookup.get(edge.from);
      const to = nodeLookup.get(edge.to);
      edge.main = !!(from && to && to.main && (from.main || edge.gates.some(gate => gate.main)));
    });

    /* -------- longest-path layering -------- */
    const layer = new Map();
    const indegree = new Map(nodes.map(node => [node.id, 0]));
    edges.forEach(edge => indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1));
    layer.set('root', 0);
    const queue = nodes.filter(node => (indegree.get(node.id) || 0) === 0).map(node => node.id);
    if (!queue.includes('root')) queue.unshift('root');
    let guard = 0;
    while (queue.length && guard++ < 500) {
      const current = queue.shift();
      edges.filter(edge => edge.from === current).forEach(edge => {
        layer.set(edge.to, Math.max(layer.get(edge.to) || 0, (layer.get(current) || 0) + 1));
        indegree.set(edge.to, indegree.get(edge.to) - 1);
        if (indegree.get(edge.to) === 0) queue.push(edge.to);
      });
    }
    let maxLayer = 0;
    layer.forEach(value => { maxLayer = Math.max(maxLayer, value); });
    nodes.forEach(node => {
      if (!layer.has(node.id)) {
        layer.set(node.id, maxLayer + 1);
        node.cycle = true;
      }
    });
    maxLayer = 0;
    layer.forEach(value => { maxLayer = Math.max(maxLayer, value); });

    const parents = new Map(nodes.map(node => [node.id, []]));
    edges.forEach(edge => {
      const list = parents.get(edge.to);
      if (list) list.push(edge.from);
    });
    const byId = new Map(nodes.map(node => [node.id, node]));
    const typeOrder = { root: 0, item: 1, gate: 2, keypool: 3 };
    const layers = [];
    for (let i = 0; i <= maxLayer; i++) layers.push([]);
    nodes.forEach(node => { layers[layer.get(node.id)].push(node); });

    for (let li = 0; li < layers.length; li++) {
      const list = layers[li];
      list.sort((a, b) => {
        const aParents = parents.get(a.id) || [];
        const bParents = parents.get(b.id) || [];
        const aY = aParents.reduce((sum, id) => sum + (byId.get(id) ? byId.get(id).y : 0), 0) / Math.max(1, aParents.length);
        const bY = bParents.reduce((sum, id) => sum + (byId.get(id) ? byId.get(id).y : 0), 0) / Math.max(1, bParents.length);
        if (Math.abs(aY - bY) > 1) return aY - bY;
        if (a.optional !== b.optional) return a.optional ? 1 : -1;
        if (typeOrder[a.type] !== typeOrder[b.type]) return typeOrder[a.type] - typeOrder[b.type];
        return a.label.localeCompare(b.label, 'zh-CN');
      });
      const gap = 14;
      const total = list.reduce((sum, node) => sum + node.h, 0) + gap * Math.max(0, list.length - 1);
      let cursor = -total / 2;
      list.forEach(node => {
        node.x = li * 260;
        node.y = cursor + node.h / 2;
        cursor += node.h + gap;
      });
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(node => {
      minX = Math.min(minX, node.x - node.w / 2);
      maxX = Math.max(maxX, node.x + node.w / 2);
      minY = Math.min(minY, node.y - node.h / 2);
      maxY = Math.max(maxY, node.y + node.h / 2);
    });
    const bounds = { minX, minY, maxX, maxY };
    const cycles = nodes.filter(node => node.cycle).length;

    return {
      nodes,
      edges,
      rootId: 'root',
      bounds,
      meta: {
        nodes: nodes.length,
        edges: edges.length,
        layers: maxLayer + 1,
        items: includedItems.length,
        gates: usedGates.size,
        keys: unpickedKeys.length,
        optional: includedItems.filter(item => item.optional).length,
        unreachableItems: (project.items || []).filter(item => !reachable.has(item.room)).length,
        cycles
      }
    };
  }

  function worldToScreen(wx, wy, cam, W, H) {
    return { x: (wx - cam.x) * cam.zoom + W / 2, y: (wy - cam.y) * cam.zoom + H / 2 };
  }

  function fitCamera(graph, W, H, padding) {
    const pad = padding == null ? 80 : padding;
    if (!graph || !graph.nodes.length) return { x: 0, y: 0, zoom: 1 };
    const b = graph.bounds;
    const width = Math.max(100, b.maxX - b.minX);
    const height = Math.max(100, b.maxY - b.minY);
    return {
      x: (b.minX + b.maxX) / 2,
      y: (b.minY + b.maxY) / 2,
      zoom: MV.clamp(Math.min((W - pad * 2) / width, (H - pad * 2) / height), 0.1, 1.6)
    };
  }

  function zoomAt(view, W, H, sx, sy, factor) {
    const beforeX = (sx - W / 2) / view.cam.zoom + view.cam.x;
    const beforeY = (sy - H / 2) / view.cam.zoom + view.cam.y;
    view.cam.zoom = MV.clamp(view.cam.zoom * factor, 0.08, 2.4);
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

  function edgeColor(edge, theme, colorMode) {
    if (colorMode === 'mono') return edge.main ? theme.inkStrong : theme.lineDim;
    let color = theme.lineDim;
    if (edge.gates.length) color = edge.gates[0].color || theme.lineDim;
    if (theme.name === 'light') color = MV.mixColor(color, theme.ink, 0.3);
    return color;
  }

  function drawEdge(ctx, edge, graph, cam, W, H, theme, view, chipGateSeen) {
    const from = graph.nodes.find(node => node.id === edge.from);
    const to = graph.nodes.find(node => node.id === edge.to);
    if (!from || !to) return;
    const f = worldToScreen(from.x, from.y, cam, W, H);
    const t = worldToScreen(to.x, to.y, cam, W, H);
    if (f.x > W + 200 || f.y > H + 200 || t.x < -200 || t.y < -200) return;
    const dimmed = view.mainOnly && !edge.main;
    const sx = from.x < to.x ? f.x + from.w * cam.zoom / 2 : f.x - from.w * cam.zoom / 2;
    const tx = from.x < to.x ? t.x - to.w * cam.zoom / 2 : t.x + to.w * cam.zoom / 2;
    const dx = Math.max(30, Math.abs(tx - sx) * 0.45);
    const c1x = sx + (from.x < to.x ? dx : -dx);
    const c2x = tx - (from.x < to.x ? dx : -dx);
    const color = edgeColor(edge, theme, view.colorMode);
    ctx.save();
    ctx.globalAlpha = dimmed ? 0.16 : (edge.optional ? 0.6 : 0.9);
    ctx.strokeStyle = color;
    ctx.lineWidth = edge.main ? 1.7 : 1.1;
    if (edge.optional) ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, f.y);
    ctx.bezierCurveTo(c1x, f.y, c2x, t.y, tx, t.y);
    ctx.stroke();
    ctx.setLineDash([]);
    const arrowAngle = from.x < to.x ? 0 : Math.PI;
    ctx.save();
    ctx.translate(tx, t.y);
    ctx.rotate(arrowAngle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-6, -3.4);
    ctx.lineTo(-6, 3.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const hoverHit = view.hover && (view.hover.id === edge.from || view.hover.id === edge.to);
    const newGates = edge.gates.filter(gate => !chipGateSeen.has(gate.linkId));
    if (newGates.length && (edge.main || hoverHit || view.cam.zoom >= 0.42)) {
      const midX = (sx + 3 * c1x + 3 * c2x + tx) / 8;
      const midY = (f.y + t.y) / 2;
      newGates.forEach(gate => chipGateSeen.add(gate.linkId));
      lastLayout.edgeChips.push({
        x: midX,
        y: midY,
        label: newGates.map(gate => gate.code).join('/'),
        gates: newGates,
        main: edge.main,
        optional: edge.optional,
        color
      });
    }
    ctx.restore();
  }

  function drawEdgeChips(ctx, theme, view, W, H) {
    lastLayout.edgeChips.forEach(chip => {
      const p = { x: chip.x, y: chip.y };
      if (p.x < -40 || p.x > W + 40 || p.y < -20 || p.y > H + 20) return;
      ctx.save();
      ctx.globalAlpha = view.mainOnly && !chip.main ? 0.18 : 1;
      ctx.font = '7px ' + FONT_MONO;
      const width = ctx.measureText(chip.label).width + 8;
      const height = 12;
      ctx.fillStyle = theme.labelBg;
      ctx.fillRect(p.x - width / 2, p.y - height / 2, width, height);
      ctx.strokeStyle = view.colorMode === 'mono' ? theme.lineDim : chip.color;
      ctx.strokeRect(p.x - width / 2 + 0.5, p.y - height / 2 + 0.5, width - 1, height - 1);
      ctx.fillStyle = view.colorMode === 'mono' ? theme.inkDim : chip.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(chip.label, p.x, p.y + 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      chip.rect = { x: p.x - width / 2, y: p.y - height / 2, w: width, h: height };
      ctx.restore();
    });
  }

  function nodeScreenRect(node, cam, W, H) {
    const p = worldToScreen(node.x, node.y, cam, W, H);
    const w = node.w * cam.zoom;
    const h = node.h * cam.zoom;
    return { x: p.x, y: p.y, w, h, left: p.x - w / 2, top: p.y - h / 2 };
  }

  function drawNode(ctx, node, cam, W, H, theme, view) {
    const rect = nodeScreenRect(node, cam, W, H);
    if (rect.left > W + 80 || rect.top > H + 80 || rect.left + rect.w < -80 || rect.top + rect.h < -80) return;
    const colorOn = view.colorMode !== 'mono';
    const selected = view.selection && (
      (view.selection.type === 'item' && view.selection.id === node.itemId) ||
      (view.selection.type === 'link' && view.selection.id === node.linkId) ||
      (view.selection.type === 'room' && node.type === 'root' && view.selection.id === node.roomId)
    );
    const hover = view.hover && view.hover.id === node.id;
    const dimmed = view.mainOnly && !node.main;
    const nodeColor = colorOn ? node.color : (node.type === 'root' ? theme.accent : theme.inkDim);
    const fillBase = node.type === 'root' ? theme.accent : theme.roomFill;
    let fill = node.type === 'root' ? theme.accent : (colorOn ? MV.mixColor(fillBase, nodeColor, 0.1) : fillBase);
    if (selected) fill = theme.roomSelected;
    if (hover) fill = theme.roomHover;

    ctx.save();
    ctx.globalAlpha = dimmed ? 0.22 : (node.optional ? 0.72 : 1);
    ctx.fillStyle = fill;
    ctx.fillRect(rect.left, rect.top, rect.w, rect.h);
    ctx.strokeStyle = selected || hover ? theme.accent : (nodeColor || theme.roomBorder);
    ctx.lineWidth = selected ? 2 : (node.main ? 1.4 : 0.9);
    if (node.optional || node.cycle) ctx.setLineDash([4, 3]);
    ctx.strokeRect(rect.left + 0.5, rect.top + 0.5, rect.w - 1, rect.h - 1);
    ctx.setLineDash([]);
    if (node.main) {
      ctx.fillStyle = theme.accent;
      ctx.fillRect(rect.left + rect.w - 3, rect.top + 1, 2, rect.h - 2);
    }
    if (node.regionColor) {
      ctx.fillStyle = colorOn ? node.regionColor : theme.inkGhost;
      ctx.fillRect(rect.left, rect.top, 2, rect.h);
    }
    if (rect.w >= 48) {
      const showIcon = rect.w >= 74;
      let textX = rect.left + 7;
      if (showIcon) {
        const iconSize = Math.min(22, rect.h - 14);
        const iconX = rect.left + 8;
        const iconY = rect.top + (rect.h - iconSize) / 2;
        ctx.fillStyle = colorOn ? MV.hexToRgba(nodeColor, 0.22) : theme.roomHover;
        ctx.fillRect(iconX, iconY, iconSize, iconSize);
        ctx.strokeStyle = nodeColor || theme.roomBorder;
        ctx.strokeRect(iconX + 0.5, iconY + 0.5, iconSize - 1, iconSize - 1);
        ctx.font = '7px ' + FONT_MONO;
        ctx.fillStyle = node.type === 'root' ? theme.accentInk : (colorOn ? nodeColor : theme.ink);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.icon || '·', iconX + iconSize / 2, iconY + iconSize / 2 + 0.5);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        textX = iconX + iconSize + 7;
      }
      const maxText = rect.w - (textX - rect.left) - 7;
      ctx.font = (showIcon ? '9.5px ' : '9px ') + FONT_UI;
      ctx.fillStyle = node.type === 'root' ? theme.accentInk : theme.ink;
      ctx.fillText(truncate(ctx, node.label, Math.max(20, maxText)), textX, rect.top + rect.h * (showIcon ? 0.42 : 0.56));
      if (showIcon && rect.h >= 40) {
        ctx.font = '7px ' + FONT_MONO;
        ctx.fillStyle = node.type === 'root' ? theme.accentInk : theme.inkDim;
        ctx.fillText(truncate(ctx, node.sub || '', Math.max(20, maxText)), textX, rect.top + rect.h * 0.42 + 12);
      }
    } else {
      ctx.fillStyle = nodeColor || theme.ink;
      ctx.fillRect(rect.left + rect.w / 2 - 2, rect.top + rect.h / 2 - 2, 4, 4);
    }
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
    lastLayout = { width: W, height: H, cam, nodes: [], edgeChips: [], graph };

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, W, H);
    const gradient = ctx.createRadialGradient(W * 0.45, H * 0.42, 20, W * 0.45, H * 0.42, Math.max(W, H) * 0.8);
    gradient.addColorStop(0, theme.bgGlow);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    /* faint dot grid */
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

    const chipGateSeen = new Set();
    graph.edges.forEach(edge => drawEdge(ctx, edge, graph, cam, W, H, theme, view, chipGateSeen));
    drawEdgeChips(ctx, theme, view, W, H);
    graph.nodes.forEach(node => {
      drawNode(ctx, node, cam, W, H, theme, view);
      if (rectVisible(node, cam, W, H)) {
        lastLayout.nodes.push(Object.assign(nodeScreenRect(node, cam, W, H), {
          id: node.id, node
        }));
      }
    });
    return lastLayout;
  }

  function rectVisible(node, cam, W, H) {
    const rect = nodeScreenRect(node, cam, W, H);
    return !(rect.left > W + 80 || rect.top > H + 80 || rect.left + rect.w < -80 || rect.top + rect.h < -80);
  }

  function pick(view, W, H, x, y) {
    if (!lastLayout || lastLayout.width !== W || lastLayout.height !== H) return null;
    for (let i = lastLayout.nodes.length - 1; i >= 0; i--) {
      const entry = lastLayout.nodes[i];
      if (x >= entry.left && x <= entry.left + entry.w && y >= entry.top && y <= entry.top + entry.h) {
        return entry.node;
      }
    }
    for (let i = lastLayout.edgeChips.length - 1; i >= 0; i--) {
      const chip = lastLayout.edgeChips[i];
      if (!chip.rect) continue;
      if (x >= chip.rect.x && x <= chip.rect.x + chip.rect.w && y >= chip.rect.y && y <= chip.rect.y + chip.rect.h) {
        const gate = chip.gates[0];
        return {
          type: 'gate',
          linkId: gate.linkId,
          label: gate.name,
          icon: gate.code,
          sub: gate.requires.join(' + ') + (gate.keyReq ? ' · 钥匙 ' + gate.keyReq : ''),
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
