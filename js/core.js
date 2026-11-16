/* ============================================================
   ROUTE FORGE — core data model, catalogs, storage
   ============================================================ */
(function (global) {
  'use strict';

  const SCHEMA = 'routeforge/1';
  const STORAGE_KEY = 'routeforge.project.v1';
  const UI_KEY = 'routeforge.ui.v1';

  const REGION_TONES = [
    { id: 0, color: '#5c5c63', name: 'TONE 0' },
    { id: 1, color: '#75757c', name: 'TONE 1' },
    { id: 2, color: '#8d8d94', name: 'TONE 2' },
    { id: 3, color: '#a5a5ac', name: 'TONE 3' },
    { id: 4, color: '#6a6a71', name: 'TONE 4' },
    { id: 5, color: '#b9b9bf', name: 'TONE 5' },
    { id: 6, color: '#4f4f56', name: 'TONE 6' },
    { id: 7, color: '#cfcfd4', name: 'TONE 7' }
  ];

  const ROOM_TYPES = [
    { id: 'normal', name: '普通房间', code: 'ROOM', height: 38, depth: 38, color: '#8f98a8' },
    { id: 'start', name: '起点 / 着陆', code: 'START', height: 42, depth: 44, color: '#6fcf97' },
    { id: 'hub', name: '枢纽大厅', code: 'HUB', height: 58, depth: 52, color: '#64b5f6' },
    { id: 'boss', name: 'Boss 战房', code: 'BOSS', height: 68, depth: 58, color: '#ef5350' },
    { id: 'save', name: '存档 / 安全屋', code: 'SAVE', height: 30, depth: 32, color: '#4db6ac' },
    { id: 'transit', name: '升降机 / 换乘', code: 'ELEV', height: 24, depth: 30, color: '#90a4ae' },
    { id: 'hazard', name: '环境危害区', code: 'HAZARD', height: 40, depth: 40, color: '#ffb74d' },
    { id: 'goal', name: '终点 / 决战', code: 'GOAL', height: 72, depth: 64, color: '#ffd54f' }
  ];

  const REGION_COLORS = [
    '#e05a5a', '#d5a34a', '#5fbf8a', '#d7b35a',
    '#a77bd6', '#58b4e8', '#8797b8', '#d9d9d9'
  ];
  const DEFAULT_PHASE_COLORS = ['#6ea8fe', '#8b7cf6', '#c77dff', '#f08a5d', '#f2c94c'];

  /* Gate presets are Metroid Prime-flavoured. Any link can override its
     requirements, so the same tool also supports other metroidvanias. */
  const GATE_TYPES = [
    { id: 'open', name: '无锁通道', code: '--', requires: [], keyReq: 0, style: 'open', color: '#9aa0aa', desc: '普通门或开放通道。' },
    { id: 'missile', name: '导弹门', code: 'MS', requires: ['missile'], keyReq: 0, style: 'door', color: '#e76f51', desc: '需要导弹发射器。' },
    { id: 'ice', name: '冰冻门', code: 'IC', requires: ['iceBeam'], keyReq: 0, style: 'door', color: '#6ec6ff', desc: '需要冰冻光束。' },
    { id: 'wave', name: '波导门', code: 'WV', requires: ['waveBeam'], keyReq: 0, style: 'door', color: '#b388ff', desc: '需要波导光束。' },
    { id: 'plasma', name: '等离子门', code: 'PL', requires: ['plasmaBeam'], keyReq: 0, style: 'door', color: '#ff5c8a', desc: '需要等离子光束。' },
    { id: 'morph', name: '变形球通道', code: 'MB', requires: ['morphBall'], keyReq: 0, style: 'morph', color: '#7bd88f', desc: '只有变形球能通过。' },
    { id: 'bomb', name: '炸弹槽', code: 'BM', requires: ['morphBall', 'bomb'], keyReq: 0, style: 'morph', color: '#f4a261', desc: '需要变形球炸弹触发机关。' },
    { id: 'boost', name: '加速球半管', code: 'BO', requires: ['morphBall', 'boostBall'], keyReq: 0, style: 'morph', color: '#f6c85f', desc: '需要加速球冲上半管。' },
    { id: 'spider', name: '蜘蛛球轨道', code: 'SP', requires: ['morphBall', 'spiderBall'], keyReq: 0, style: 'morph', color: '#4dd0c4', desc: '需要蜘蛛球磁轨。' },
    { id: 'grapple', name: '抓钩点', code: 'GR', requires: ['grappleBeam'], keyReq: 0, style: 'traversal', color: '#9ccc65', desc: '需要抓钩光束跨越。' },
    { id: 'powerbomb', name: '强力炸弹墙', code: 'PB', requires: ['powerBomb'], keyReq: 0, style: 'door', color: '#ff8c42', desc: '需要强力炸弹破坏。' },
    { id: 'scan', name: '扫描终端', code: 'SC', requires: ['scanVisor'], keyReq: 0, style: 'tech', color: '#64b5f6', desc: '需要扫描视镜激活。' },
    { id: 'thermal', name: '热能视镜锁', code: 'TH', requires: ['thermalVisor'], keyReq: 0, style: 'tech', color: '#ff7043', desc: '需要热能视镜看见隐藏结构。' },
    { id: 'xray', name: 'X 光视镜锁', code: 'XR', requires: ['xRayVisor'], keyReq: 0, style: 'tech', color: '#ba68c8', desc: '需要 X 光视镜识别隐形路径。' },
    { id: 'heat', name: '高温区', code: 'HT', requires: ['variaSuit'], keyReq: 0, style: 'hazard', color: '#ef5350', desc: '需要瓦利亚服抵抗高温。' },
    { id: 'water', name: '深水区', code: 'WT', requires: ['gravitySuit'], keyReq: 0, style: 'hazard', color: '#42a5f5', desc: '需要重力服在水中行动。' },
    { id: 'phazon', name: 'Phazon 污染', code: 'PH', requires: ['phazonSuit'], keyReq: 0, style: 'hazard', color: '#aeea00', desc: '需要 Phazon 服才能通过。' },
    { id: 'artifact', name: '钥匙 / 神器封印', code: 'KY', requires: [], keyReq: 1, style: 'seal', color: '#ffd54f', desc: '消耗或要求若干钥匙 / 神器。' },
    { id: 'ability', name: '自定义能力锁', code: 'AB', requires: [], keyReq: 0, style: 'custom', color: '#c7a6ff', desc: '在检查器中勾选任意能力需求。' },
    { id: 'hazard', name: '自定义环境锁', code: 'HZ', requires: [], keyReq: 0, style: 'hazard', color: '#ffb74d', desc: '自定义环境或状态门槛。' },
    { id: 'boss', name: 'Boss 守门', code: 'BS', requires: [], keyReq: 0, style: 'custom', color: '#ef5350', desc: 'Boss 战后开放；需求可自定义。' },
    { id: 'elevator', name: '区域升降机', code: 'EL', requires: [], keyReq: 0, style: 'transit', color: '#90a4ae', desc: '区域间换乘，通常无门槛。' }
  ];

  const ITEM_KINDS = [
    { id: 'ability', name: '能力道具', code: 'ABILITY', short: 'AB', color: '#64b5f6' },
    { id: 'key', name: '钥匙 / 神器', code: 'KEY', short: 'KY', color: '#ffd54f' },
    { id: 'upgrade', name: '可选强化', code: 'UPGRADE', short: 'UP', color: '#4db6ac' },
    { id: 'boss', name: 'Boss / 事件', code: 'BOSS', short: 'BS', color: '#ef5350' }
  ];

  const DOUBLE_LINK = 'both';
  const ROOM_MIN_W = 56;
  const ROOM_MIN_H = 36;

  /* Canvas palettes. CSS handles the DOM chrome; renderers read these tokens. */
  const CANVAS_THEMES = {
    dark: {
      name: 'dark',
      bg: '#0b0b0c',
      bg3d: '#09090a',
      bgGlow: 'rgba(255,255,255,0.028)',
      grid: 'rgba(255,255,255,0.032)',
      gridMajor: 'rgba(255,255,255,0.062)',
      ink: '#f1f1f3',
      inkStrong: '#ffffff',
      inkDim: '#8a8a91',
      inkFaint: '#5c5c63',
      inkGhost: '#4d4d53',
      line: '#3d3d44',
      lineDim: '#303036',
      lineHover: '#b7b7bd',
      lineSelected: '#ffffff',
      gateBg: '#0d0d0f',
      gateStroke: '#55555c',
      gateStrokeLocked: '#3b3b41',
      gateInk: '#b9b9c0',
      gateInkLocked: '#6a6a71',
      gateInkSelected: '#09090a',
      gateBgSelected: '#ededf0',
      roomFill: '#151518',
      roomHover: '#1b1b20',
      roomSelected: '#242429',
      roomUnreachable: 'rgba(255,255,255,0.008)',
      roomBorder: 'rgba(255,255,255,0.26)',
      roomBorderUnreachable: '#39393f',
      roomInk: '#dedee1',
      roomInkDim: '#5d5d63',
      roomKicker: 'rgba(255,255,255,0.38)',
      roomKickerDim: '#4d4d53',
      hatch: 'rgba(255,255,255,0.035)',
      labelBg: 'rgba(8,8,10,0.78)',
      labelBgSoft: 'rgba(8,8,10,0.72)',
      labelStroke: 'rgba(255,255,255,0.1)',
      labelInk: '#d3d3d7',
      labelInkDim: '#77777e',
      itemBg: 'rgba(8,8,10,0.65)',
      itemStroke: 'rgba(255,255,255,0.5)',
      itemStrokeOptional: 'rgba(255,255,255,0.25)',
      itemGlyph: '#e4e4e7',
      itemGlyphDim: '#aaaab0',
      accent: '#ffffff',
      accentInk: '#0a0a0b',
      accentGlow: 'rgba(255,255,255,0.55)',
      shadow: 'rgba(0,0,0,0.55)',
      boxTop: 'rgb(54,54,60)',
      boxX: 'rgb(36,36,42)',
      boxZ: 'rgb(29,29,34)',
      boxTopSelected: 'rgb(82,82,90)',
      boxXSelected: 'rgb(55,55,63)',
      boxZSelected: 'rgb(46,46,53)',
      boxTopHover: 'rgb(64,64,72)',
      boxXHover: 'rgb(43,43,50)',
      boxZHover: 'rgb(36,36,42)',
      boxTopUnreachable: 'rgb(24,24,28)',
      boxXUnreachable: 'rgb(17,17,21)',
      boxZUnreachable: 'rgb(14,14,17)',
      boxStroke: 'rgba(255,255,255,0.24)',
      boxStrokeHover: 'rgba(255,255,255,0.55)',
      boxStrokeUnreachable: 'rgba(255,255,255,0.09)',
      plateFill: 'rgba(255,255,255,0.014)',
      plateStroke: 'rgba(255,255,255,0.055)',
      dropLine: 'rgba(255,255,255,0.045)',
      threeLabelBg: 'rgba(8,8,10,0.78)',
      threeLabelStroke: 'rgba(255,255,255,0.12)',
      threeLabelInk: 'rgba(255,255,255,0.86)',
      threeLabelInkDim: 'rgba(255,255,255,0.38)',
      infoBg: 'rgba(10,10,12,0.86)',
      infoStroke: 'rgba(255,255,255,0.16)',
      infoInk: 'rgba(255,255,255,0.72)',
      corridor: 'rgba(255,255,255,0.18)',
      corridorStroke: 'rgba(255,255,255,0.32)',
      corridorTop: 'rgb(72,72,78)',
      corridorSide: 'rgb(48,48,54)',
      corridorEdge: 'rgba(255,255,255,0.38)'
    },
    light: {
      name: 'light',
      bg: '#eeeeeb',
      bg3d: '#f4f4f1',
      bgGlow: 'rgba(0,0,0,0.018)',
      grid: 'rgba(0,0,0,0.045)',
      gridMajor: 'rgba(0,0,0,0.085)',
      ink: '#181816',
      inkStrong: '#050504',
      inkDim: '#5d5d59',
      inkFaint: '#8b8b85',
      inkGhost: '#b2b2ab',
      line: '#77776f',
      lineDim: '#b0b0a8',
      lineHover: '#33332f',
      lineSelected: '#050504',
      gateBg: '#fbfbf8',
      gateStroke: '#7f7f78',
      gateStrokeLocked: '#bdbdb6',
      gateInk: '#3b3b37',
      gateInkLocked: '#92928b',
      gateInkSelected: '#ffffff',
      gateBgSelected: '#181816',
      roomFill: '#fbfbf8',
      roomHover: '#efefe9',
      roomSelected: '#dcdcd5',
      roomUnreachable: 'rgba(0,0,0,0.015)',
      roomBorder: 'rgba(0,0,0,0.42)',
      roomBorderUnreachable: '#c0c0b9',
      roomInk: '#20201d',
      roomInkDim: '#989891',
      roomKicker: 'rgba(0,0,0,0.45)',
      roomKickerDim: '#b0b0a9',
      hatch: 'rgba(0,0,0,0.045)',
      labelBg: 'rgba(251,251,248,0.9)',
      labelBgSoft: 'rgba(251,251,248,0.86)',
      labelStroke: 'rgba(0,0,0,0.13)',
      labelInk: '#242420',
      labelInkDim: '#85857e',
      itemBg: 'rgba(251,251,248,0.85)',
      itemStroke: 'rgba(0,0,0,0.43)',
      itemStrokeOptional: 'rgba(0,0,0,0.2)',
      itemGlyph: '#242420',
      itemGlyphDim: '#6b6b65',
      accent: '#121210',
      accentInk: '#ffffff',
      accentGlow: 'rgba(0,0,0,0.4)',
      shadow: 'rgba(0,0,0,0.18)',
      boxTop: 'rgb(208,208,201)',
      boxX: 'rgb(185,185,178)',
      boxZ: 'rgb(172,172,165)',
      boxTopSelected: 'rgb(64,64,60)',
      boxXSelected: 'rgb(48,48,45)',
      boxZSelected: 'rgb(40,40,37)',
      boxTopHover: 'rgb(188,188,181)',
      boxXHover: 'rgb(164,164,157)',
      boxZHover: 'rgb(150,150,143)',
      boxTopUnreachable: 'rgb(235,235,230)',
      boxXUnreachable: 'rgb(228,228,223)',
      boxZUnreachable: 'rgb(222,222,217)',
      boxStroke: 'rgba(0,0,0,0.42)',
      boxStrokeHover: 'rgba(0,0,0,0.7)',
      boxStrokeUnreachable: 'rgba(0,0,0,0.12)',
      plateFill: 'rgba(0,0,0,0.02)',
      plateStroke: 'rgba(0,0,0,0.14)',
      dropLine: 'rgba(0,0,0,0.08)',
      threeLabelBg: 'rgba(251,251,248,0.9)',
      threeLabelStroke: 'rgba(0,0,0,0.14)',
      threeLabelInk: 'rgba(0,0,0,0.84)',
      threeLabelInkDim: 'rgba(0,0,0,0.42)',
      infoBg: 'rgba(251,251,248,0.94)',
      infoStroke: 'rgba(0,0,0,0.16)',
      infoInk: 'rgba(0,0,0,0.7)',
      corridor: 'rgba(0,0,0,0.2)',
      corridorStroke: 'rgba(0,0,0,0.36)',
      corridorTop: 'rgb(200,200,194)',
      corridorSide: 'rgb(176,176,169)',
      corridorEdge: 'rgba(0,0,0,0.4)'
    }
  };

  let activeThemeName = 'dark';
  let uiFontScale = 1.15;

  function setFontScale(value) {
    uiFontScale = clamp(Number(value) || 1.15, 0.9, 1.6);
    return uiFontScale;
  }
  function fontScale() {
    return uiFontScale;
  }

  /* Scale every canvas font string once, globally, so renderers keep their
     existing typographic code while the UI font-size control affects Canvas. */
  function installCanvasFontScale() {
    if (typeof CanvasRenderingContext2D === 'undefined') return;
    if (CanvasRenderingContext2D.prototype.__routeForgeFontPatched) return;
    const descriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
    if (!descriptor || !descriptor.set) return;
    try {
      Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: descriptor.get,
        set: function (value) {
          const text = String(value);
          const scaled = text.replace(/(\d+(?:\.\d+)?)px/g, (match, size) => {
            return (Number(size) * uiFontScale).toFixed(2) + 'px';
          });
          descriptor.set.call(this, scaled);
        }
      });
      CanvasRenderingContext2D.prototype.__routeForgeFontPatched = true;
    } catch (err) {
      console.warn('Route Forge: canvas font scaling unavailable', err);
    }
  }

  installCanvasFontScale();

  function setCanvasTheme(name) {
    activeThemeName = name === 'light' ? 'light' : 'dark';
  }
  function canvasTheme(name) {
    return CANVAS_THEMES[name || activeThemeName] || CANVAS_THEMES.dark;
  }
  function hexToRgba(hex, alpha) {
    const value = String(hex || '').replace('#', '');
    if (value.length !== 3 && value.length !== 6) return 'rgba(0,0,0,' + alpha + ')';
    const parts = value.length === 3
      ? value.split('').map(c => parseInt(c + c, 16))
      : [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
    return 'rgba(' + parts[0] + ',' + parts[1] + ',' + parts[2] + ',' + alpha + ')';
  }
  function blendHex(a, b, t) {
    const parse = hex => {
      const value = String(hex || '').replace('#', '');
      if (value.length !== 6) return null;
      return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
    };
    const ca = parse(a), cb = parse(b);
    if (!ca || !cb) return a;
    const k = Math.max(0, Math.min(1, t));
    return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }

  /* ---------------- utilities ---------------- */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeHexColor(value, fallback) {
    const text = String(value || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(text)) return text.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(text)) {
      return ('#' + text.slice(1).split('').map(c => c + c).join('')).toLowerCase();
    }
    return fallback === undefined ? '#9aa0aa' : fallback;
  }

  function parseColor(value) {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (text[0] === '#') {
      const hex = normalizeHexColor(text, null);
      if (!hex) return null;
      return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }
    const match = text.match(/^rgba?\(([^)]+)\)$/i);
    if (!match) return null;
    const parts = match[1].split(',').map(part => Number(part.trim()));
    if (parts.length < 3 || parts.some(n => !Number.isFinite(n))) return null;
    return [parts[0], parts[1], parts[2]];
  }

  function mixColor(a, b, t) {
    const ca = parseColor(a), cb = parseColor(b);
    if (!ca || !cb) return a;
    const k = clamp(Number(t) || 0, 0, 1);
    return 'rgb(' + ca.map((v, i) => Math.round(v + (cb[i] - v) * k)).join(',') + ')';
  }

  function regionColor(region, colorMode) {
    if (!region) return '#9aa0aa';
    if (colorMode === 'mono') return regionTone(region.tone).color;
    return normalizeHexColor(region.color, REGION_COLORS[(Number(region.tone) || 0) % REGION_COLORS.length]);
  }

  function phaseColor(project, phase, maxPhase) {
    const colors = (project && Array.isArray(project.phaseColors) && project.phaseColors.length >= 2)
      ? project.phaseColors
      : DEFAULT_PHASE_COLORS;
    const max = Math.max(1, Number(maxPhase) || 1);
    const t = clamp((Number(phase) || 0) / max, 0, 1);
    const scaled = t * (colors.length - 1);
    const index = Math.min(colors.length - 2, Math.floor(scaled));
    return blendHex(colors[index], colors[index + 1], scaled - index);
  }

  function gateColor(gate, colorMode) {
    if (colorMode === 'mono') return null;
    return normalizeHexColor(gate && gate.color, '#9aa0aa');
  }

  function itemColor(item, colorMode) {
    if (colorMode === 'mono') return null;
    const kind = ITEM_KINDS.find(k => k.id === (item && item.kind));
    return kind ? kind.color : '#9aa0aa';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function slugify(value) {
    return String(value || 'route')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 64) || 'route';
  }

  function formatTime(ts) {
    const d = new Date(ts || Date.now());
    const pad = n => String(n).padStart(2, '0');
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), wait);
    };
  }

  function download(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function gateById(id) {
    return GATE_TYPES.find(g => g.id === id) || GATE_TYPES[0];
  }

  function roomTypeById(id) {
    return ROOM_TYPES.find(t => t.id === id) || ROOM_TYPES[0];
  }

  function itemKindById(id) {
    return ITEM_KINDS.find(k => k.id === id) || ITEM_KINDS[0];
  }

  function regionTone(tone) {
    return REGION_TONES.find(t => t.id === Number(tone)) || REGION_TONES[0];
  }

  function abilityName(project, id) {
    const ability = (project.abilities || []).find(a => a.id === id);
    return ability ? ability.name : id;
  }

  function findRoom(project, id) {
    return (project.rooms || []).find(r => r.id === id) || null;
  }

  function findLink(project, id) {
    return (project.links || []).find(l => l.id === id) || null;
  }

  function findItem(project, id) {
    return (project.items || []).find(i => i.id === id) || null;
  }

  function projectCounts(project) {
    const rooms = project.rooms || [];
    const links = project.links || [];
    const items = project.items || [];
    return {
      regions: (project.regions || []).length,
      rooms: rooms.length,
      links: links.length,
      items: items.length,
      abilities: (project.abilities || []).length,
      keys: items.filter(i => i.kind === 'key').reduce((sum, i) => sum + (Number(i.keyCount) || 1), 0),
      bosses: items.filter(i => i.kind === 'boss').length,
      optional: items.filter(i => i.optional).length
    };
  }

  /* ---------------- default project ---------------- */
  function baseAbilities() {
    return [
      { id: 'scanVisor', name: '扫描视镜' },
      { id: 'morphBall', name: '变形球' },
      { id: 'bomb', name: '变形球炸弹' },
      { id: 'missile', name: '导弹发射器' },
      { id: 'chargeBeam', name: '蓄力光束' },
      { id: 'boostBall', name: '加速球' },
      { id: 'spiderBall', name: '蜘蛛球' },
      { id: 'spaceJump', name: '太空跳跃' },
      { id: 'variaSuit', name: '瓦利亚服' },
      { id: 'waveBeam', name: '波导光束' },
      { id: 'iceBeam', name: '冰冻光束' },
      { id: 'plasmaBeam', name: '等离子光束' },
      { id: 'gravitySuit', name: '重力服' },
      { id: 'thermalVisor', name: '热能视镜' },
      { id: 'xRayVisor', name: 'X 光视镜' },
      { id: 'grappleBeam', name: '抓钩光束' },
      { id: 'powerBomb', name: '强力炸弹' },
      { id: 'phazonSuit', name: 'Phazon 服' }
    ];
  }

  function createBlankProject() {
    const regionId = 'region_blank';
    const roomId = 'room_start';
    return normalizeProject({
      schema: SCHEMA,
      meta: {
        title: '空白路线',
        preset: 'blank',
        notes: '从一间房开始，逐步加入区域、门锁、能力与 Boss。',
        created: Date.now(),
        updated: Date.now()
      },
      abilities: baseAbilities(),
      startAbilities: [],
      startRoom: roomId,
      goalRoom: roomId,
      regions: [{ id: regionId, name: '新区域', code: 'ZONE', tone: 1, elev: 0 }],
      rooms: [{
        id: roomId, name: '起点房间', region: regionId,
        x: 0, y: 0, w: 180, h: 100, type: 'start',
        height: 44, elev: 0, depth: 46, note: ''
      }],
      links: [],
      items: []
    });
  }

  /* ---------------- normalization ---------------- */
  function normalizeProject(input) {
    if (!input || typeof input !== 'object') throw new Error('无效的项目数据');
    const project = clone(input);
    project.schema = SCHEMA;
    project.meta = project.meta && typeof project.meta === 'object' ? project.meta : {};
    project.meta.title = project.meta.title || '未命名路线';
    project.meta.preset = project.meta.preset || 'custom';
    project.meta.notes = project.meta.notes || '';
    project.meta.updated = project.meta.updated || Date.now();

    project.abilities = Array.isArray(project.abilities) ? project.abilities : baseAbilities();
    project.abilities = project.abilities
      .filter(a => a && a.id)
      .map(a => ({ id: String(a.id), name: String(a.name || a.id) }));
    project.startAbilities = Array.isArray(project.startAbilities)
      ? project.startAbilities.filter(id => project.abilities.some(a => a.id === id))
      : [];

    const incomingPhaseColors = Array.isArray(input.phaseColors) ? input.phaseColors : [];
    project.phaseColors = incomingPhaseColors
      .map(color => normalizeHexColor(color, null))
      .filter(Boolean);
    if (project.phaseColors.length < 2) project.phaseColors = DEFAULT_PHASE_COLORS.slice();

    project.regions = Array.isArray(project.regions) ? project.regions : [];
    project.regions = project.regions
      .filter(r => r && r.id)
      .map(r => {
        const tone = clamp(Number(r.tone) || 0, 0, REGION_TONES.length - 1);
        return {
          id: String(r.id),
          name: String(r.name || '未命名区域'),
          code: String(r.code || 'ZONE').toUpperCase().slice(0, 6),
          tone: tone,
          elev: clamp(Number(r.elev) || 0, -500, 500),
          color: normalizeHexColor(r.color, REGION_COLORS[tone % REGION_COLORS.length])
        };
      });
    if (!project.regions.length) {
      project.regions = [{
        id: 'region_1', name: '新区域', code: 'ZONE', tone: 1, elev: 0,
        color: REGION_COLORS[1]
      }];
    }

    const regionIds = new Set(project.regions.map(r => r.id));
    project.rooms = Array.isArray(project.rooms) ? project.rooms : [];
    project.rooms = project.rooms
      .filter(r => r && r.id)
      .map(r => {
        const type = roomTypeById(r.type);
        return {
          id: String(r.id),
          name: String(r.name || '未命名房间'),
          region: regionIds.has(String(r.region)) ? String(r.region) : project.regions[0].id,
          x: Number.isFinite(Number(r.x)) ? Number(r.x) : 0,
          y: Number.isFinite(Number(r.y)) ? Number(r.y) : 0,
          w: Math.max(ROOM_MIN_W, Number(r.w) || 160),
          h: Math.max(ROOM_MIN_H, Number(r.h) || 90),
          type: type.id,
          height: Math.max(8, Number(r.height) || type.height || 40),
          elev: clamp(Number(r.elev) || 0, -500, 500),
          depth: Math.max(10, Number(r.depth) || type.depth || 40),
          note: String(r.note || '')
        };
      });
    if (!project.rooms.length) {
      project.rooms = [{
        id: 'room_1', name: '起点房间', region: project.regions[0].id,
        x: 0, y: 0, w: 180, h: 100, type: 'start', height: 44, elev: 0, depth: 46, note: ''
      }];
    }

    const roomIds = new Set(project.rooms.map(r => r.id));
    project.startRoom = roomIds.has(String(project.startRoom)) ? String(project.startRoom) : project.rooms[0].id;
    project.goalRoom = roomIds.has(String(project.goalRoom)) ? String(project.goalRoom) : project.rooms[project.rooms.length - 1].id;

    project.links = Array.isArray(project.links) ? project.links : [];
    project.links = project.links
      .filter(l => l && l.a && l.b && l.a !== l.b && roomIds.has(String(l.a)) && roomIds.has(String(l.b)))
      .map(l => {
        const gate = gateById(l.gate);
        const requires = Array.isArray(l.requires) ? l.requires.filter(Boolean).map(String) : gate.requires.slice();
        return {
          id: String(l.id || uid('link')),
          a: String(l.a),
          b: String(l.b),
          gate: gate.id,
          requires: requires,
          keyReq: Math.max(0, Number(l.keyReq != null ? l.keyReq : gate.keyReq) || 0),
          dir: ['both', 'a2b', 'b2a'].includes(l.dir) ? l.dir : DOUBLE_LINK,
          note: String(l.note || '')
        };
      });

    project.items = Array.isArray(project.items) ? project.items : [];
    project.items = project.items
      .filter(i => i && i.id && roomIds.has(String(i.room)))
      .map(i => {
        const kind = itemKindById(i.kind);
        return {
          id: String(i.id),
          name: String(i.name || '未命名物品'),
          kind: kind.id,
          room: String(i.room),
          grants: i.grants && project.abilities.some(a => a.id === i.grants) ? String(i.grants) : '',
          keyCount: Math.max(1, Number(i.keyCount) || 1),
          optional: !!i.optional,
          note: String(i.note || '')
        };
      });

    return project;
  }

  /* ---------------- localStorage ---------------- */
  function loadProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalizeProject(JSON.parse(raw));
    } catch (err) {
      console.warn('Route Forge: failed to load project', err);
      return null;
    }
  }

  function saveProject(project) {
    try {
      project.meta.updated = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      return Date.now();
    } catch (err) {
      console.warn('Route Forge: failed to save project', err);
      return 0;
    }
  }

  function loadUI() {
    try {
      const raw = localStorage.getItem(UI_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function saveUI(ui) {
    try {
      localStorage.setItem(UI_KEY, JSON.stringify(ui));
    } catch (err) { /* ignore quota errors */ }
  }

  /* ---------------- undo / redo ---------------- */
  class History {
    constructor(limit) {
      this.limit = limit || 80;
      this.undoStack = [];
      this.redoStack = [];
    }
    push(project) {
      const snapshot = JSON.stringify(project);
      if (this.undoStack.length && this.undoStack[this.undoStack.length - 1] === snapshot) return;
      this.undoStack.push(snapshot);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
      this.redoStack.length = 0;
    }
    undo(current) {
      if (!this.undoStack.length) return null;
      this.redoStack.push(JSON.stringify(current));
      return JSON.parse(this.undoStack.pop());
    }
    redo(current) {
      if (!this.redoStack.length) return null;
      this.undoStack.push(JSON.stringify(current));
      return JSON.parse(this.redoStack.pop());
    }
    get canUndo() { return this.undoStack.length > 0; }
    get canRedo() { return this.redoStack.length > 0; }
    clear() { this.undoStack.length = 0; this.redoStack.length = 0; }
  }

  global.MV = global.MV || {};
  Object.assign(global.MV, {
    SCHEMA,
    STORAGE_KEY,
    UI_KEY,
    REGION_TONES,
    REGION_COLORS,
    DEFAULT_PHASE_COLORS,
    ROOM_TYPES,
    GATE_TYPES,
    ITEM_KINDS,
    CANVAS_THEMES,
    ROOM_MIN_W,
    ROOM_MIN_H,
    uid,
    clone,
    clamp,
    normalizeHexColor,
    mixColor,
    regionColor,
    phaseColor,
    gateColor,
    itemColor,
    escapeHtml,
    slugify,
    formatTime,
    debounce,
    download,
    gateById,
    roomTypeById,
    itemKindById,
    regionTone,
    abilityName,
    findRoom,
    findLink,
    findItem,
    projectCounts,
    baseAbilities,
    createBlankProject,
    normalizeProject,
    loadProject,
    saveProject,
    loadUI,
    saveUI,
    setCanvasTheme,
    canvasTheme,
    setFontScale,
    fontScale,
    hexToRgba,
    blendHex,
    History
  });
})(window);
