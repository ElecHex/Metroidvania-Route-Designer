/* ============================================================
   ROUTE FORGE — editable pseudo-3D room massing map
   ============================================================ */
(function (global) {
  'use strict';
  const MV = global.MV = global.MV || {};

  const FONT_UI = '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei", sans-serif';
  const FONT_MONO = '"Cascadia Mono", "Consolas", "Microsoft YaHei", monospace';
  const SCALE = 0.032;
  const HEIGHT_SCALE = 0.045;
  const FOV = 50 * Math.PI / 180;
  const NEAR = 0.06;

  let lastScene = null;

  function vec(x, y, z) { return { x, y, z }; }
  function add(a, b) { return vec(a.x + b.x, a.y + b.y, a.z + b.z); }
  function sub(a, b) { return vec(a.x - b.x, a.y - b.y, a.z - b.z); }
  function mul(a, s) { return vec(a.x * s, a.y * s, a.z * s); }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) { return vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  function normalize(a) {
    const len = Math.hypot(a.x, a.y, a.z) || 1;
    return vec(a.x / len, a.y / len, a.z / len);
  }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function mapBounds(project) {
    const rooms = project.rooms || [];
    if (!rooms.length) return { minX: -400, minY: -300, maxX: 400, maxY: 300 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    rooms.forEach(room => {
      minX = Math.min(minX, room.x);
      minY = Math.min(minY, room.y);
      maxX = Math.max(maxX, room.x + room.w);
      maxY = Math.max(maxY, room.y + room.h);
    });
    return { minX, minY, maxX, maxY };
  }

  function mapCenter(project) {
    const b = mapBounds(project);
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  }

  function computeBasis(W, H, cam) {
    const target = cam.target || vec(0, 1.2, 0);
    const dist = cam.dist || 45;
    const yaw = cam.yaw || 0;
    const pitch = cam.pitch == null ? 0.55 : cam.pitch;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const position = vec(
      target.x + dist * cp * Math.sin(yaw),
      target.y + dist * sp,
      target.z + dist * cp * Math.cos(yaw)
    );
    const forward = normalize(sub(target, position));
    const right = normalize(cross(forward, vec(0, 1, 0)));
    const up = normalize(cross(right, forward));
    return {
      position, target, forward, right, up,
      focal: (H / 2) / Math.tan(FOV / 2),
      W, H
    };
  }

  function projectPoint(basis, p) {
    const d = sub(p, basis.position);
    const z = dot(d, basis.forward);
    if (z <= NEAR) return null;
    return {
      x: basis.W / 2 + dot(d, basis.right) * basis.focal / z,
      y: basis.H / 2 - dot(d, basis.up) * basis.focal / z,
      z
    };
  }

  function sceneFor(project, W, H, cam, centerOverride) {
    const bounds = mapBounds(project);
    const center2d = centerOverride || {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    };
    const basis = computeBasis(W, H, cam);
    const boxes = [];

    (project.rooms || []).forEach(room => {
      const region = (project.regions || []).find(r => r.id === room.region);
      const regionElev = region ? (Number(region.elev) || 0) : 0;
      const center = vec(
        (room.x + room.w / 2 - center2d.x) * SCALE,
        (regionElev + room.elev) * HEIGHT_SCALE,
        (room.y + room.h / 2 - center2d.y) * SCALE
      );
      const width = room.w * SCALE;
      const depth = room.depth * SCALE;
      const height = room.height * HEIGHT_SCALE;
      const box = {
        id: room.id,
        room,
        cx: center.x, cz: center.z,
        base: center.y,
        top: center.y + height,
        minX: center.x - width / 2,
        maxX: center.x + width / 2,
        minZ: center.z - depth / 2,
        maxZ: center.z + depth / 2,
        width, depth, height,
        centerY: center.y + height / 2
      };
      box.center = vec(box.cx, box.centerY, box.cz);
      boxes.push(box);
    });

    return { bounds, center2d, basis, boxes, W, H, SCALE };
  }

  function fitCamera(project, W, H) {
    const bounds = mapBounds(project);
    const width = Math.max(10, (bounds.maxX - bounds.minX + 70) * SCALE);
    const depth = Math.max(10, (bounds.maxY - bounds.minY + 70) * SCALE);
    let minY = Infinity, maxY = -Infinity;
    (project.rooms || []).forEach(room => {
      const region = (project.regions || []).find(r => r.id === room.region);
      const base = ((region ? Number(region.elev) || 0 : 0) + room.elev) * HEIGHT_SCALE;
      minY = Math.min(minY, base);
      maxY = Math.max(maxY, base + room.height * HEIGHT_SCALE);
    });
    if (!Number.isFinite(minY)) { minY = 0; maxY = 2; }
    const span = Math.max(2, maxY - minY);
    const focal = (H / 2) / Math.tan(FOV / 2);
    const distH = (width * 1.15) * focal / (Math.max(1, W) * 0.76);
    const distV = span * 2.4 + 10;
    return {
      yaw: -0.62,
      pitch: 0.55,
      dist: clamp(Math.max(distH, distV, 20), 20, 190),
      target: vec(0, (minY + maxY) / 2, 0)
    };
  }

  function cameraPreset(name, project, W, H) {
    const cam = fitCamera(project, W, H);
    if (name === 'top') {
      cam.pitch = 1.35;
      cam.yaw = 0;
      cam.dist *= 1.05;
    } else if (name === 'front') {
      cam.pitch = 0.12;
      cam.yaw = 0;
    } else if (name === 'iso') {
      cam.pitch = 0.58;
      cam.yaw = -0.62;
    }
    return cam;
  }

  function focusRoom(project, view, roomId, W, H) {
    const sc = sceneFor(project, W, H, view.cam, view.center2d);
    const box = sc.boxes.find(b => b.id === roomId);
    if (!box) return;
    view.cam.target = vec(box.cx, box.centerY, box.cz);
    view.cam.dist = clamp(Math.max(box.width, box.depth, box.height) * 6.4, 8, 30);
    view.cam.pitch = Math.max(0.35, view.cam.pitch);
  }

  /* ---------------- modeled corridors ---------------- */
  function addProjectedFace(faces, sc, points, opts) {
    const projected = points.map(point => projectPoint(sc.basis, point));
    if (projected.some(point => !point)) return false;
    const depth = projected.reduce((sum, point) => sum + point.z, 0) / projected.length;
    faces.push({
      points: projected,
      fill: opts.fill,
      stroke: opts.stroke,
      width: opts.width || 0.7,
      depth,
      selected: !!opts.selected,
      hover: !!opts.hover,
      reachable: opts.reachable !== false,
      corridor: !!opts.corridor,
      detail: !!opts.detail
    });
    return true;
  }

  function addGenericBox(faces, sc, box, opts) {
    const b000 = vec(box.minX, box.base, box.minZ);
    const b100 = vec(box.maxX, box.base, box.minZ);
    const b110 = vec(box.maxX, box.base, box.maxZ);
    const b010 = vec(box.minX, box.base, box.maxZ);
    const t000 = vec(box.minX, box.top, box.minZ);
    const t100 = vec(box.maxX, box.top, box.minZ);
    const t110 = vec(box.maxX, box.top, box.maxZ);
    const t010 = vec(box.minX, box.top, box.maxZ);
    const topFill = opts.topFill || opts.fill;
    const sideFill = opts.sideFill || opts.fill;
    const bottomFill = opts.bottomFill || sideFill;
    const defs = [
      { points: [t000, t100, t110, t010], fill: topFill },
      { points: [b000, b010, b110, b100], fill: bottomFill },
      { points: [b000, b010, t010, t000], fill: sideFill },
      { points: [b100, b110, t110, t100], fill: sideFill },
      { points: [b000, b100, t100, t000], fill: sideFill },
      { points: [b010, b110, t110, t010], fill: sideFill }
    ];
    defs.forEach(def => {
      addProjectedFace(faces, sc, def.points, {
        fill: def.fill,
        stroke: opts.stroke,
        width: opts.width,
        selected: opts.selected,
        hover: opts.hover,
        reachable: opts.reachable,
        corridor: opts.corridor,
        detail: true
      });
    });
  }

  function addOrientedPrism(faces, sc, ax, az, bx, bz, y, width, height, opts) {
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.hypot(dx, dz);
    if (length < 0.015) return;
    const ux = dx / length;
    const uz = dz / length;
    const px = -uz;
    const pz = ux;
    const hw = width / 2;
    const hh = height / 2;
    const b0 = vec(ax + px * hw, y - hh, az + pz * hw);
    const b1 = vec(bx + px * hw, y - hh, bz + pz * hw);
    const b2 = vec(bx - px * hw, y - hh, bz - pz * hw);
    const b3 = vec(ax - px * hw, y - hh, az - pz * hw);
    const t0 = vec(b0.x, y + hh, b0.z);
    const t1 = vec(b1.x, y + hh, b1.z);
    const t2 = vec(b2.x, y + hh, b2.z);
    const t3 = vec(b3.x, y + hh, b3.z);
    addProjectedFace(faces, sc, [t0, t1, t2, t3], {
      fill: opts.topFill, stroke: opts.stroke, width: opts.width,
      selected: opts.selected, corridor: true
    });
    addProjectedFace(faces, sc, [b0, b1, b2, b3], {
      fill: opts.sideFill, stroke: opts.stroke, width: opts.width,
      selected: opts.selected, corridor: true
    });
    [[b0, b1, t1, t0], [b1, b2, t2, t1], [b2, b3, t3, t2], [b3, b0, t0, t3]].forEach(points => {
      addProjectedFace(faces, sc, points, {
        fill: opts.sideFill, stroke: opts.stroke, width: opts.width,
        selected: opts.selected, corridor: true
      });
    });
  }

  function corridorAnchors(a, b) {
    const dx = b.cx - a.cx;
    const dz = b.cz - a.cz;
    let ax, az, bx, bz;
    if (Math.abs(dx) >= Math.abs(dz)) {
      const sx = dx === 0 ? 1 : Math.sign(dx);
      ax = a.cx + sx * (a.width / 2 + 0.04);
      bx = b.cx - sx * (b.width / 2 + 0.04);
      az = clamp(b.cz, a.minZ + 0.24, a.maxZ - 0.24);
      bz = clamp(a.cz, b.minZ + 0.24, b.maxZ - 0.24);
    } else {
      const sz = dz === 0 ? 1 : Math.sign(dz);
      az = a.cz + sz * (a.depth / 2 + 0.04);
      bz = b.cz - sz * (b.depth / 2 + 0.04);
      ax = clamp(b.cx, a.minX + 0.24, a.maxX - 0.24);
      bx = clamp(a.cx, b.minX + 0.24, b.maxX - 0.24);
    }
    return {
      a: { x: ax, z: az, y: a.base + a.height * 0.42 },
      b: { x: bx, z: bz, y: b.base + b.height * 0.42 }
    };
  }

  function buildCorridors(project, view, sc) {
    const t = MV.canvasTheme();
    const faces = [];
    const labels = [];
    const boxes = {};
    sc.boxes.forEach(box => { boxes[box.id] = box; });
    const pathSet = new Set((view.analysis && view.analysis.pathLinks) || []);
    const selectedRoom = view.selection && view.selection.type === 'room' ? view.selection.id : null;

    (project.links || []).forEach(link => {
      const a = boxes[link.a];
      const b = boxes[link.b];
      if (!a || !b) return;
      const gate = MV.gateById(link.gate);
      const gateAccent = MV.gateColor(gate, view.colorMode);
      const targetRegion = project.regions.find(r => r.id === b.room.region);
      const regionAccent = MV.regionColor(targetRegion || project.regions[0], view.colorMode);
      const plainLink = (!link.requires || link.requires.length === 0) && !link.keyReq && (gate.style === 'open' || gate.style === 'transit');
      const corridorAccent = plainLink ? regionAccent : gateAccent;
      const corridorStrokeColor = t.name === 'light'
        ? MV.mixColor(corridorAccent, t.ink, 0.34)
        : corridorAccent;
      const selected = !!selectedRoom && (selectedRoom === link.a || selectedRoom === link.b);
      const isPath = pathSet.has(link.id);
      const open = view.analysis && view.analysis.openLinks
        ? view.analysis.openLinks[link.id] !== undefined
        : true;
      const anchors = corridorAnchors(a, b);
      let topFill;
      let sideFill;
      let stroke;
      if (selected) {
        topFill = MV.mixColor(t.corridorTop, t.accent, 0.58);
        sideFill = MV.mixColor(t.corridorSide, t.accent, 0.34);
        stroke = t.accent;
      } else if (isPath) {
        topFill = MV.mixColor(t.corridorTop, corridorAccent, 0.7);
        sideFill = MV.mixColor(t.corridorSide, corridorAccent, 0.5);
        stroke = corridorStrokeColor;
      } else if (view.colorMode === 'mono') {
        topFill = t.corridorTop;
        sideFill = t.corridorSide;
        stroke = t.corridorEdge;
      } else {
        topFill = MV.mixColor(t.corridorTop, corridorAccent, 0.55);
        sideFill = MV.mixColor(t.corridorSide, corridorAccent, 0.4);
        stroke = MV.hexToRgba(corridorStrokeColor, 0.78);
      }
      const prismStyle = { topFill, sideFill, stroke, width: selected ? 1.1 : (isPath ? 0.9 : 0.7), selected };
      const doorStyle = { fill: sideFill, topFill, stroke, width: selected ? 1 : 0.6, selected, corridor: true };

      const threshold = (point) => {
        const size = 0.16;
        addGenericBox(faces, sc, {
          minX: point.x - size, maxX: point.x + size,
          minZ: point.z - size, maxZ: point.z + size,
          base: point.y - 0.22, top: point.y + 0.28
        }, doorStyle);
      };

      const labelPoint = (x, y, z) => labels.push({
        link, gate, point: vec(x, y, z), selected, open, isPath, gateAccent,
        oneWay: link.dir !== 'both', direction: link.dir
      });

      const dy = Math.abs(anchors.a.y - anchors.b.y);
      if (dy < 0.24) {
        addOrientedPrism(faces, sc, anchors.a.x, anchors.a.z, anchors.b.x, anchors.b.z,
          (anchors.a.y + anchors.b.y) / 2, 0.46, 0.36, prismStyle);
      } else {
        const mx = (anchors.a.x + anchors.b.x) / 2;
        const mz = (anchors.a.z + anchors.b.z) / 2;
        addOrientedPrism(faces, sc, anchors.a.x, anchors.a.z, mx, mz, anchors.a.y, 0.46, 0.34, prismStyle);
        addOrientedPrism(faces, sc, mx, mz, anchors.b.x, anchors.b.z, anchors.b.y, 0.46, 0.34, prismStyle);
        addGenericBox(faces, sc, {
          minX: mx - 0.14, maxX: mx + 0.14,
          minZ: mz - 0.14, maxZ: mz + 0.14,
          base: Math.min(anchors.a.y, anchors.b.y) - 0.12,
          top: Math.max(anchors.a.y, anchors.b.y) + 0.12
        }, { fill: sideFill, topFill, stroke, width: selected || isPath ? 1 : 0.6, selected, corridor: true });
      }

      threshold(anchors.a);
      threshold(anchors.b);
      const gateY = (anchors.a.y + anchors.b.y) / 2;
      const gateX = (anchors.a.x + anchors.b.x) / 2;
      const gateZ = (anchors.a.z + anchors.b.z) / 2;
      addGenericBox(faces, sc, {
        minX: gateX - 0.22, maxX: gateX + 0.22,
        minZ: gateZ - 0.07, maxZ: gateZ + 0.07,
        base: gateY - 0.26, top: gateY + 0.28
      }, { fill: topFill, topFill: stroke, stroke, width: selected || isPath ? 1.2 : 0.8, selected, corridor: true });

      labelPoint(gateX, gateY + 0.46, gateZ);
    });

    return { faces, labels };
  }

  function drawCorridorLabels(ctx, project, view, sc, labels) {
    const t = MV.canvasTheme();
    (labels || []).forEach(entry => {
      const selected = entry.selected;
      const show = selected || view.cam.dist < 27 || (!entry.open && view.cam.dist < 44);
      if (!show) return;
      const p = projectPoint(sc.basis, entry.point);
      if (!p || p.x < -60 || p.x > sc.W + 60 || p.y < -40 || p.y > sc.H + 40) return;
      const gate = entry.gate;
      const accent = entry.gateAccent
        ? (t.name === 'light' ? MV.mixColor(entry.gateAccent, t.ink, 0.32) : entry.gateAccent)
        : t.inkDim;
      const text = gate.code + (selected && view.cam.dist < 22 ? ' ' + gate.name : '') + (entry.oneWay ? (entry.direction === 'b2a' ? ' ←' : ' →') : '');
      ctx.save();
      ctx.font = '7.5px ' + FONT_MONO;
      const width = ctx.measureText(text).width + 10;
      ctx.fillStyle = t.labelBg;
      ctx.fillRect(p.x - width / 2, p.y - 9, width, 13);
      ctx.strokeStyle = selected ? t.accent : MV.hexToRgba(accent, 0.7);
      ctx.strokeRect(p.x - width / 2 + 0.5, p.y - 8.5, width - 1, 12);
      ctx.fillStyle = selected ? t.accent : accent;
      ctx.textAlign = 'center';
      ctx.fillText(text, p.x, p.y + 0.5);
      ctx.textAlign = 'left';
      ctx.restore();
    });
  }

  function drawBackground(ctx, W, H) {
    const t = MV.canvasTheme();
    ctx.fillStyle = t.bg3d;
    ctx.fillRect(0, 0, W, H);
    const gradient = ctx.createRadialGradient(W * 0.5, H * 0.42, 20, W * 0.5, H * 0.42, Math.max(W, H) * 0.78);
    gradient.addColorStop(0, t.bgGlow);
    gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = t.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = H * 0.12 + i * H * 0.18;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
    }
  }

  function drawPlates(ctx, project, sc, view) {
    const t = MV.canvasTheme();
    const labels = [];
    (project.regions || []).forEach(region => {
      const regionRooms = (project.rooms || []).filter(room => room.region === region.id);
      if (!regionRooms.length) return;
      const regionAccent = MV.regionColor(region, view.colorMode);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      regionRooms.forEach(room => {
        minX = Math.min(minX, room.x);
        minY = Math.min(minY, room.y);
        maxX = Math.max(maxX, room.x + room.w);
        maxY = Math.max(maxY, room.y + room.h);
      });
      const pad = 30;
      const regionElev = (Number(region.elev) || 0) * HEIGHT_SCALE;
      const worldCorners = [
        [minX - pad, minY - pad], [maxX + pad, minY - pad],
        [maxX + pad, maxY + pad], [minX - pad, maxY + pad]
      ].map(([x, y]) => vec(
        (x - sc.center2d.x) * SCALE, regionElev + 0.015, (y - sc.center2d.y) * SCALE
      ));
      const corners = worldCorners.map(p => projectPoint(sc.basis, p));
      if (corners.some(p => !p)) return;
      ctx.save();
      ctx.beginPath();
      corners.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.closePath();
      ctx.fillStyle = view.colorMode === 'mono' ? t.plateFill : MV.hexToRgba(regionAccent, 0.035);
      ctx.fill();
      ctx.strokeStyle = view.colorMode === 'mono' ? t.plateStroke : MV.hexToRgba(regionAccent, 0.26);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (regionElev) {
        ctx.strokeStyle = t.dropLine;
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        worldCorners.forEach(world => {
          const ground = projectPoint(sc.basis, vec(world.x, 0, world.z));
          const top = projectPoint(sc.basis, world);
          if (!ground || !top) return;
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(ground.x, ground.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
      labels.push({ region, point: corners[0], roomCount: regionRooms.length, accent: regionAccent });
    });
    return labels;
  }

  function drawGrid(ctx, project, sc) {
    const t = MV.canvasTheme();
    const b = sc.bounds;
    const pad = 8;
    const minX = (b.minX - sc.center2d.x) * SCALE - pad;
    const maxX = (b.maxX - sc.center2d.x) * SCALE + pad;
    const minZ = (b.minY - sc.center2d.y) * SCALE - pad;
    const maxZ = (b.maxY - sc.center2d.y) * SCALE + pad;
    const step = 3;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = t.grid;
    ctx.beginPath();
    for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) {
      const a = projectPoint(sc.basis, vec(x, 0, minZ));
      const c = projectPoint(sc.basis, vec(x, 0, maxZ));
      if (!a || !c) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
    }
    for (let z = Math.floor(minZ / step) * step; z <= maxZ; z += step) {
      const a = projectPoint(sc.basis, vec(minX, 0, z));
      const c = projectPoint(sc.basis, vec(maxX, 0, z));
      if (!a || !c) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
    }
    ctx.stroke();

    ctx.strokeStyle = t.gridMajor;
    const edges = [
      [vec(minX, 0, minZ), vec(maxX, 0, minZ)],
      [vec(maxX, 0, minZ), vec(maxX, 0, maxZ)],
      [vec(maxX, 0, maxZ), vec(minX, 0, maxZ)],
      [vec(minX, 0, maxZ), vec(minX, 0, minZ)]
    ];
    ctx.beginPath();
    edges.forEach(([a, b2]) => {
      const pa = projectPoint(sc.basis, a);
      const pb = projectPoint(sc.basis, b2);
      if (!pa || !pb) return;
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawLinks(ctx, project, view, sc, highlightedOnly) {
    const t = MV.canvasTheme();
    const boxes = {};
    sc.boxes.forEach(box => { boxes[box.id] = box; });
    const selection = view.selection;
    const pathSet = new Set((view.analysis && view.analysis.pathLinks) || []);
    const selectedRoom = selection && selection.type === 'room' ? selection.id : null;

    (project.links || []).forEach(link => {
      const a = boxes[link.a], b = boxes[link.b];
      if (!a || !b) return;
      const involvesSelected = selectedRoom && (link.a === selectedRoom || link.b === selectedRoom);
      if (highlightedOnly && !involvesSelected) return;
      if (!highlightedOnly && selectedRoom && involvesSelected) return;

      const pa = projectPoint(sc.basis, vec(a.cx, a.base + a.height * 0.34, a.cz));
      const pb = projectPoint(sc.basis, vec(b.cx, b.base + b.height * 0.34, b.cz));
      if (!pa || !pb) return;
      const gate = MV.gateById(link.gate);
      const gateAccent = MV.gateColor(gate, view.colorMode);
      const isPath = pathSet.has(link.id);
      let stroke = view.colorMode === 'mono' ? t.line : MV.hexToRgba(gateAccent || t.line, 0.5);
      let width = 1;
      if (isPath) { stroke = MV.hexToRgba(t.accent, 0.45); width = 1.3; }
      if (highlightedOnly) { stroke = gateAccent || t.accent; width = 1.4; }
      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      if (gate.style === 'transit') ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.setLineDash([]);

      if (link.dir !== 'both' && pa) {
        const mx = pa.x + (pb.x - pa.x) * 0.66;
        const my = pa.y + (pb.y - pa.y) * 0.66;
        const angle = Math.atan2(pb.y - pa.y, pb.x - pa.x) + (link.dir === 'b2a' ? Math.PI : 0);
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(angle);
        ctx.fillStyle = t.inkDim;
        ctx.beginPath();
        ctx.moveTo(4, 0); ctx.lineTo(-3, -3); ctx.lineTo(-3, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      if (highlightedOnly || (view.layers.gates && sc.basis.W > 0 && view.cam.dist < 30 && isPath)) {
        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2;
        ctx.font = '7px ' + FONT_MONO;
        ctx.textAlign = 'center';
        ctx.fillStyle = t.labelBg;
        const tw = ctx.measureText(gate.code).width;
        ctx.fillRect(mx - tw / 2 - 3, my - 8, tw + 6, 12);
        ctx.fillStyle = gateAccent || (highlightedOnly ? t.inkStrong : t.inkDim);
        ctx.fillText(gate.code, mx, my + 1);
        ctx.textAlign = 'left';
      }
      ctx.restore();
    });
  }

  function drawBoxes(ctx, project, view, sc, corridorFaces) {
    const t = MV.canvasTheme();
    const boxes = sc.boxes;
    const camPos = sc.basis.position;
    const maxPhase = Math.max(1, (view.analysis && view.analysis.stepCount ? view.analysis.stepCount - 1 : 1));
    const faces = corridorFaces ? corridorFaces.slice() : [];

    boxes.forEach(box => {
      const room = box.room;
      const region = project.regions.find(r => r.id === room.region);
      const regionAccent = MV.regionColor(region, view.colorMode);
      const phase = view.analysis && view.analysis.roomPhase ? view.analysis.roomPhase[room.id] : 0;
      const phaseT = phase === undefined ? 0 : clamp(phase / maxPhase, 0, 1);
      const phaseAccent = MV.phaseColor(project, phase === undefined ? 0 : phase, maxPhase);
      const reachable = view.analysis ? view.analysis.reachable.includes(room.id) : true;
      const selected = view.selection && view.selection.type === 'room' && view.selection.id === room.id;
      const hover = view.hover && view.hover.type === 'room' && view.hover.id === room.id;
      const typeColor = MV.roomTypeById(room.type).color;

      const visible = [];
      if (camPos.y > box.top) visible.push('top');
      if (camPos.x > box.cx) visible.push('x');
      else visible.push('x');
      if (camPos.z > box.cz) visible.push('z');
      else visible.push('z');

      function colorFor(face) {
        if (!reachable) return face === 'top' ? t.boxTopUnreachable : (face === 'x' ? t.boxXUnreachable : t.boxZUnreachable);
        if (selected) return face === 'top' ? t.boxTopSelected : (face === 'x' ? t.boxXSelected : t.boxZSelected);
        if (hover) return face === 'top' ? t.boxTopHover : (face === 'x' ? t.boxXHover : t.boxZHover);
        const base = face === 'top' ? t.boxTop : (face === 'x' ? t.boxX : t.boxZ);
        if (view.colorMode === 'mono') return base;
        const regionMix = face === 'top' ? 0.28 : (face === 'x' ? 0.18 : 0.13);
        const phaseMix = face === 'top' ? 0.1 + phaseT * 0.08 : 0.05 + phaseT * 0.05;
        return MV.mixColor(MV.mixColor(base, regionAccent, regionMix), phaseAccent, phaseMix);
      }

      function strokeFor(face) {
        if (selected) return { color: t.accent, width: 1.25 };
        if (hover) return { color: t.boxStrokeHover, width: 1 };
        if (!reachable) return { color: t.boxStrokeUnreachable, width: 0.7 };
        if (view.colorMode !== 'mono' && face === 'top') {
          return { color: MV.hexToRgba(regionAccent, t.name === 'light' ? 0.55 : 0.45), width: 0.85 };
        }
        return { color: t.boxStroke, width: 0.7 };
      }

      function addFace(face, points) {
        const projected = points.map(p => projectPoint(sc.basis, p));
        if (projected.some(p => !p)) return;
        const depth = projected.reduce((sum, p) => sum + p.z, 0) / projected.length;
        const style = strokeFor(face);
        faces.push({
          face, points: projected, fill: colorFor(face), stroke: style.color, width: style.width,
          depth, selected, hover, reachable, room
        });
      }

      addFace('top', [
        vec(box.minX, box.top, box.minZ),
        vec(box.maxX, box.top, box.minZ),
        vec(box.maxX, box.top, box.maxZ),
        vec(box.minX, box.top, box.maxZ)
      ]);
      if (camPos.x > box.cx) {
        addFace('x', [
          vec(box.maxX, box.base, box.minZ),
          vec(box.maxX, box.base, box.maxZ),
          vec(box.maxX, box.top, box.maxZ),
          vec(box.maxX, box.top, box.minZ)
        ]);
      } else {
        addFace('x', [
          vec(box.minX, box.base, box.minZ),
          vec(box.minX, box.base, box.maxZ),
          vec(box.minX, box.top, box.maxZ),
          vec(box.minX, box.top, box.minZ)
        ]);
      }
      if (camPos.z > box.cz) {
        addFace('z', [
          vec(box.minX, box.base, box.maxZ),
          vec(box.maxX, box.base, box.maxZ),
          vec(box.maxX, box.top, box.maxZ),
          vec(box.minX, box.top, box.maxZ)
        ]);
      } else {
        addFace('z', [
          vec(box.minX, box.base, box.minZ),
          vec(box.maxX, box.base, box.minZ),
          vec(box.maxX, box.top, box.minZ),
          vec(box.minX, box.top, box.minZ)
        ]);
      }

      /* type-coloured roof panel + simple 3D type markers */
      const detailTop = view.colorMode === 'mono'
        ? MV.mixColor(t.boxTop, t.accent, 0.18)
        : MV.mixColor(t.boxTop, typeColor, 0.52);
      const detailSide = view.colorMode === 'mono'
        ? MV.mixColor(t.boxX, t.accent, 0.13)
        : MV.mixColor(t.boxX, typeColor, 0.36);
      const detailStroke = selected
        ? t.accent
        : (view.colorMode === 'mono' ? t.boxStroke : MV.hexToRgba(typeColor, 0.68));
      const inset = room.type === 'hub' ? 0.14 : (room.type === 'boss' ? 0.18 : 0.23);
      addGenericBox(faces, sc, {
        minX: box.minX + box.width * inset,
        maxX: box.maxX - box.width * inset,
        minZ: box.minZ + box.depth * inset,
        maxZ: box.maxZ - box.depth * inset,
        base: box.top,
        top: box.top + 0.05
      }, {
        topFill: detailTop,
        sideFill: detailSide,
        stroke: detailStroke,
        width: selected ? 1 : 0.5,
        selected
      });

      if (room.type === 'save' || room.type === 'start' || room.type === 'goal') {
        const height = room.type === 'goal' ? 0.62 : (room.type === 'save' ? 0.34 : 0.48);
        const size = 0.08;
        addGenericBox(faces, sc, {
          minX: box.cx - size, maxX: box.cx + size,
          minZ: box.cz - size, maxZ: box.cz + size,
          base: box.top + 0.05,
          top: box.top + 0.05 + height
        }, {
          topFill: view.colorMode === 'mono' ? t.boxTopHover : typeColor,
          sideFill: detailSide,
          stroke: selected ? t.accent : detailStroke,
          width: 0.6,
          selected
        });
      } else if (room.type === 'boss') {
        addGenericBox(faces, sc, {
          minX: box.cx - box.width * 0.17, maxX: box.cx + box.width * 0.17,
          minZ: box.cz - box.depth * 0.17, maxZ: box.cz + box.depth * 0.17,
          base: box.top + 0.05,
          top: box.top + 0.22
        }, {
          topFill: view.colorMode === 'mono' ? t.boxTopHover : MV.mixColor(t.boxTop, typeColor, 0.7),
          sideFill: detailSide,
          stroke: selected ? t.accent : detailStroke,
          width: 0.7,
          selected
        });
      } else if (room.type === 'transit') {
        addGenericBox(faces, sc, {
          minX: box.minX + box.width * 0.16, maxX: box.maxX - box.width * 0.16,
          minZ: box.cz - 0.05, maxZ: box.cz + 0.05,
          base: box.top + 0.05,
          top: box.top + 0.16
        }, {
          topFill: view.colorMode === 'mono' ? t.boxTopHover : typeColor,
          sideFill: detailSide,
          stroke: selected ? t.accent : detailStroke,
          width: 0.6,
          selected
        });
      }
    });

    faces.sort((a, b) => b.depth - a.depth);
    faces.forEach(item => {
      ctx.save();
      ctx.beginPath();
      item.points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.closePath();
      ctx.fillStyle = item.fill;
      ctx.fill();
      ctx.strokeStyle = item.stroke;
      ctx.lineWidth = item.width;
      if (!item.reachable) ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });

    /* bright outline for selected / hovered boxes */
    boxes.forEach(box => {
      const selected = view.selection && view.selection.type === 'room' && view.selection.id === box.id;
      const hover = view.hover && view.hover.type === 'room' && view.hover.id === box.id;
      if (!selected && !hover) return;
      const corners = [
        vec(box.minX, box.base, box.minZ), vec(box.maxX, box.base, box.minZ),
        vec(box.maxX, box.base, box.maxZ), vec(box.minX, box.base, box.maxZ),
        vec(box.minX, box.top, box.minZ), vec(box.maxX, box.top, box.minZ),
        vec(box.maxX, box.top, box.maxZ), vec(box.minX, box.top, box.maxZ)
      ].map(p => projectPoint(sc.basis, p));
      if (corners.some(p => !p)) return;
      ctx.save();
      ctx.strokeStyle = selected ? t.accent : t.boxStrokeHover;
      ctx.lineWidth = selected ? 1.2 : 0.9;
      const rects = [[0, 1, 2, 3], [4, 5, 6, 7]];
      rects.forEach(indices => {
        ctx.beginPath();
        indices.forEach((idx, i) => { if (i === 0) ctx.moveTo(corners[idx].x, corners[idx].y); else ctx.lineTo(corners[idx].x, corners[idx].y); });
        ctx.closePath();
        ctx.stroke();
      });
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(corners[i].x, corners[i].y);
        ctx.lineTo(corners[i + 4].x, corners[i + 4].y);
        ctx.stroke();
      }
      if (selected) {
        const ground = projectPoint(sc.basis, vec(box.cx, 0, box.cz));
        const top = projectPoint(sc.basis, vec(box.cx, box.base, box.cz));
        if (ground && top) {
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = t.dropLine;
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(ground.x, ground.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.restore();
    });

    return faces;
  }

  function drawItems(ctx, project, view, sc) {
    const t = MV.canvasTheme();
    const boxes = {};
    sc.boxes.forEach(box => { boxes[box.id] = box; });
    const byRoom = {};
    (project.items || []).forEach(item => { (byRoom[item.room] = byRoom[item.room] || []).push(item); });
    Object.keys(byRoom).forEach(roomId => {
      const box = boxes[roomId];
      if (!box) return;
      const items = byRoom[roomId];
      const p = projectPoint(sc.basis, vec(box.cx, box.top + 0.25, box.cz));
      if (!p) return;
      const selected = view.selection && view.selection.type === 'room' && view.selection.id === roomId;
      const itemAccent = MV.itemColor(items[0], view.colorMode);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = selected ? t.accent : (itemAccent || t.inkDim);
      ctx.lineWidth = 1;
      ctx.strokeRect(-2.5, -2.5, 5, 5);
      ctx.restore();
      if (selected && items.length) {
        ctx.save();
        ctx.font = '7px ' + FONT_MONO;
        ctx.fillStyle = t.inkDim;
        ctx.textAlign = 'center';
        ctx.fillText(items.length + ' ITEM' + (items.length > 1 ? 'S' : ''), p.x, p.y - 9);
        ctx.textAlign = 'left';
        ctx.restore();
      }
    });
  }

  function drawRoomLabels(ctx, project, view, sc) {
    if (!view.layers.names) return;
    const t = MV.canvasTheme();
    const near = view.cam.dist < 27;
    sc.boxes.forEach(box => {
      const selected = view.selection && view.selection.type === 'room' && view.selection.id === box.id;
      const hover = view.hover && view.hover.type === 'room' && view.hover.id === box.id;
      if (!near && !selected && !hover) return;
      const p = projectPoint(sc.basis, vec(box.cx, box.top + 0.6, box.cz));
      if (!p || p.x < -80 || p.x > sc.W + 80 || p.y < -40 || p.y > sc.H + 40) return;
      const region = project.regions.find(r => r.id === box.room.region);
      const name = box.room.name;
      ctx.save();
      ctx.font = (selected ? '10px ' : '8px ') + FONT_UI;
      const tw = ctx.measureText(name).width;
      const pad = 4;
      if (selected) {
        ctx.font = '7px ' + FONT_MONO;
        const kicker = (region ? region.code : 'ZONE') + ' / ' + MV.roomTypeById(box.room.type).code;
        const kw = ctx.measureText(kicker).width;
        const width = Math.max(tw, kw) + pad * 2 + 2;
        ctx.fillStyle = t.threeLabelBg;
        ctx.fillRect(p.x - width / 2, p.y - 30, width, 28);
        ctx.strokeStyle = t.threeLabelStroke;
        ctx.strokeRect(p.x - width / 2 + 0.5, p.y - 29.5, width - 1, 27);
        ctx.font = '7px ' + FONT_MONO;
        ctx.fillStyle = t.threeLabelInkDim;
        ctx.textAlign = 'center';
        ctx.fillText(kicker, p.x, p.y - 20);
        ctx.font = '10px ' + FONT_UI;
        ctx.fillStyle = t.threeLabelInk;
        ctx.fillText(name, p.x, p.y - 8);
        ctx.textAlign = 'left';
      } else if (near || hover) {
        ctx.fillStyle = t.threeLabelBg;
        ctx.fillRect(p.x - tw / 2 - pad, p.y - 12, tw + pad * 2, 11);
        ctx.fillStyle = hover ? t.threeLabelInk : t.threeLabelInkDim;
        ctx.textAlign = 'center';
        ctx.fillText(name, p.x, p.y - 4);
        ctx.textAlign = 'left';
      }
      ctx.restore();
    });

    /* goal marker */
    if (view.selection && view.selection.type === 'room') {
      const box = sc.boxes.find(b => b.id === view.selection.id);
      if (box) {
        const p = projectPoint(sc.basis, vec(box.cx, box.top + 0.15, box.cz));
        if (p) {
          ctx.save();
          ctx.font = '7px ' + FONT_MONO;
          ctx.fillStyle = t.threeLabelInkDim;
          ctx.textAlign = 'center';
          ctx.fillText('H ' + Math.round(box.room.height) + '  /  E ' + Math.round(box.room.elev) + '  /  D ' + Math.round(box.room.depth), p.x, p.y + 18);
          ctx.textAlign = 'left';
          ctx.restore();
        }
      }
    }
  }

  function drawRegionLabels(ctx, project, sc, labels) {
    const t = MV.canvasTheme();
    (labels || []).forEach(entry => {
      const p = entry.point;
      if (p.x < -100 || p.x > sc.W + 100 || p.y < -60 || p.y > sc.H + 60) return;
      const accent = t.name === 'light' ? MV.mixColor(entry.accent || t.threeLabelInk, t.ink, 0.3) : (entry.accent || t.threeLabelInk);
      const count = String(entry.roomCount).padStart(2, '0') + ' ROOMS';
      ctx.save();
      ctx.font = '7.5px ' + FONT_MONO;
      const codeWidth = ctx.measureText(entry.region.code).width;
      ctx.font = '7.5px ' + FONT_UI;
      const nameWidth = ctx.measureText(' / ' + entry.region.name).width;
      ctx.font = '7.5px ' + FONT_MONO;
      const width = 11 + codeWidth + nameWidth + 8;
      const height = 25;
      ctx.fillStyle = t.threeLabelBg;
      ctx.fillRect(p.x + 4, p.y - 17, width, height);
      ctx.strokeStyle = t.threeLabelStroke;
      ctx.strokeRect(p.x + 4.5, p.y - 16.5, width - 1, height - 1);
      ctx.fillStyle = accent;
      ctx.fillRect(p.x + 4, p.y - 17, 2, height);
      ctx.fillStyle = accent;
      ctx.fillText(entry.region.code, p.x + 11, p.y - 6);
      ctx.font = '7.5px ' + FONT_UI;
      ctx.fillStyle = t.threeLabelInk;
      ctx.fillText(' / ' + entry.region.name, p.x + 12 + ctx.measureText(entry.region.code).width, p.y - 6);
      ctx.font = '6.5px ' + FONT_MONO;
      ctx.fillStyle = t.threeLabelInkDim;
      ctx.fillText(count, p.x + 11, p.y + 3);
      ctx.restore();
    });
  }

  function drawSelectionInfo(ctx, project, view, sc) {
    if (!view.selection || view.selection.type !== 'room') return;
    const t = MV.canvasTheme();
    const box = sc.boxes.find(b => b.id === view.selection.id);
    if (!box) return;
    const room = box.room;
    const items = (project.items || []).filter(item => item.room === room.id);
    const lines = [];
    if (items.length) {
      items.slice(0, 4).forEach(item => lines.push(item.name));
      if (items.length > 4) lines.push('+' + (items.length - 4) + ' MORE');
    }
    if (!lines.length) return;
    const p = projectPoint(sc.basis, vec(box.cx, box.top + 1.05, box.cz));
    if (!p) return;
    ctx.save();
    ctx.font = '8px ' + FONT_UI;
    const width = Math.max.apply(null, lines.map(line => ctx.measureText(line).width)) + 14;
    const height = lines.length * 11 + 8;
    ctx.fillStyle = t.infoBg;
    ctx.fillRect(p.x - width / 2, p.y - height, width, height);
    ctx.strokeStyle = t.infoStroke;
    ctx.strokeRect(p.x - width / 2 + 0.5, p.y - height + 0.5, width - 1, height - 1);
    ctx.fillStyle = t.infoInk;
    ctx.textAlign = 'center';
    lines.forEach((line, i) => ctx.fillText(line, p.x, p.y - height + 12 + i * 11));
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawScene(ctx, W, H, project, view) {
    drawBackground(ctx, W, H);
    const sc = sceneFor(project, W, H, view.cam, view.center2d);
    const plates = drawPlates(ctx, project, sc, view);
    drawGrid(ctx, project, sc);
    const corridors = buildCorridors(project, view, sc);
    drawBoxes(ctx, project, view, sc, corridors.faces);
    drawCorridorLabels(ctx, project, view, sc, corridors.labels);
    drawItems(ctx, project, view, sc);
    drawRoomLabels(ctx, project, view, sc);
    drawRegionLabels(ctx, project, sc, plates);
    drawSelectionInfo(ctx, project, view, sc);
    lastScene = sc;
    return sc;
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
    ctx.clearRect(0, 0, W, H);
    drawScene(ctx, W, H, project, view);
  }

  function makeRay(sc, x, y) {
    const focal = sc.basis.focal;
    const rx = (x - sc.W / 2) / focal;
    const ry = (sc.H / 2 - y) / focal;
    const dir = normalize(add(add(sc.basis.forward, mul(sc.basis.right, rx)), mul(sc.basis.up, ry)));
    return { origin: sc.basis.position, dir };
  }

  function intersectBox(ray, box) {
    let tmin = -Infinity, tmax = Infinity;
    const min = vec(box.minX, box.base, box.minZ);
    const max = vec(box.maxX, box.top, box.maxZ);
    const axes = ['x', 'y', 'z'];
    for (let i = 0; i < axes.length; i++) {
      const axis = axes[i];
      const o = ray.origin[axis], d = ray.dir[axis];
      const lo = min[axis], hi = max[axis];
      if (Math.abs(d) < 1e-8) {
        if (o < lo || o > hi) return null;
      } else {
        let t1 = (lo - o) / d;
        let t2 = (hi - o) / d;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }
    if (tmax < 0) return null;
    return tmin > 0 ? tmin : tmax;
  }

  function pick(project, view, W, H, x, y) {
    const sc = sceneFor(project, W, H, view.cam, view.center2d);
    const ray = makeRay(sc, x, y);
    let best = null;
    sc.boxes.forEach(box => {
      const t = intersectBox(ray, box);
      if (t !== null && (!best || t < best.t)) best = { t, id: box.id, box };
    });
    return best ? { type: 'room', id: best.id } : null;
  }

  function groundPoint(project, view, W, H, x, y, planeY) {
    const sc = sceneFor(project, W, H, view.cam, view.center2d);
    const ray = makeRay(sc, x, y);
    if (Math.abs(ray.dir.y) < 1e-6) return null;
    const t = ((planeY == null ? 0 : planeY) - ray.origin.y) / ray.dir.y;
    if (t <= 0) return null;
    const world = add(ray.origin, mul(ray.dir, t));
    return {
      world,
      x: world.x / SCALE + sc.center2d.x,
      y: world.z / SCALE + sc.center2d.y
    };
  }

  MV.Render3D = {
    draw,
    fitCamera,
    cameraPreset,
    focusRoom,
    pick,
    groundPoint,
    mapCenter,
    getLastScene: () => lastScene,
    SCALE
  };
})(window);
