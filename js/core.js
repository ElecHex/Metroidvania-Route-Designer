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
    { id: 'normal', name: '普通房间', code: 'ROOM', height: 38, depth: 38 },
    { id: 'start', name: '起点 / 着陆', code: 'START', height: 42, depth: 44 },
    { id: 'hub', name: '枢纽大厅', code: 'HUB', height: 58, depth: 52 },
    { id: 'boss', name: 'Boss 战房', code: 'BOSS', height: 68, depth: 58 },
    { id: 'save', name: '存档 / 安全屋', code: 'SAVE', height: 30, depth: 32 },
    { id: 'transit', name: '升降机 / 换乘', code: 'ELEV', height: 24, depth: 30 },
    { id: 'hazard', name: '环境危害区', code: 'HAZARD', height: 40, depth: 40 },
    { id: 'goal', name: '终点 / 决战', code: 'GOAL', height: 72, depth: 64 }
  ];

  /* Gate presets are Metroid Prime-flavoured. Any link can override its
     requirements, so the same tool also supports other metroidvanias. */
  const GATE_TYPES = [
    { id: 'open', name: '无锁通道', code: '--', requires: [], keyReq: 0, style: 'open', desc: '普通门或开放通道。' },
    { id: 'missile', name: '导弹门', code: 'MS', requires: ['missile'], keyReq: 0, style: 'door', desc: '需要导弹发射器。' },
    { id: 'ice', name: '冰冻门', code: 'IC', requires: ['iceBeam'], keyReq: 0, style: 'door', desc: '需要冰冻光束。' },
    { id: 'wave', name: '波导门', code: 'WV', requires: ['waveBeam'], keyReq: 0, style: 'door', desc: '需要波导光束。' },
    { id: 'plasma', name: '等离子门', code: 'PL', requires: ['plasmaBeam'], keyReq: 0, style: 'door', desc: '需要等离子光束。' },
    { id: 'morph', name: '变形球通道', code: 'MB', requires: ['morphBall'], keyReq: 0, style: 'morph', desc: '只有变形球能通过。' },
    { id: 'bomb', name: '炸弹槽', code: 'BM', requires: ['morphBall', 'bomb'], keyReq: 0, style: 'morph', desc: '需要变形球炸弹触发机关。' },
    { id: 'boost', name: '加速球半管', code: 'BO', requires: ['morphBall', 'boostBall'], keyReq: 0, style: 'morph', desc: '需要加速球冲上半管。' },
    { id: 'spider', name: '蜘蛛球轨道', code: 'SP', requires: ['morphBall', 'spiderBall'], keyReq: 0, style: 'morph', desc: '需要蜘蛛球磁轨。' },
    { id: 'grapple', name: '抓钩点', code: 'GR', requires: ['grappleBeam'], keyReq: 0, style: 'traversal', desc: '需要抓钩光束跨越。' },
    { id: 'powerbomb', name: '强力炸弹墙', code: 'PB', requires: ['powerBomb'], keyReq: 0, style: 'door', desc: '需要强力炸弹破坏。' },
    { id: 'scan', name: '扫描终端', code: 'SC', requires: ['scanVisor'], keyReq: 0, style: 'tech', desc: '需要扫描视镜激活。' },
    { id: 'thermal', name: '热能视镜锁', code: 'TH', requires: ['thermalVisor'], keyReq: 0, style: 'tech', desc: '需要热能视镜看见隐藏结构。' },
    { id: 'xray', name: 'X 光视镜锁', code: 'XR', requires: ['xRayVisor'], keyReq: 0, style: 'tech', desc: '需要 X 光视镜识别隐形路径。' },
    { id: 'heat', name: '高温区', code: 'HT', requires: ['variaSuit'], keyReq: 0, style: 'hazard', desc: '需要瓦利亚服抵抗高温。' },
    { id: 'water', name: '深水区', code: 'WT', requires: ['gravitySuit'], keyReq: 0, style: 'hazard', desc: '需要重力服在水中行动。' },
    { id: 'phazon', name: 'Phazon 污染', code: 'PH', requires: ['phazonSuit'], keyReq: 0, style: 'hazard', desc: '需要 Phazon 服才能通过。' },
    { id: 'artifact', name: '钥匙 / 神器封印', code: 'KY', requires: [], keyReq: 1, style: 'seal', desc: '消耗或要求若干钥匙 / 神器。' },
    { id: 'ability', name: '自定义能力锁', code: 'AB', requires: [], keyReq: 0, style: 'custom', desc: '在检查器中勾选任意能力需求。' },
    { id: 'hazard', name: '自定义环境锁', code: 'HZ', requires: [], keyReq: 0, style: 'hazard', desc: '自定义环境或状态门槛。' },
    { id: 'boss', name: 'Boss 守门', code: 'BS', requires: [], keyReq: 0, style: 'custom', desc: 'Boss 战后开放；需求可自定义。' },
    { id: 'elevator', name: '区域升降机', code: 'EL', requires: [], keyReq: 0, style: 'transit', desc: '区域间换乘，通常无门槛。' }
  ];

  const ITEM_KINDS = [
    { id: 'ability', name: '能力道具', code: 'ABILITY', short: 'AB' },
    { id: 'key', name: '钥匙 / 神器', code: 'KEY', short: 'KY' },
    { id: 'upgrade', name: '可选强化', code: 'UPGRADE', short: 'UP' },
    { id: 'boss', name: 'Boss / 事件', code: 'BOSS', short: 'BS' }
  ];

  const DOUBLE_LINK = 'both';
  const ROOM_MIN_W = 56;
  const ROOM_MIN_H = 36;

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

    project.regions = Array.isArray(project.regions) ? project.regions : [];
    project.regions = project.regions
      .filter(r => r && r.id)
      .map(r => ({
        id: String(r.id),
        name: String(r.name || '未命名区域'),
        code: String(r.code || 'ZONE').toUpperCase().slice(0, 6),
        tone: clamp(Number(r.tone) || 0, 0, REGION_TONES.length - 1),
        elev: clamp(Number(r.elev) || 0, -500, 500)
      }));
    if (!project.regions.length) {
      project.regions = [{ id: 'region_1', name: '新区域', code: 'ZONE', tone: 1, elev: 0 }];
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
    ROOM_TYPES,
    GATE_TYPES,
    ITEM_KINDS,
    ROOM_MIN_W,
    ROOM_MIN_H,
    uid,
    clone,
    clamp,
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
    History
  });
})(window);
