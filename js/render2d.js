/* ============================================================
   ROUTE FORGE — 2D route canvas renderer
   ============================================================ */
(function (global) {
  'use strict';
  const MV = global.MV = global.MV || {};

  const FONT_UI = '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei", sans-serif';
  const FONT_DISPLAY = '"Bahnschrift", "Segoe UI", "Microsoft YaHei", sans-serif';
  const FONT_MONO = '"Cascadia Mono", "Consolas", "Microsoft YaHei", monospace';

  let lastLayout = {
    width: 0, height: 0, cam: null, rooms: {}, links: {}, items: {}, handles: []
  };

  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const n = h.length === 3
      ? h.split('').map(c => parseInt(c + c, 16))
      : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return 'rgba(' + n[0] + ',' + n[1] + ',' + n[2] + ',' + alpha + ')';
  }

  function w2s(wx, wy, cam, W, H) {
    return { x: (wx - cam.x) * cam.zoom + W / 2, y: (wy - cam.y) * cam.zoom + H / 2 };
  }
  function s2w(sx, sy, cam, W, H) {
    return { x: (sx - W / 2) / cam.zoom + cam.x, y: (sy - H / 2) / cam.zoom + cam.y };
  }

  function roomRect(room) {
    return { x: room.x, y: room.y, w: room.w, h: room.h };
  }

  function getBounds(project) {
    const rooms = project.rooms || [];
    if (!rooms.length) return { minX: -200, minY: -150, maxX: 200, maxY: 150 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    rooms.forEach(room => {
      minX = Math.min(minX, room.x);
      minY = Math.min(minY, room.y);
      maxX = Math.max(maxX, room.x + room.w);
      maxY = Math.max(maxY, room.y + room.h);
    });
    return { minX, minY, maxX, maxY };
  }

  function fitCamera(project, W, H, padding) {
    const pad = padding == null ? 90 : padding;
    const b = getBounds(project);
    const bw = Math.max(100, b.maxX - b.minX);
    const bh = Math.max(100, b.maxY - b.minY);
    const zoom = MV.clamp(Math.min((W - pad * 2) / bw, (H - pad * 2) / bh), 0.14, 1.6);
    return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, zoom };
  }

  function zoomAt(view, W, H, sx, sy, factor) {
    const before = s2w(sx, sy, view.cam, W, H);
    view.cam.zoom = MV.clamp(view.cam.zoom * factor, 0.08, 4);
    const after = s2w(sx, sy, view.cam, W, H);
    view.cam.x += before.x - after.x;
    view.cam.y += before.y - after.y;
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

  function anchorPath(a, b) {
    const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
    const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const dx = cb.x - ca.x;
    const dy = cb.y - ca.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      const sx = ca.x + Math.sign(dx) * a.w / 2;
      const ex = cb.x - Math.sign(dx) * b.w / 2;
      if (Math.abs(ex - sx) < 8) return [{ x: ca.x, y: ca.y }, { x: cb.x, y: cb.y }];
      const mx = (sx + ex) / 2;
      return [{ x: sx, y: ca.y }, { x: mx, y: ca.y }, { x: mx, y: cb.y }, { x: ex, y: cb.y }];
    }
    const sy = ca.y + Math.sign(dy) * a.h / 2;
    const ey = cb.y - Math.sign(dy) * b.h / 2;
    if (Math.abs(ey - sy) < 8) return [{ x: ca.x, y: ca.y }, { x: cb.x, y: cb.y }];
    const my = (sy + ey) / 2;
    return [{ x: ca.x, y: sy }, { x: ca.x, y: my }, { x: cb.x, y: my }, { x: cb.x, y: ey }];
  }

  function polylineLength(pts) {
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return total;
  }

  function pointAlong(pts, t) {
    const total = polylineLength(pts);
    if (!total) return { x: pts[0].x, y: pts[0].y, angle: 0 };
    let target = total * t;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (target <= len || i === pts.length - 1) {
        const r = len ? target / len : 0;
        return {
          x: a.x + (b.x - a.x) * r,
          y: a.y + (b.y - a.y) * r,
          angle: Math.atan2(b.y - a.y, b.x - a.x)
        };
      }
      target -= len;
    }
    return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, angle: 0 };
  }

  function distanceToSegment(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return Math.hypot(px - a.x, py - a.y);
    let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
  }

  function drawGrid(ctx, W, H, cam, opts) {
    ctx.fillStyle = '#0b0b0c';
    ctx.fillRect(0, 0, W, H);
    const gradient = ctx.createRadialGradient(W * 0.55, H * 0.45, 20, W * 0.55, H * 0.45, Math.max(W, H) * 0.75);
    gradient.addColorStop(0, 'rgba(255,255,255,0.025)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.005)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    let step = 20;
    while (step * cam.zoom < 9) step *= 5;
    const major = step * 5;
    const left = s2w(0, 0, cam, W, H).x;
    const right = s2w(W, 0, cam, W, H).x;
    const top = s2w(0, 0, cam, W, H).y;
    const bottom = s2w(0, H, cam, W, H).y;

    ctx.lineWidth = 1;
    ctx.strokeStyle = opts && opts.export ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.028)';
    ctx.beginPath();
    for (let x = Math.floor(left / step) * step; x <= right; x += step) {
      const sx = Math.round((x - cam.x) * cam.zoom + W / 2) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
    }
    for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
      const sy = Math.round((y - cam.y) * cam.zoom + H / 2) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
    }
    ctx.stroke();

    ctx.strokeStyle = opts && opts.export ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.055)';
    ctx.beginPath();
    for (let x = Math.floor(left / major) * major; x <= right; x += major) {
      const sx = Math.round((x - cam.x) * cam.zoom + W / 2) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
    }
    for (let y = Math.floor(top / major) * major; y <= bottom; y += major) {
      const sy = Math.round((y - cam.y) * cam.zoom + H / 2) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
    }
    ctx.stroke();
  }

  function drawRegionLabels(ctx, project, view, W, H) {
    const regions = project.regions || [];
    const rooms = project.rooms || [];
    regions.forEach(region => {
      const regionRooms = rooms.filter(room => room.region === region.id);
      if (!regionRooms.length) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      regionRooms.forEach(room => {
        minX = Math.min(minX, room.x);
        minY = Math.min(minY, room.y);
        maxX = Math.max(maxX, room.x + room.w);
        maxY = Math.max(maxY, room.y + room.h);
      });
      const p = w2s(minX, minY, view.cam, W, H);
      if (p.x > W + 40 || p.y > H + 40 || w2s(maxX, maxY, view.cam, W, H).x < -40) return;
      const tone = MV.regionTone(region.tone);
      const alpha = 0.56;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = tone.color;
      ctx.fillRect(p.x - 1, p.y - 20, 2, 12);
      ctx.font = '9px ' + FONT_MONO;
      ctx.fillStyle = '#8a8a91';
      ctx.fillText(region.code, p.x + 7, p.y - 13);
      ctx.font = '10px ' + FONT_UI;
      ctx.fillStyle = '#b9b9bf';
      const label = truncate(ctx, region.name, 150);
      ctx.fillText(label, p.x + 34, p.y - 13);
      ctx.font = '8px ' + FONT_MONO;
      ctx.fillStyle = '#5f5f66';
      ctx.fillText(String(regionRooms.length).padStart(2, '0'), p.x + 37 + Math.min(150, ctx.measureText(label).width), p.y - 13);
      ctx.strokeStyle = hexToRgba(tone.color, 0.16);
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 5);
      ctx.lineTo(w2s(maxX, minY, view.cam, W, H).x, p.y - 5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });
  }

  function drawLinks(ctx, project, view, W, H, analysis, mode) {
    const rooms = {};
    project.rooms.forEach(room => { rooms[room.id] = room; });
    const layoutLinks = {};
    const pathSet = new Set((analysis && analysis.pathLinks) || []);

    project.links.forEach(link => {
      const a = rooms[link.a], b = rooms[link.b];
      if (!a || !b) return;
      const world = anchorPath(a, b);
      const pts = world.map(p => w2s(p.x, p.y, view.cam, W, H));
      if (pts.every(p => p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60)) return;
      const gate = MV.gateById(link.gate);
      const selected = view.selection && view.selection.type === 'link' && view.selection.id === link.id;
      const hover = view.hover && view.hover.type === 'link' && view.hover.id === link.id;
      const isPath = pathSet.has(link.id);
      const open = analysis && analysis.openLinks ? analysis.openLinks[link.id] !== undefined : true;

      let stroke = '#3d3d44';
      let width = 1.2;
      if (isPath) { stroke = 'rgba(255,255,255,0.72)'; width = 1.8; }
      if (open === false) stroke = '#303036';
      if (hover) { stroke = '#b7b7bd'; width = 1.8; }
      if (selected) { stroke = '#ffffff'; width = 2.2; }

      ctx.save();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      if (gate.style === 'transit') ctx.setLineDash([5, 5]);
      else if (!open) ctx.setLineDash([2, 4]);
      ctx.beginPath();
      pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
      ctx.setLineDash([]);

      if (link.dir !== 'both') {
        const arrowAt = pointAlong(pts, 0.68);
        const dirSign = link.dir === 'a2b' ? 1 : -1;
        drawArrow(ctx, arrowAt, dirSign, isPath || selected ? '#fff' : '#5b5b62');
      }

      const badgeAt = pointAlong(pts, 0.5);
      layoutLinks[link.id] = {
        pts, badge: { x: badgeAt.x, y: badgeAt.y }, gate: gate.id, open: open !== false
      };
      ctx.restore();
    });

    return layoutLinks;
  }

  function drawGateBadges(ctx, project, view, layoutLinks) {
    project.links.forEach(link => {
      const entry = layoutLinks[link.id];
      if (!entry) return;
      if (!view.layers.gates && !(view.selection && view.selection.id === link.id)) return;
      const gate = MV.gateById(link.gate);
      const selected = view.selection && view.selection.type === 'link' && view.selection.id === link.id;
      const hover = view.hover && view.hover.type === 'link' && view.hover.id === link.id;
      const bw = 22, bh = 14;
      const x = entry.badge.x - bw / 2, y = entry.badge.y - bh / 2;
      ctx.save();
      ctx.fillStyle = selected || hover ? '#ededf0' : '#0d0d0f';
      ctx.strokeStyle = selected || hover ? '#ffffff' : (entry.open ? '#55555c' : '#3b3b41');
      ctx.lineWidth = 1;
      if (gate.style === 'transit') ctx.setLineDash([2, 2]);
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
      ctx.setLineDash([]);
      ctx.font = '7.5px ' + FONT_MONO;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = selected || hover ? '#09090a' : (entry.open ? '#b9b9c0' : '#6a6a71');
      ctx.fillText(gate.code, entry.badge.x, entry.badge.y + 0.5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      entry.badgeRect = { x, y, w: bw, h: bh };
      ctx.restore();

      if (selected || hover || (view.layers.gates && view.cam.zoom >= 1.45)) {
        ctx.save();
        ctx.font = '8.5px ' + FONT_MONO;
        const label = gate.name;
        const tw = ctx.measureText(label).width;
        const lx = entry.badge.x + 15;
        const ly = entry.badge.y + 3;
        ctx.fillStyle = 'rgba(10,10,12,0.82)';
        ctx.fillRect(lx - 3, ly - 9, tw + 6, 13);
        ctx.fillStyle = selected || hover ? '#ffffff' : '#909097';
        ctx.fillText(label, lx, ly);
        ctx.restore();
      }
    });
  }

  function drawArrow(ctx, at, dir, color) {
    const size = 4.5;
    const angle = at.angle + (dir < 0 ? Math.PI : 0);
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size, -size * 0.7);
    ctx.lineTo(-size, size * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawItemGlyph(ctx, x, y, size, item) {
    const cx = x + size / 2, cy = y + size / 2;
    ctx.save();
    if (item.kind === 'key') {
      ctx.strokeStyle = '#d8d8dc';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - 1, cy + 1, 2, 3);
    } else if (item.kind === 'boss') {
      ctx.strokeStyle = '#e5e5e8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy - 3); ctx.lineTo(cx + 3, cy + 3);
      ctx.moveTo(cx + 3, cy - 3); ctx.lineTo(cx - 3, cy + 3);
      ctx.stroke();
    } else if (item.kind === 'upgrade') {
      ctx.strokeStyle = '#aaaab0';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 1.6); ctx.lineTo(cx, cy + 1.6);
      ctx.moveTo(cx - 1.6, cy); ctx.lineTo(cx + 1.6, cy);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#e4e4e7';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 3.4);
      ctx.lineTo(cx + 3.4, cy);
      ctx.lineTo(cx, cy + 3.4);
      ctx.lineTo(cx - 3.4, cy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRooms(ctx, project, view, W, H, analysis) {
    const layoutRooms = {};
    const layoutItems = {};
    const maxPhase = Math.max(1, (analysis && analysis.stepCount ? analysis.stepCount - 1 : 1));
    const roomById = {};
    project.rooms.forEach(room => { roomById[room.id] = room; });

    project.rooms.forEach(room => {
      const p = w2s(room.x, room.y, view.cam, W, H);
      const w = room.w * view.cam.zoom;
      const h = room.h * view.cam.zoom;
      if (p.x > W + 120 || p.y > H + 120 || p.x + w < -120 || p.y + h < -120) return;
      const selected = view.selection && view.selection.type === 'room' && view.selection.id === room.id;
      const hover = view.hover && view.hover.type === 'room' && view.hover.id === room.id;
      const region = project.regions.find(r => r.id === room.region);
      const regionColor = MV.regionTone(region ? region.tone : 0).color;
      const phase = analysis && analysis.roomPhase ? analysis.roomPhase[room.id] : 0;
      const reachable = analysis ? analysis.reachable.includes(room.id) : true;
      const phaseT = phase === undefined ? 0 : MV.clamp(phase / maxPhase, 0, 1);

      let fill = '#151518';
      if (view.layers.phases && analysis && phase !== undefined) {
        fill = 'rgba(255,255,255,' + (0.025 + phaseT * 0.1).toFixed(3) + ')';
      }
      if (hover) fill = '#1b1b20';
      if (selected) fill = '#242429';
      if (!reachable) fill = 'rgba(255,255,255,0.008)';

      ctx.save();
      ctx.beginPath();
      roundRect(ctx, p.x, p.y, w, h, 2);
      ctx.fillStyle = fill;
      ctx.fill();

      if (room.type === 'boss') {
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.035)';
        ctx.lineWidth = 1;
        for (let x = p.x - h; x < p.x + w + h; x += 7) {
          ctx.beginPath();
          ctx.moveTo(x, p.y);
          ctx.lineTo(x + h, p.y + h);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.strokeStyle = reachable ? hexToRgba(regionColor, selected ? 0.95 : 0.58) : '#39393f';
      ctx.lineWidth = selected ? 1.5 : 1;
      if (!reachable) ctx.setLineDash([3, 3]);
      if (room.type === 'transit') ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (room.type === 'goal' || room.id === project.goalRoom) {
        ctx.strokeStyle = 'rgba(255,255,255,0.26)';
        ctx.strokeRect(p.x + 3.5, p.y + 3.5, w - 7, h - 7);
      }

      const pad = 7;
      const type = MV.roomTypeById(room.type);
      ctx.font = '7.5px ' + FONT_MONO;
      ctx.fillStyle = selected ? '#d8d8dc' : (reachable ? 'rgba(255,255,255,0.38)' : '#4d4d53');
      ctx.fillText(type.code, p.x + pad, p.y + 11);

      if (view.layers.names && h > 20) {
        ctx.font = (w < 100 ? '10px ' : '11.5px ') + FONT_UI;
        ctx.fillStyle = reachable ? (selected ? '#ffffff' : '#dedee1') : '#5d5d63';
        const nameY = p.y + 25;
        const maxText = Math.max(20, w - pad * 2 - (w > 130 ? 12 : 0));
        ctx.fillText(truncate(ctx, room.name, maxText), p.x + pad, nameY);
      }

      if (w > 70 && h > 44) {
        ctx.font = '7px ' + FONT_MONO;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.textAlign = 'right';
        ctx.fillText(region ? region.code : '', p.x + w - pad, p.y + 11);
        ctx.textAlign = 'left';
      }

      if (room.type === 'save' && w > 44) {
        const sx = p.x + w - 16, sy = p.y + 15;
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.strokeRect(sx - 3.5, sy - 3.5, 7, 7);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }

      if (view.layers.items) {
        const roomItems = project.items.filter(item => item.room === room.id);
        if (roomItems.length) {
          const chip = 13, gap = 3;
          const maxChips = Math.max(0, Math.floor((w - pad * 2 + gap) / (chip + gap)));
          let visibleCount = Math.min(roomItems.length, maxChips);
          const overflow = roomItems.length > maxChips;
          if (overflow) visibleCount = Math.max(0, maxChips - 1);
          const startX = p.x + pad;
          const y = p.y + h - pad - chip;
          visibleCount = Math.min(visibleCount, roomItems.length);
          for (let i = 0; i < visibleCount; i++) {
            const item = roomItems[i];
            const x = startX + i * (chip + gap);
            if (x + chip > p.x + w - pad) break;
            const itemSelected = view.selection && view.selection.type === 'item' && view.selection.id === item.id;
            ctx.fillStyle = itemSelected ? 'rgba(255,255,255,0.16)' : 'rgba(8,8,10,0.65)';
            ctx.fillRect(x, y, chip, chip);
            ctx.strokeStyle = itemSelected ? '#ffffff' : (item.optional ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.5)');
            if (item.optional && !itemSelected) ctx.setLineDash([2, 2]);
            ctx.strokeRect(x + 0.5, y + 0.5, chip - 1, chip - 1);
            ctx.setLineDash([]);
            drawItemGlyph(ctx, x, y, chip, item);
            layoutItems[item.id] = { x, y, w: chip, h: chip, roomId: room.id };
          }
          if (overflow) {
            ctx.font = '7px ' + FONT_MONO;
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillText('+' + (roomItems.length - visibleCount), p.x + w - pad - 12, y + 9.5);
          }
        }
      }

      if (selected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([]);
        roundRect(ctx, p.x - 1, p.y - 1, w + 2, h + 2, 2);
        ctx.stroke();
        if (view.tool === 'select') {
          const hs = 5;
          [[p.x, p.y, 'nw'], [p.x + w, p.y, 'ne'], [p.x + w, p.y + h, 'se'], [p.x, p.y + h, 'sw']].forEach(hd => {
            ctx.fillStyle = '#0b0b0c';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.fillRect(hd[0] - hs / 2, hd[1] - hs / 2, hs, hs);
            ctx.strokeRect(hd[0] - hs / 2 + 0.5, hd[1] - hs / 2 + 0.5, hs - 1, hs - 1);
            lastLayout.handles.push({ id: hd[2], roomId: room.id, x: hd[0], y: hd[1] });
          });
          ctx.font = '7px ' + FONT_MONO;
          ctx.fillStyle = '#ffffff';
          const sizeText = Math.round(room.w) + ' × ' + Math.round(room.h);
          ctx.fillText(sizeText, p.x, p.y + h + 12);
        }
      } else if (hover) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        roundRect(ctx, p.x - 0.5, p.y - 0.5, w + 1, h + 1, 2);
        ctx.stroke();
      }

      layoutRooms[room.id] = { x: p.x, y: p.y, w, h, roomId: room.id };
      ctx.restore();
    });

    return { rooms: layoutRooms, items: layoutItems };
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawConnectPreview(ctx, project, view, W, H) {
    if (view.tool !== 'connect' || !view.connectFrom) return;
    const room = project.rooms.find(r => r.id === view.connectFrom);
    if (!room) return;
    const a = w2s(room.x + room.w / 2, room.y + room.h / 2, view.cam, W, H);
    const b = view.pointerScreen || { x: 0, y: 0 };
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(a.x, a.y, 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.font = '8px ' + FONT_MONO;
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('ORIGIN', a.x + 9, a.y + 3);
    ctx.restore();
  }

  function drawExportFrame(ctx, project, W, H) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(28.5, 28.5, W - 57, H - 57);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.strokeRect(34.5, 34.5, W - 69, H - 69);

    ctx.font = '8px ' + FONT_MONO;
    ctx.fillStyle = 'rgba(255,255,255,0.42)';
    ctx.fillText('ROUTE FORGE / 2D ROUTE SHEET', 50, 56);
    ctx.font = '20px ' + FONT_DISPLAY;
    ctx.fillStyle = '#f2f2f4';
    ctx.fillText(project.meta.title || 'UNTITLED ROUTE', 50, 82);
    ctx.font = '8px ' + FONT_MONO;
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    const counts = MV.projectCounts(project);
    ctx.fillText(
      counts.regions + ' REGIONS  /  ' + counts.rooms + ' ROOMS  /  ' + counts.links + ' LINKS  /  ' +
      counts.items + ' ITEMS  /  ' + counts.keys + ' KEYS',
      50, 98
    );

    const stamp = new Date().toISOString().slice(0, 10);
    ctx.textAlign = 'right';
    ctx.fillText('MONOCHROME / 1:1 / ' + stamp, W - 50, H - 52);
    ctx.textAlign = 'left';
    ctx.font = '7px ' + FONT_MONO;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillText('GENERATED BY ROUTE FORGE', 50, H - 52);
    ctx.restore();
  }

  function render(ctx, W, H, project, view, opts) {
    const options = opts || {};
    lastLayout = { width: W, height: H, cam: view.cam, rooms: {}, links: {}, items: {}, handles: [] };

    if (view.layers.grid) drawGrid(ctx, W, H, view.cam, options);
    else {
      ctx.fillStyle = '#0b0b0c';
      ctx.fillRect(0, 0, W, H);
    }

    if (view.layers.regions) drawRegionLabels(ctx, project, view, W, H);

    const linksLayout = drawLinks(ctx, project, view, W, H, view.analysis, 'screen');
    const roomsLayout = drawRooms(ctx, project, view, W, H, view.analysis);
    drawGateBadges(ctx, project, view, linksLayout);

    lastLayout.links = linksLayout;
    lastLayout.rooms = roomsLayout.rooms;
    lastLayout.items = roomsLayout.items;

    if (view.layers.path && view.analysis && view.analysis.path && view.analysis.path.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      view.analysis.path.forEach(roomId => {
        const rect = lastLayout.rooms[roomId];
        if (!rect) return;
        ctx.strokeRect(rect.x + 2.5, rect.y + 2.5, rect.w - 5, rect.h - 5);
      });
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (view.draftRoom) {
      const d = view.draftRoom;
      const a = w2s(d.x, d.y, view.cam, W, H);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 4]);
      ctx.fillRect(a.x, a.y, d.w * view.cam.zoom, d.h * view.cam.zoom);
      ctx.strokeRect(a.x, a.y, d.w * view.cam.zoom, d.h * view.cam.zoom);
      ctx.setLineDash([]);
      ctx.font = '8px ' + FONT_MONO;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(Math.round(d.w) + ' × ' + Math.round(d.h), a.x + 6, a.y + 12);
      ctx.restore();
    }

    drawConnectPreview(ctx, project, view, W, H);

    if (options.export) drawExportFrame(ctx, project, W, H);
  }

  function draw(canvas, project, view, options) {
    const opts = options || {};
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
    render(ctx, W, H, project, view, opts);
    return lastLayout;
  }

  function pick(project, view, W, H, x, y) {
    const layout = lastLayout;
    if (!layout || layout.width !== W || layout.height !== H) return null;

    for (let i = layout.handles.length - 1; i >= 0; i--) {
      const h = layout.handles[i];
      if (Math.abs(h.x - x) <= 6 && Math.abs(h.y - y) <= 6) {
        return { type: 'handle', id: h.id, roomId: h.roomId, x: h.x, y: h.y };
      }
    }

    if (view.layers.items) {
      const itemIds = Object.keys(layout.items);
      for (let i = itemIds.length - 1; i >= 0; i--) {
        const item = layout.items[itemIds[i]];
        if (x >= item.x - 2 && x <= item.x + item.w + 2 && y >= item.y - 2 && y <= item.y + item.h + 2) {
          return { type: 'item', id: itemIds[i], roomId: item.roomId, x: item.x + item.w / 2, y: item.y };
        }
      }
    }

    const roomIds = Object.keys(layout.rooms);
    for (let i = roomIds.length - 1; i >= 0; i--) {
      const rect = layout.rooms[roomIds[i]];
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
        return { type: 'room', id: roomIds[i], x, y };
      }
    }

    const linkIds = Object.keys(layout.links);
    for (let i = 0; i < linkIds.length; i++) {
      const entry = layout.links[linkIds[i]];
      if (entry.badgeRect) {
        const r = entry.badgeRect;
        if (x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2) {
          return { type: 'link', id: linkIds[i], x, y };
        }
      }
      for (let j = 1; j < entry.pts.length; j++) {
        if (distanceToSegment(x, y, entry.pts[j - 1], entry.pts[j]) <= 4) {
          return { type: 'link', id: linkIds[i], x, y };
        }
      }
    }
    return null;
  }

  function pickHandle(view, x, y) {
    const layout = lastLayout;
    if (!layout) return null;
    for (let i = layout.handles.length - 1; i >= 0; i--) {
      const h = layout.handles[i];
      if (Math.abs(h.x - x) <= 7 && Math.abs(h.y - y) <= 7) return h;
    }
    return null;
  }

  function exportPNG(project, view) {
    const logicalW = 1400;
    const logicalH = 900;
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = logicalW * scale;
    canvas.height = logicalH * scale;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const cam = fitCamera(project, logicalW, logicalH, 120);
    const exportView = Object.assign({}, view, {
      cam,
      selection: null,
      hover: null,
      tool: 'select',
      connectFrom: null,
      layers: Object.assign({}, view.layers, { grid: true, path: true, phases: true })
    });
    render(ctx, logicalW, logicalH, project, exportView, { export: true });
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        resolve({ blob, url: URL.createObjectURL(blob) });
      }, 'image/png');
    });
  }

  MV.Render2D = {
    draw,
    render,
    pick,
    pickHandle,
    fitCamera,
    zoomAt,
    roomRect,
    screenToWorld: s2w,
    worldToScreen: w2s,
    exportPNG,
    getLayout: () => lastLayout
  };
})(window);
