/* ============================================================
   ROUTE FORGE — built-in level design presets
   ============================================================ */
(function (global) {
  'use strict';
  const MV = global.MV = global.MV || {};

  function R(id, name, region, x, y, w, h, type, extra) {
    return Object.assign({ id, name, region, x, y, w, h, type: type || 'normal' }, extra || {});
  }
  function L(id, a, b, gate, extra) {
    return Object.assign({ id, a, b, gate: gate || 'open', dir: 'both' }, extra || {});
  }
  function I(id, name, kind, room, grants, extra) {
    return Object.assign({ id, name, kind: kind || 'ability', room, grants: grants || '', keyCount: 1, optional: false }, extra || {});
  }
  function A(id, name) { return { id, name }; }
  function build(spec) {
    return MV.normalizeProject({
      schema: 'routeforge/1',
      meta: Object.assign({ created: Date.now(), updated: Date.now() }, spec.meta),
      abilities: spec.abilities,
      startAbilities: spec.startAbilities || [],
      startRoom: spec.startRoom,
      goalRoom: spec.goalRoom,
      regions: spec.regions,
      rooms: spec.rooms,
      links: spec.links,
      items: spec.items
    });
  }

  /* ============================================================
     METROID PRIME 1 — TALLON IV
     Structural reconstruction from public maps / upgrade guides.
     ============================================================ */
  function metroidPrime() {
    const abilities = [
      A('scanVisor', '扫描视镜'),
      A('morphBall', '变形球'),
      A('bomb', '变形球炸弹'),
      A('missile', '导弹发射器'),
      A('chargeBeam', '蓄力光束'),
      A('boostBall', '加速球'),
      A('spiderBall', '蜘蛛球'),
      A('spaceJump', '太空跳跃'),
      A('variaSuit', '瓦利亚服'),
      A('waveBeam', '波导光束'),
      A('iceBeam', '冰冻光束'),
      A('plasmaBeam', '等离子光束'),
      A('gravitySuit', '重力服'),
      A('thermalVisor', '热能视镜'),
      A('xRayVisor', 'X 光视镜'),
      A('grappleBeam', '抓钩光束'),
      A('powerBomb', '强力炸弹'),
      A('phazonSuit', 'Phazon 服')
    ];

    const regions = [
      { id: 'orp', name: '太空海盗战舰 Orpheon', code: 'ORP', tone: 6, elev: 220 },
      { id: 'tal', name: '塔隆地表', code: 'TAL', tone: 2, elev: 0 },
      { id: 'cho', name: '鸟人族遗迹', code: 'CHO', tone: 3, elev: 90 },
      { id: 'mag', name: '岩浆洞穴', code: 'MAG', tone: 0, elev: -30 },
      { id: 'phe', name: '冰冻苔原', code: 'PHE', tone: 5, elev: 160 },
      { id: 'phz', name: 'Phazon 矿场', code: 'PHZ', tone: 4, elev: -60 },
      { id: 'imp', name: '陨石坑', code: 'IMP', tone: 7, elev: 20 }
    ];

    const rooms = [
      /* Orpheon */
      R('orp_dock', '外部停机坞', 'orp', 820, -170, 150, 60, 'start', { height: 50 }),
      R('orp_hub', '甲板阿尔法枢纽', 'orp', 820, -80, 140, 55, 'hub', { height: 58 }),
      R('orp_reactor', '反应堆核心', 'orp', 990, -80, 150, 65, 'boss', { height: 72 }),
      R('orp_escape', '逃生舱', 'orp', 990, -170, 140, 60, 'transit', { height: 32 }),

      /* Tallon Overworld */
      R('tal_landing', '着陆场', 'tal', 380, 640, 150, 85, 'start', { height: 44 }),
      R('tal_canyon_cavern', '峡谷洞窟', 'tal', 380, 745, 120, 55, 'normal'),
      R('tal_canyon', '塔隆峡谷', 'tal', 530, 735, 140, 70, 'hub', { height: 64 }),
      R('tal_alcove', '壁龛', 'tal', 700, 720, 110, 55, 'normal', { height: 34 }),
      R('tal_tree', '大树厅', 'tal', 530, 640, 150, 70, 'hub', { height: 66 }),
      R('tal_root', '根系隧道', 'tal', 700, 630, 100, 55, 'normal', { height: 30 }),
      R('tal_temple_lobby', '神殿前厅', 'tal', 250, 620, 120, 55, 'normal', { height: 36 }),
      R('tal_temple_hall', '神殿大厅', 'tal', 250, 530, 130, 60, 'normal', { height: 52 }),
      R('tal_mines_lift', '矿区升降台', 'tal', 820, 530, 120, 55, 'transit', { height: 28 }),
      R('tal_frigate', '坠毁战舰', 'tal', 640, 810, 150, 70, 'hazard', { height: 50 }),
      R('tal_grove', '生命丛林', 'tal', 600, 900, 140, 60, 'normal', { height: 42 }),
      R('tal_artifact', '神器神殿', 'tal', 380, 850, 160, 75, 'hub', { height: 58 }),
      R('tal_save', '神殿存档站', 'tal', 250, 690, 110, 45, 'save', { height: 28 }),

      /* Chozo Ruins */
      R('cho_entrance', '遗迹入口', 'cho', 700, 80, 130, 55, 'normal', { height: 36 }),
      R('cho_plaza', '中央广场', 'cho', 860, 60, 170, 90, 'hub', { height: 68 }),
      R('cho_shrine', '废弃神庙', 'cho', 870, 0, 120, 50, 'normal', { height: 38 }),
      R('cho_hive', '蜂巢图腾', 'cho', 1050, 60, 110, 60, 'boss', { height: 60 }),
      R('cho_fountain', '废弃喷泉', 'cho', 1040, 150, 130, 60, 'normal', { height: 46 }),
      R('cho_watery', '水之大厅', 'cho', 1030, 240, 140, 70, 'normal', { height: 54 }),
      R('cho_burn', '焚烧穹顶', 'cho', 1030, 340, 130, 65, 'boss', { height: 64 }),
      R('cho_sun', '太阳圣殿', 'cho', 860, 310, 150, 80, 'boss', { height: 78 }),
      R('cho_elders', '长老之厅', 'cho', 860, 180, 140, 70, 'hub', { height: 56 }),
      R('cho_energy', '能量核心', 'cho', 820, 250, 120, 55, 'normal', { height: 40 }),
      R('cho_furnace', '熔炉', 'cho', 720, 340, 100, 60, 'normal', { height: 46 }),
      R('cho_ante', '前厅', 'cho', 860, 420, 130, 60, 'normal', { height: 40 }),
      R('cho_magmoor_lift', '岩浆洞穴升降台', 'cho', 720, 160, 110, 50, 'transit', { height: 26 }),
      R('cho_tallon_lift', '塔隆升降台', 'cho', 720, 430, 110, 45, 'transit', { height: 26 }),

      /* Magmoor Caverns */
      R('mag_chozo_lift', '鸟人遗迹升降台', 'mag', 480, 160, 120, 50, 'transit', { height: 26 }),
      R('mag_lava', '岩浆湖', 'mag', 600, 160, 100, 60, 'hazard', { height: 50 }),
      R('mag_monitor', '监控站', 'mag', 600, 250, 110, 65, 'hub', { height: 48 }),
      R('mag_workstation', '岩浆工作站', 'mag', 480, 250, 110, 60, 'normal', { height: 42 }),
      R('mag_geo', '地热核心', 'mag', 480, 340, 110, 80, 'hazard', { height: 70 }),
      R('mag_twin', '双火隧道', 'mag', 600, 340, 110, 60, 'hazard', { height: 36 }),
      R('mag_shores', '炽热湖岸', 'mag', 600, 420, 110, 65, 'hazard', { height: 40 }),
      R('mag_phendrana_lift', '冰冻苔原升降台', 'mag', 480, 440, 110, 55, 'transit', { height: 26 }),
      R('mag_tallon_lift', '塔隆升降台', 'mag', 600, 500, 110, 55, 'transit', { height: 26 }),

      /* Phendrana Drifts */
      R('phe_lift', '岩浆洞穴升降台', 'phe', 60, 180, 120, 50, 'transit', { height: 26 }),
      R('phe_shore', '冰原海岸', 'phe', 200, 170, 150, 80, 'hub', { height: 62 }),
      R('phe_canyon', '冰冻峡谷', 'phe', 200, 70, 140, 60, 'normal', { height: 44 }),
      R('phe_ice_west', '冰遗迹西翼', 'phe', 60, 270, 120, 60, 'normal', { height: 38 }),
      R('phe_ice_east', '冰遗迹东翼', 'phe', 200, 270, 130, 60, 'normal', { height: 38 }),
      R('phe_chapel', '长老礼拜堂', 'phe', 60, 360, 140, 70, 'normal', { height: 64 }),
      R('phe_courtyard', '废墟庭院', 'phe', 200, 370, 140, 70, 'hub', { height: 50 }),
      R('phe_quarantine', '隔离洞穴', 'phe', 360, 350, 110, 65, 'boss', { height: 70 }),
      R('phe_research_entry', '研究设施入口', 'phe', 360, 60, 110, 55, 'normal', { height: 34 }),
      R('phe_research_core', '研究核心', 'phe', 360, 140, 110, 65, 'normal', { height: 68 }),
      R('phe_observatory', '天文台', 'phe', 360, 250, 110, 60, 'normal', { height: 56 }),
      R('phe_gravity', '重力室', 'phe', 60, 450, 140, 60, 'normal', { height: 52 }),

      /* Phazon Mines */
      R('phz_entrance', '矿区主入口', 'phz', 800, 620, 130, 60, 'normal', { height: 40 }),
      R('phz_security', '安保通道', 'phz', 950, 610, 120, 55, 'normal', { height: 34 }),
      R('phz_mine_security', '矿区安保站', 'phz', 950, 690, 130, 65, 'normal', { height: 48 }),
      R('phz_vent', '通风竖井', 'phz', 820, 710, 120, 60, 'normal', { height: 60 }),
      R('phz_dynamo', '中央发电机', 'phz', 950, 790, 140, 70, 'hub', { height: 64 }),
      R('phz_ore', '矿石处理厂', 'phz', 800, 800, 130, 70, 'normal', { height: 54 }),
      R('phz_storage', '储藏库 B', 'phz', 800, 890, 130, 55, 'normal', { height: 32 }),
      R('phz_elite_control', '精英控制室', 'phz', 1110, 690, 110, 55, 'normal', { height: 32 }),
      R('phz_elite_quarters', '精英营房', 'phz', 1100, 790, 130, 75, 'boss', { height: 80 }),
      R('phz_quarantine', '密特罗德隔离区 A', 'phz', 1100, 890, 140, 60, 'hazard', { height: 46 }),
      R('phz_processing', 'Phazon 处理中心', 'phz', 950, 890, 120, 60, 'hazard', { height: 50 }),

      /* Impact Crater */
      R('imp_entry', '陨石坑入口', 'imp', 520, 1000, 140, 60, 'normal', { height: 36 }),
      R('imp_tunnel', '陨石坑隧道', 'imp', 520, 1080, 130, 60, 'hazard', { height: 42 }),
      R('imp_core', 'Phazon 核心', 'imp', 680, 1080, 130, 60, 'hazard', { height: 58 }),
      R('imp_lair', '密特罗德 Prime 巢穴', 'imp', 680, 1000, 160, 70, 'goal', { height: 86 })
    ];

    const links = [
      /* prologue */
      L('l_orp_1', 'orp_dock', 'orp_hub'),
      L('l_orp_2', 'orp_hub', 'orp_reactor'),
      L('l_orp_3', 'orp_reactor', 'orp_escape'),
      L('l_orp_4', 'orp_escape', 'tal_landing', 'elevator', { dir: 'a2b', note: '序章逃生：单向进入塔隆地表。' }),

      /* Tallon */
      L('l_tal_1', 'tal_landing', 'tal_canyon_cavern'),
      L('l_tal_2', 'tal_canyon_cavern', 'tal_canyon'),
      L('l_tal_3', 'tal_canyon', 'tal_alcove', 'boost', { note: '利用加速球冲上半管，取得太空跳跃。' }),
      L('l_tal_4', 'tal_canyon', 'tal_tree'),
      L('l_tal_5', 'tal_tree', 'tal_root'),
      L('l_tal_6', 'tal_root', 'tal_mines_lift'),
      L('l_tal_7', 'tal_mines_lift', 'phz_entrance', 'elevator'),
      L('l_tal_8', 'tal_landing', 'tal_temple_lobby'),
      L('l_tal_9', 'tal_temple_lobby', 'tal_temple_hall'),
      L('l_tal_10', 'tal_temple_hall', 'cho_entrance', 'elevator'),
      L('l_tal_11', 'tal_canyon', 'tal_frigate'),
      L('l_tal_12', 'tal_frigate', 'tal_grove', 'water', { note: '沉没的战舰，需要重力服。' }),
      L('l_tal_13', 'tal_landing', 'tal_artifact'),
      L('l_tal_14', 'tal_artifact', 'imp_entry', 'artifact', { keyReq: 12, note: '12 枚鸟人神器开启陨石坑。' }),
      L('l_tal_15', 'tal_temple_lobby', 'tal_save'),

      /* Chozo */
      L('l_cho_1', 'cho_entrance', 'cho_plaza'),
      L('l_cho_2', 'cho_plaza', 'cho_shrine'),
      L('l_cho_3', 'cho_plaza', 'cho_hive'),
      L('l_cho_4', 'cho_plaza', 'cho_elders'),
      L('l_cho_5', 'cho_plaza', 'cho_fountain'),
      L('l_cho_6', 'cho_fountain', 'cho_watery'),
      L('l_cho_7', 'cho_watery', 'cho_burn', 'morph'),
      L('l_cho_8', 'cho_elders', 'cho_sun', 'bomb', { note: '炸弹槽开启太阳圣殿。' }),
      L('l_cho_9', 'cho_elders', 'cho_energy'),
      L('l_cho_10', 'cho_energy', 'cho_furnace'),
      L('l_cho_11', 'cho_furnace', 'cho_ante', 'spider', { note: '蜘蛛球轨道通往冰光束。' }),
      L('l_cho_12', 'cho_energy', 'cho_magmoor_lift'),
      L('l_cho_13', 'cho_entrance', 'cho_tallon_lift'),
      L('l_cho_14', 'cho_tallon_lift', 'tal_temple_hall', 'elevator'),

      /* Magmoor */
      L('l_mag_1', 'cho_magmoor_lift', 'mag_chozo_lift', 'elevator'),
      L('l_mag_2', 'mag_chozo_lift', 'mag_lava', 'heat'),
      L('l_mag_3', 'mag_lava', 'mag_monitor'),
      L('l_mag_4', 'mag_monitor', 'mag_workstation'),
      L('l_mag_5', 'mag_monitor', 'mag_twin'),
      L('l_mag_6', 'mag_twin', 'mag_geo', 'spider', { note: '地热核心的蜘蛛球谜题。' }),
      L('l_mag_7', 'mag_twin', 'mag_shores'),
      L('l_mag_8', 'mag_shores', 'mag_phendrana_lift', 'heat'),
      L('l_mag_9', 'mag_phendrana_lift', 'phe_lift', 'elevator'),
      L('l_mag_11', 'mag_tallon_lift', 'tal_tree', 'elevator'),
      L('l_mag_12', 'mag_tallon_lift', 'mag_monitor', 'heat'),

      /* Phendrana */
      L('l_phe_1', 'phe_lift', 'phe_shore'),
      L('l_phe_2', 'phe_shore', 'phe_canyon'),
      L('l_phe_3', 'phe_shore', 'phe_ice_east'),
      L('l_phe_4', 'phe_shore', 'phe_research_entry'),
      L('l_phe_5', 'phe_shore', 'phe_courtyard'),
      L('l_phe_6', 'phe_ice_east', 'phe_ice_west'),
      L('l_phe_7', 'phe_ice_west', 'phe_chapel', 'spaceJump'),
      L('l_phe_8', 'phe_courtyard', 'phe_observatory'),
      L('l_phe_9', 'phe_courtyard', 'phe_quarantine', 'thermal'),
      L('l_phe_10', 'phe_research_entry', 'phe_research_core'),
      L('l_phe_11', 'phe_research_core', 'phe_observatory'),
      L('l_phe_12', 'phe_chapel', 'phe_gravity', 'ability', {
        requires: ['iceBeam', 'spiderBall', 'morphBall'],
        note: '冰光束 + 蜘蛛球打开重力室。'
      }),

      /* Phazon Mines */
      L('l_phz_1', 'phz_entrance', 'phz_security'),
      L('l_phz_2', 'phz_entrance', 'phz_vent'),
      L('l_phz_3', 'phz_security', 'phz_mine_security'),
      L('l_phz_4', 'phz_mine_security', 'phz_vent', 'scan'),
      L('l_phz_5', 'phz_vent', 'phz_dynamo', 'boost', { note: '通风竖井需要加速球冲上半管。' }),
      L('l_phz_6', 'phz_dynamo', 'phz_ore'),
      L('l_phz_7', 'phz_ore', 'phz_storage', 'powerbomb'),
      L('l_phz_8', 'phz_mine_security', 'phz_elite_control', 'plasma'),
      L('l_phz_9', 'phz_elite_control', 'phz_elite_quarters', 'ability', {
        requires: ['plasmaBeam', 'powerBomb'],
        note: '欧米伽海盗战：等离子光束 + 强力炸弹。'
      }),
      L('l_phz_10', 'phz_elite_quarters', 'phz_quarantine', 'xray'),
      L('l_phz_11', 'phz_ore', 'phz_processing'),
      L('l_phz_12', 'phz_processing', 'phz_quarantine', 'phazon', { note: '深层隔离区被 Phazon 污染封锁。' }),

      /* Impact */
      L('l_imp_1', 'imp_entry', 'imp_tunnel'),
      L('l_imp_2', 'imp_tunnel', 'imp_core', 'phazon'),
      L('l_imp_3', 'imp_core', 'imp_lair', 'xray', { note: '最终战需要 X 光视镜追踪隐形目标。' })
    ];

    const items = [
      I('it_morph', '变形球', 'ability', 'cho_shrine', 'morphBall'),
      I('it_missile', '导弹发射器', 'ability', 'cho_hive', 'missile'),
      I('it_bomb', '变形球炸弹', 'ability', 'cho_burn', 'bomb'),
      I('it_charge', '蓄力光束', 'ability', 'cho_watery', 'chargeBeam'),
      I('it_varia', '瓦利亚服', 'ability', 'cho_sun', 'variaSuit'),
      I('it_boost', '加速球', 'ability', 'phe_canyon', 'boostBall'),
      I('it_space', '太空跳跃', 'ability', 'tal_alcove', 'spaceJump'),
      I('it_wave', '波导光束', 'ability', 'phe_chapel', 'waveBeam'),
      I('it_thermal', '热能视镜', 'ability', 'phe_research_core', 'thermalVisor'),
      I('it_spider', '蜘蛛球', 'ability', 'phe_quarantine', 'spiderBall'),
      I('it_ice', '冰冻光束', 'ability', 'cho_ante', 'iceBeam'),
      I('it_gravity', '重力服', 'ability', 'phe_gravity', 'gravitySuit'),
      I('it_plasma', '等离子光束', 'ability', 'mag_geo', 'plasmaBeam'),
      I('it_powerbomb', '强力炸弹', 'ability', 'phz_dynamo', 'powerBomb'),
      I('it_grapple', '抓钩光束', 'ability', 'phz_storage', 'grappleBeam'),
      I('it_xray', 'X 光视镜', 'ability', 'tal_grove', 'xRayVisor'),
      I('it_phazon', 'Phazon 服', 'ability', 'phz_elite_quarters', 'phazonSuit'),

      I('it_super', '超级导弹', 'upgrade', 'phe_observatory', '', { optional: true, note: '导弹组合技，可选。' }),
      I('it_flame', '火焰喷射器', 'upgrade', 'phz_mine_security', '', { optional: true, note: '导弹组合技，可选。' }),
      I('it_ice_spread', '冰冻扩散器', 'upgrade', 'mag_workstation', '', { optional: true, note: '导弹组合技，可选。' }),
      I('it_wavebuster', '波导爆裂器', 'upgrade', 'cho_elders', '', { optional: true, note: '导弹组合技，可选。' }),

      I('boss_parasite', '寄生女王', 'boss', 'orp_reactor', '', { note: '序章 Boss。' }),
      I('boss_hive', '蜂巢机甲', 'boss', 'cho_hive', '', { note: '守住导弹发射器。' }),
      I('boss_incinerator', '焚烧无人机', 'boss', 'cho_burn', '', { note: '守住变形球炸弹。' }),
      I('boss_flaahgra', '弗拉格拉', 'boss', 'cho_sun', '', { note: '守住瓦利亚服。' }),
      I('boss_thardus', '萨杜斯', 'boss', 'phe_quarantine', '', { note: '守住蜘蛛球。' }),
      I('boss_omega', '欧米伽海盗', 'boss', 'phz_elite_quarters', '', { note: '守住 Phazon 服。' }),
      I('boss_prime', '密特罗德 Prime', 'boss', 'imp_lair', '', { note: '最终决战。' }),

      I('art_truth', '真理神器', 'key', 'tal_temple_hall', ''),
      I('art_wild', '荒野神器', 'key', 'tal_tree', ''),
      I('art_chozo', '鸟人神器', 'key', 'tal_grove', ''),
      I('art_nature', '自然神器', 'key', 'cho_watery', ''),
      I('art_strength', '力量神器', 'key', 'cho_elders', ''),
      I('art_life', '生命神器', 'key', 'cho_sun', ''),
      I('art_warrior', '战士神器', 'key', 'mag_shores', ''),
      I('art_world', '世界神器', 'key', 'mag_geo', ''),
      I('art_sun', '太阳神器', 'key', 'phe_chapel', ''),
      I('art_spirit', '灵魂神器', 'key', 'phe_research_core', ''),
      I('art_elder', '长老神器', 'key', 'phe_ice_west', ''),
      I('art_newborn', '新生神器', 'key', 'phz_quarantine', '')
    ];

    return build({
      meta: {
        title: '密特罗德 Prime — 塔隆 IV',
        preset: 'mp1',
        notes: '基于公开地图与强化道具资料的“结构化复刻”，并非逐房间一比一还原。保留了 MP1 的关键教学：Magmoor 作为全图地铁、光束门矩阵、变形球空间锁、视镜锁、环境软门槛、12 神器终局钥匙，以及序章 Orpheon 的单向入口。',
        sources: [
          ['Metroid Recon — Power-up locations', 'https://www.metroid.retropixel.net/games/mprime/items1.php'],
          ['StrategyWiki — Metroid Prime Locations', 'https://strategywiki.org/wiki/Metroid_Prime/Locations'],
          ['Metroid Wiki — X-Ray Visor / Life Grove', 'https://www.metroidwiki.org/wiki/X-Ray_Visor'],
          ['Nintendo Life — Power Suit Upgrade Locations', 'https://www.nintendolife.com/guides/metroid-prime-remastered-power-suit-upgrade-locations']
        ]
      },
      abilities,
      startAbilities: ['scanVisor'],
      startRoom: 'orp_dock',
      goalRoom: 'imp_lair',
      regions,
      rooms,
      links,
      items
    });
  }

  /* ============================================================
     SUPER METROID — ZEBES (compact structural preset)
     ============================================================ */
  function superMetroid() {
    const abilities = [
      A('morphBall', '变形球'),
      A('bomb', '炸弹'),
      A('missile', '导弹'),
      A('chargeBeam', '蓄力光束'),
      A('variaSuit', '瓦利亚服'),
      A('hiJump', '高跳靴'),
      A('speedBooster', '加速器'),
      A('waveBeam', '波导光束'),
      A('iceBeam', '冰冻光束'),
      A('grappleBeam', '抓钩光束'),
      A('gravitySuit', '重力服'),
      A('spaceJump', '太空跳跃'),
      A('springBall', '弹簧球'),
      A('superMissile', '超级导弹'),
      A('plasmaBeam', '等离子光束'),
      A('bossKraid', '击败克雷德'),
      A('bossPhantoon', '击败幻影'),
      A('bossDraygon', '击败德雷贡'),
      A('bossRidley', '击败里德利')
    ];
    const regions = [
      { id: 'crt', name: '克雷特里亚', code: 'CRT', tone: 2, elev: 0 },
      { id: 'brn', name: '布林斯塔', code: 'BRN', tone: 1, elev: 40 },
      { id: 'nor', name: '诺法尔', code: 'NOR', tone: 0, elev: 120 },
      { id: 'wrk', name: '沉船', code: 'WRK', tone: 4, elev: -20 },
      { id: 'mar', name: '玛莉迪亚', code: 'MAR', tone: 5, elev: -60 },
      { id: 'tou', name: '图里安', code: 'TOU', tone: 7, elev: 180 }
    ];
    const rooms = [
      R('sm_landing', '着陆场', 'crt', 80, 620, 150, 80, 'start'),
      R('sm_save', '着陆场存档站', 'crt', 80, 560, 120, 45, 'save'),
      R('sm_crateria', '克雷特里亚洞窟', 'crt', 80, 720, 130, 60, 'normal'),
      R('sm_old_tourian', '旧图里安入口', 'crt', 240, 720, 120, 55, 'normal'),
      R('sm_wreck_entry', '沉船入口', 'wrk', 580, 500, 130, 60, 'transit'),
      R('sm_brinstar_entry', '布林斯塔入口', 'brn', 80, 500, 130, 60, 'normal'),
      R('sm_blue', '蓝色布林斯塔', 'brn', 240, 480, 170, 85, 'hub', { height: 64 }),
      R('sm_morph', '变形球房', 'brn', 240, 380, 120, 60, 'normal'),
      R('sm_bomb', '炸弹房', 'brn', 390, 380, 120, 60, 'normal'),
      R('sm_charge', '蓄力光束房', 'brn', 450, 490, 130, 60, 'normal'),
      R('sm_green', '绿色布林斯塔', 'brn', 240, 590, 150, 65, 'hub'),
      R('sm_kraid', '克雷德巢穴', 'brn', 410, 580, 150, 70, 'boss', { height: 72 }),
      R('sm_varia', '瓦利亚服房', 'brn', 240, 665, 140, 55, 'normal'),
      R('sm_norfair_entry', '诺法尔入口', 'nor', 80, 240, 130, 60, 'normal'),
      R('sm_heat', '高温走廊', 'nor', 240, 220, 140, 60, 'hazard'),
      R('sm_hijump', '高跳房', 'nor', 240, 130, 120, 60, 'normal'),
      R('sm_speed', '加速器房', 'nor', 390, 130, 120, 60, 'normal'),
      R('sm_wave', '波导光束房', 'nor', 390, 220, 120, 60, 'normal'),
      R('sm_ice', '冰光束房', 'nor', 390, 300, 120, 60, 'normal'),
      R('sm_grapple', '抓钩房', 'nor', 540, 220, 120, 60, 'normal'),
      R('sm_ridley', '里德利巢穴', 'nor', 540, 120, 150, 70, 'boss', { height: 74 }),
      R('sm_lower_norfair', '诺法尔深处', 'nor', 540, 310, 130, 55, 'hazard'),
      R('sm_wreck_hall', '沉船大厅', 'wrk', 580, 400, 150, 75, 'boss', { height: 76 }),
      R('sm_wreck_gravity', '重力服房', 'wrk', 580, 590, 140, 60, 'normal'),
      R('sm_maridia_entry', '玛莉迪亚入口', 'mar', 420, 690, 140, 60, 'transit'),
      R('sm_maridia_deep', '玛莉迪亚深处', 'mar', 600, 690, 150, 70, 'hazard', { height: 58 }),
      R('sm_draygon', '德雷贡巢穴', 'mar', 600, 790, 150, 70, 'boss', { height: 72 }),
      R('sm_space', '太空跳跃房', 'mar', 780, 690, 130, 60, 'normal'),
      R('sm_spring', '弹簧球房', 'mar', 780, 790, 130, 60, 'normal'),
      R('sm_tourian_gate', '图里安之门', 'tou', 880, 480, 140, 65, 'normal'),
      R('sm_tourian_hall', '图里安走廊', 'tou', 880, 570, 140, 60, 'normal'),
      R('sm_mother', '母脑', 'tou', 920, 660, 160, 70, 'goal', { height: 80 })
    ];
    const links = [
      L('l_sm_1', 'sm_landing', 'sm_crateria'),
      L('l_sm_2', 'sm_crateria', 'sm_brinstar_entry'),
      L('l_sm_3', 'sm_crateria', 'sm_old_tourian'),
      L('l_sm_4', 'sm_crateria', 'sm_wreck_entry'),
      L('l_sm_5', 'sm_wreck_entry', 'sm_wreck_hall'),
      L('l_sm_6', 'sm_wreck_hall', 'sm_wreck_gravity'),
      L('l_sm_7', 'sm_brinstar_entry', 'sm_blue'),
      L('l_sm_8', 'sm_blue', 'sm_morph'),
      L('l_sm_9', 'sm_blue', 'sm_bomb', 'morph'),
      L('l_sm_10', 'sm_blue', 'sm_charge'),
      L('l_sm_11', 'sm_blue', 'sm_green'),
      L('l_sm_12', 'sm_green', 'sm_kraid'),
      L('l_sm_13', 'sm_green', 'sm_varia'),
      L('l_sm_14', 'sm_blue', 'sm_norfair_entry', 'elevator'),
      L('l_sm_15', 'sm_norfair_entry', 'sm_heat', 'heat'),
      L('l_sm_16', 'sm_heat', 'sm_hijump'),
      L('l_sm_17', 'sm_heat', 'sm_speed'),
      L('l_sm_18', 'sm_heat', 'sm_wave'),
      L('l_sm_19', 'sm_heat', 'sm_ice'),
      L('l_sm_20', 'sm_speed', 'sm_grapple', 'speedBooster', { note: '加速器冲刺进入抓钩房。' }),
      L('l_sm_21', 'sm_grapple', 'sm_ridley'),
      L('l_sm_22', 'sm_ridley', 'sm_lower_norfair'),
      L('l_sm_23', 'sm_lower_norfair', 'sm_tourian_gate', 'ability', {
        requires: ['bossKraid', 'bossPhantoon', 'bossDraygon', 'bossRidley'],
        note: '四座黄金雕像全部点亮后，图里安之门开启。'
      }),
      L('l_sm_24', 'sm_tourian_gate', 'sm_tourian_hall'),
      L('l_sm_25', 'sm_tourian_hall', 'sm_mother'),
      L('l_sm_26', 'sm_wreck_gravity', 'sm_maridia_entry', 'water'),
      L('l_sm_27', 'sm_maridia_entry', 'sm_maridia_deep', 'water'),
      L('l_sm_28', 'sm_maridia_deep', 'sm_draygon'),
      L('l_sm_29', 'sm_maridia_deep', 'sm_space'),
      L('l_sm_30', 'sm_maridia_deep', 'sm_spring'),
      L('l_sm_32', 'sm_landing', 'sm_save')
    ];
    const items = [
      I('sm_it_missile', '导弹发射器', 'ability', 'sm_blue', 'missile'),
      I('sm_it_morph', '变形球', 'ability', 'sm_morph', 'morphBall'),
      I('sm_it_bomb', '炸弹', 'ability', 'sm_bomb', 'bomb'),
      I('sm_it_charge', '蓄力光束', 'ability', 'sm_charge', 'chargeBeam'),
      I('sm_it_varia', '瓦利亚服', 'ability', 'sm_varia', 'variaSuit'),
      I('sm_it_hijump', '高跳靴', 'ability', 'sm_hijump', 'hiJump'),
      I('sm_it_speed', '加速器', 'ability', 'sm_speed', 'speedBooster'),
      I('sm_it_wave', '波导光束', 'ability', 'sm_wave', 'waveBeam'),
      I('sm_it_ice', '冰冻光束', 'ability', 'sm_ice', 'iceBeam'),
      I('sm_it_grapple', '抓钩光束', 'ability', 'sm_grapple', 'grappleBeam'),
      I('sm_it_gravity', '重力服', 'ability', 'sm_wreck_gravity', 'gravitySuit'),
      I('sm_it_space', '太空跳跃', 'ability', 'sm_space', 'spaceJump'),
      I('sm_it_spring', '弹簧球', 'ability', 'sm_spring', 'springBall', { optional: true }),
      I('sm_it_super', '超级导弹', 'upgrade', 'sm_green', '', { optional: true }),
      I('sm_it_plasma', '等离子光束', 'upgrade', 'sm_tourian_hall', 'plasmaBeam', { optional: true }),
      I('sm_it_xray', 'X 光扫描镜', 'upgrade', 'sm_green', '', { optional: true }),
      I('sm_boss_kraid', '克雷德', 'boss', 'sm_kraid', 'bossKraid'),
      I('sm_boss_phantoon', '幻影', 'boss', 'sm_wreck_hall', 'bossPhantoon'),
      I('sm_boss_draygon', '德雷贡', 'boss', 'sm_draygon', 'bossDraygon'),
      I('sm_boss_ridley', '里德利', 'boss', 'sm_ridley', 'bossRidley'),
      I('sm_boss_mother', '母脑', 'boss', 'sm_mother', '', { note: '最终决战。' })
    ];
    return build({
      meta: {
        title: '超级密特罗德 — 泽贝斯',
        preset: 'supermetroid',
        notes: '紧凑结构预设：保留四 Boss 封印图里安、瓦利亚服高温门槛、重力服深水门槛、加速器冲刺与抓钩回路，用于对比“能力即钥匙”的经典结构。',
        sources: [
          ['StrategyWiki — Super Metroid', 'https://strategywiki.org/wiki/Super_Metroid'],
          ['Super Metroid Map Archive', 'https://www.snesmaps.com/maps/SuperMetroid/SuperMetroidMap.html']
        ]
      },
      abilities,
      startAbilities: [],
      startRoom: 'sm_landing',
      goalRoom: 'sm_mother',
      regions,
      rooms,
      links,
      items
    });
  }

  /* ============================================================
     HOLLOW KNIGHT — HALLOWNEST (compact structural preset)
     ============================================================ */
  function hollowKnight() {
    const abilities = [
      A('vengefulSpirit', '复仇之魂'),
      A('mothwingCloak', '蛾翼披风'),
      A('mantisClaw', '螳螂爪'),
      A('desolateDive', '荒芜俯冲'),
      A('crystalHeart', '水晶之心'),
      A('monarchWings', '帝王之翼'),
      A('shadeCloak', '暗影披风'),
      A('dreamNail', '梦之钉'),
      A('ismasTear', '伊思玛的眼泪'),
      A('cityCrest', '城市纹章'),
      A('kingsBrand', '国王印记'),
      A('simpleKey1', '简单钥匙'),
      A('dreamer1', '守梦人·卢瑞恩'),
      A('dreamer2', '守梦人·莫诺蒙'),
      A('dreamer3', '守梦人·赫拉')
    ];
    const regions = [
      { id: 'cro', name: '遗忘十字路', code: 'CRO', tone: 2, elev: 0 },
      { id: 'gre', name: '苍绿之径', code: 'GRE', tone: 5, elev: 50 },
      { id: 'fun', name: '真菌荒地', code: 'FUN', tone: 4, elev: 100 },
      { id: 'cit', name: '泪水之城', code: 'CIT', tone: 3, elev: 160 },
      { id: 'pea', name: '水晶山峰', code: 'PEA', tone: 7, elev: 240 },
      { id: 'res', name: '安息之地', code: 'RES', tone: 6, elev: 200 },
      { id: 'fog', name: '雾之峡谷', code: 'FOG', tone: 1, elev: 80 },
      { id: 'dee', name: '深巢', code: 'DEE', tone: 0, elev: -60 },
      { id: 'edg', name: '王国边缘', code: 'EDG', tone: 1, elev: -20 }
    ];
    const rooms = [
      R('hk_start', '国王山口', 'cro', 60, 700, 140, 65, 'start'),
      R('hk_crossroads', '遗忘十字路', 'cro', 220, 680, 170, 85, 'hub', { height: 58 }),
      R('hk_ancestral', '祖先山丘', 'cro', 220, 580, 140, 65, 'normal'),
      R('hk_false_knight', '假骑士竞技场', 'cro', 400, 680, 140, 65, 'boss', { height: 64 }),
      R('hk_bench', '十字路长椅', 'cro', 400, 760, 120, 45, 'save', { height: 28 }),
      R('hk_green_entry', '苍绿之径入口', 'gre', 400, 580, 130, 60, 'normal'),
      R('hk_greenpath', '苍绿之径', 'gre', 550, 560, 160, 80, 'hub', { height: 66 }),
      R('hk_hornet', '大黄蜂战场', 'gre', 550, 660, 140, 70, 'boss', { height: 66 }),
      R('hk_lake', '蓝湖', 'gre', 720, 560, 130, 60, 'normal'),
      R('hk_fungal', '真菌荒地', 'fun', 550, 450, 160, 80, 'hub', { height: 60 }),
      R('hk_mantis', '螳螂村', 'fun', 550, 350, 150, 75, 'boss', { height: 70 }),
      R('hk_city_entry', '泪水之城入口', 'cit', 720, 450, 140, 65, 'normal'),
      R('hk_city', '泪水之城', 'cit', 880, 430, 170, 85, 'hub', { height: 72 }),
      R('hk_soul', '灵魂圣所', 'cit', 880, 540, 140, 65, 'boss', { height: 62 }),
      R('hk_storerooms', '泪水之城储藏室', 'cit', 1050, 430, 130, 60, 'normal'),
      R('hk_watcher', '守望者尖塔', 'cit', 1050, 330, 130, 65, 'boss', { height: 78 }),
      R('hk_peaks', '水晶山峰', 'pea', 720, 260, 150, 75, 'normal', { height: 68 }),
      R('hk_peaks_summit', '水晶山峰之巅', 'pea', 880, 260, 140, 60, 'normal'),
      R('hk_resting', '安息之地', 'res', 1050, 540, 140, 65, 'normal'),
      R('hk_fog', '雾之峡谷', 'fog', 720, 650, 140, 60, 'normal'),
      R('hk_archives', '教师档案馆', 'fog', 880, 650, 150, 65, 'boss', { height: 60 }),
      R('hk_deepnest', '深巢', 'dee', 400, 260, 150, 75, 'hazard', { height: 58 }),
      R('hk_herrah', '野兽巢穴', 'dee', 400, 160, 150, 70, 'boss', { height: 68 }),
      R('hk_edge', '王国边缘', 'edg', 220, 260, 160, 75, 'hazard'),
      R('hk_abyss', '深渊', 'edg', 220, 160, 140, 60, 'normal'),
      R('hk_black_egg', '黑卵圣殿', 'cro', 60, 400, 160, 80, 'goal', { height: 84 })
    ];
    const links = [
      L('l_hk_1', 'hk_start', 'hk_crossroads'),
      L('l_hk_2', 'hk_crossroads', 'hk_ancestral'),
      L('l_hk_3', 'hk_crossroads', 'hk_false_knight'),
      L('l_hk_4', 'hk_false_knight', 'hk_green_entry'),
      L('l_hk_5', 'hk_green_entry', 'hk_greenpath'),
      L('l_hk_6', 'hk_greenpath', 'hk_hornet'),
      L('l_hk_7', 'hk_greenpath', 'hk_fungal'),
      L('l_hk_8', 'hk_greenpath', 'hk_fog'),
      L('l_hk_9', 'hk_greenpath', 'hk_lake'),
      L('l_hk_10', 'hk_fungal', 'hk_mantis'),
      L('l_hk_11', 'hk_fungal', 'hk_city_entry', 'ability', {
        requires: ['cityCrest'],
        note: '城市纹章打开泪水之城大门。'
      }),
      L('l_hk_12', 'hk_mantis', 'hk_deepnest', 'ability', {
        requires: ['mantisClaw'],
        note: '螳螂爪攀墙进入深巢。'
      }),
      L('l_hk_13', 'hk_city_entry', 'hk_city'),
      L('l_hk_14', 'hk_city', 'hk_soul'),
      L('l_hk_15', 'hk_city', 'hk_storerooms'),
      L('l_hk_16', 'hk_city', 'hk_peaks'),
      L('l_hk_17', 'hk_city', 'hk_resting'),
      L('l_hk_18', 'hk_storerooms', 'hk_watcher', 'ability', {
        requires: ['simpleKey1'],
        note: '简单钥匙打开守望者尖塔。'
      }),
      L('l_hk_19', 'hk_peaks', 'hk_peaks_summit', 'ability', {
        requires: ['crystalHeart'],
        note: '水晶之心冲刺越过山峰裂隙。'
      }),
      L('l_hk_20', 'hk_fog', 'hk_archives'),
      L('l_hk_21', 'hk_deepnest', 'hk_herrah'),
      L('l_hk_22', 'hk_deepnest', 'hk_edge'),
      L('l_hk_23', 'hk_edge', 'hk_abyss', 'ability', {
        requires: ['kingsBrand'],
        note: '国王印记打开深渊。'
      }),
      L('l_hk_24', 'hk_crossroads', 'hk_black_egg', 'ability', {
        requires: ['dreamer1', 'dreamer2', 'dreamer3'],
        note: '三位守梦人全部唤醒后，黑卵封印解除。'
      }),
      L('l_hk_25', 'hk_crossroads', 'hk_bench')
    ];
    const items = [
      I('hk_it_vengeful', '复仇之魂', 'ability', 'hk_ancestral', 'vengefulSpirit'),
      I('hk_it_cloak', '蛾翼披风', 'ability', 'hk_hornet', 'mothwingCloak'),
      I('hk_it_claw', '螳螂爪', 'ability', 'hk_mantis', 'mantisClaw'),
      I('hk_it_dive', '荒芜俯冲', 'ability', 'hk_soul', 'desolateDive'),
      I('hk_it_heart', '水晶之心', 'ability', 'hk_peaks', 'crystalHeart'),
      I('hk_it_dreamnail', '梦之钉', 'ability', 'hk_resting', 'dreamNail'),
      I('hk_it_citycrest', '城市纹章', 'ability', 'hk_crossroads', 'cityCrest'),
      I('hk_it_simplekey', '简单钥匙', 'ability', 'hk_storerooms', 'simpleKey1'),
      I('hk_it_kingsbrand', '国王印记', 'ability', 'hk_edge', 'kingsBrand'),
      I('hk_it_ismas', '伊思玛的眼泪', 'ability', 'hk_greenpath', 'ismasTear', { optional: true }),
      I('hk_it_shadecloak', '暗影披风', 'ability', 'hk_abyss', 'shadeCloak', { optional: true }),
      I('hk_it_wings', '帝王之翼', 'ability', 'hk_abyss', 'monarchWings', { optional: true }),
      I('hk_it_dreamer1', '守梦人·卢瑞恩', 'key', 'hk_watcher', 'dreamer1'),
      I('hk_it_dreamer2', '守梦人·莫诺蒙', 'key', 'hk_archives', 'dreamer2'),
      I('hk_it_dreamer3', '守梦人·赫拉', 'key', 'hk_herrah', 'dreamer3'),
      I('hk_it_mask', '面具碎片', 'upgrade', 'hk_lake', '', { optional: true }),
      I('hk_it_vessel', '容器碎片', 'upgrade', 'hk_peaks_summit', '', { optional: true }),
      I('hk_it_pale', '苍白的矿石', 'upgrade', 'hk_deepnest', '', { optional: true }),
      I('hk_boss_false', '假骑士', 'boss', 'hk_false_knight', ''),
      I('hk_boss_hornet', '大黄蜂', 'boss', 'hk_hornet', ''),
      I('hk_boss_mantis', '螳螂领主', 'boss', 'hk_mantis', ''),
      I('hk_boss_soul', '灵魂大师', 'boss', 'hk_soul', ''),
      I('hk_boss_archives', '乌姆', 'boss', 'hk_archives', ''),
      I('hk_boss_hollow', '空洞骑士', 'boss', 'hk_black_egg', '')
    ];
    return build({
      meta: {
        title: '空洞骑士 — 圣巢',
        preset: 'hollowknight',
        notes: '紧凑结构预设：以能力解锁（披风/爪/冲刺/眼泪）+ 唯一钥匙 + 三守梦人封印，展示非光束门体系的银河城如何复用同一套可达性分析。',
        sources: [
          ['Hollow Knight Wiki', 'https://hollowknight.wiki/'],
          ['Hollow Knight Interactive Map', 'https://maps.hollowknight.wiki/']
        ]
      },
      abilities,
      startAbilities: [],
      startRoom: 'hk_start',
      goalRoom: 'hk_black_egg',
      regions,
      rooms,
      links,
      items
    });
  }

  function blankPreset() {
    return MV.createBlankProject();
  }

  MV.PRESETS = [
    {
      id: 'mp1',
      index: '01',
      name: '密特罗德 Prime',
      subtitle: 'TALLON IV / 2002',
      desc: '七个区域、Magmoor 地铁中枢、光束门矩阵、12 神器终局。完整展示 3D 银河城路线设计。',
      tags: ['BEAM LOCKS', 'ARTIFACT HUNT', 'HUB TRANSIT'],
      build: metroidPrime
    },
    {
      id: 'supermetroid',
      index: '02',
      name: '超级密特罗德',
      subtitle: 'ZEBES / 1994',
      desc: '四 Boss 封印图里安、能力即钥匙、经典高温与深水门槛。适合对照“能力门”结构。',
      tags: ['ABILITY GATES', 'BOSS SEAL', 'CLASSIC'],
      build: superMetroid
    },
    {
      id: 'hollowknight',
      index: '03',
      name: '空洞骑士',
      subtitle: 'HALLOWNEST / 2017',
      desc: '能力解锁 + 唯一钥匙 + 三守梦人封印，验证工具对非 Metroid Prime 门锁体系的适配。',
      tags: ['UNIQUE KEYS', 'DREAMERS', 'MODERN'],
      build: hollowKnight
    },
    {
      id: 'blank',
      index: '04',
      name: '空白路线',
      subtitle: 'CUSTOM / SCRATCH',
      desc: '一间起点房、一套可编辑能力表。从零开始搭建你自己的银河城。',
      tags: ['SCRATCH', 'CUSTOM'],
      build: blankPreset
    }
  ];
})(window);
