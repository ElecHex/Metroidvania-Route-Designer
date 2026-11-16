/* ============================================================
   ROUTE FORGE — progression / reachability analyzer
   ============================================================ */
(function (global) {
  'use strict';
  const MV = global.MV = global.MV || {};

  function canPass(link, abilities, keys) {
    const requires = Array.isArray(link.requires) ? link.requires : [];
    for (let i = 0; i < requires.length; i++) {
      if (!abilities.has(requires[i])) return false;
    }
    return keys >= (Number(link.keyReq) || 0);
  }

  function makeAdjacency(project) {
    const adj = {};
    (project.rooms || []).forEach(room => { adj[room.id] = []; });
    (project.links || []).forEach(link => {
      if (!adj[link.a] || !adj[link.b]) return;
      adj[link.a].push({ to: link.b, link, from: 'a' });
      adj[link.b].push({ to: link.a, link, from: 'b' });
    });
    return adj;
  }

  function bfs(project, adjacency, abilities, keys) {
    const rooms = new Set();
    const parent = {};
    if (!project.startRoom || !adjacency[project.startRoom]) {
      return { rooms, parent };
    }
    const queue = [project.startRoom];
    rooms.add(project.startRoom);
    parent[project.startRoom] = null;

    while (queue.length) {
      const current = queue.shift();
      const edges = adjacency[current] || [];
      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        const link = edge.link;
        if (edge.from === 'a' && link.dir === 'b2a') continue;
        if (edge.from === 'b' && link.dir === 'a2b') continue;
        if (rooms.has(edge.to)) continue;
        if (!canPass(link, abilities, keys)) continue;
        rooms.add(edge.to);
        parent[edge.to] = { room: current, link: link.id };
        queue.push(edge.to);
      }
    }
    return { rooms, parent };
  }

  function reconstructPath(parent, goal) {
    if (!parent || !(goal in parent)) return { path: [], pathLinks: [] };
    const path = [];
    const pathLinks = [];
    let cursor = goal;
    let guard = 0;
    while (cursor && guard++ < 500) {
      path.push(cursor);
      const step = parent[cursor];
      if (!step) break;
      pathLinks.push(step.link);
      cursor = step.room;
    }
    path.reverse();
    pathLinks.reverse();
    return { path, pathLinks };
  }

  function analyze(project) {
    const rooms = project.rooms || [];
    const links = project.links || [];
    const items = project.items || [];
    const adjacency = makeAdjacency(project);

    const roomMap = {};
    rooms.forEach(room => { roomMap[room.id] = room; });

    const itemsByRoom = {};
    items.forEach(item => {
      (itemsByRoom[item.room] = itemsByRoom[item.room] || []).push(item);
    });

    const keysTotal = items
      .filter(item => item.kind === 'key')
      .reduce((sum, item) => sum + (Number(item.keyCount) || 1), 0);

    const abilities = new Set(project.startAbilities || []);
    const collected = new Set();
    const roomPhase = {};
    const reachable = new Set();
    const timeline = [];
    const openLinks = {};
    const unlockSteps = {};
    let keys = 0;
    let step = 0;
    let goalReachedStep = null;
    let guard = 0;

    if (project.startRoom && roomMap[project.startRoom]) {
      roomPhase[project.startRoom] = 0;
    }

    while (guard++ < 200) {
      const result = bfs(project, adjacency, abilities, keys);
      result.rooms.forEach(roomId => {
        if (!(roomId in roomPhase)) roomPhase[roomId] = step;
        reachable.add(roomId);
      });
      if (goalReachedStep === null && project.goalRoom && result.rooms.has(project.goalRoom)) {
        goalReachedStep = step;
      }

      /* mark links that are passable in the current state */
      links.forEach(link => {
        if (openLinks[link.id] === undefined && canPass(link, abilities, keys)) {
          openLinks[link.id] = step;
        }
      });

      const newlyCollected = [];
      result.rooms.forEach(roomId => {
        (itemsByRoom[roomId] || []).forEach(item => {
          if (collected.has(item.id)) return;
          collected.add(item.id);
          let gained = '';
          if (item.grants) {
            gained = item.grants;
            abilities.add(item.grants);
          }
          if (item.kind === 'key') {
            keys += Number(item.keyCount) || 1;
          }
          timeline.push({
            step,
            itemId: item.id,
            roomId: roomId,
            name: item.name,
            kind: item.kind,
            grants: gained,
            optional: !!item.optional
          });
          newlyCollected.push(item);
        });
      });

      if (!newlyCollected.length) break;

      const opened = [];
      links.forEach(link => {
        if (openLinks[link.id] === undefined && canPass(link, abilities, keys)) {
          openLinks[link.id] = step + 1;
          opened.push(link.id);
        }
      });
      if (opened.length) unlockSteps[step] = opened;
      step++;
    }

    const finalBfs = bfs(project, adjacency, abilities, keys);
    const finalReachable = finalBfs.rooms;
    const goalReached = !!(project.goalRoom && finalReachable.has(project.goalRoom));
    const pathInfo = reconstructPath(finalBfs.parent, project.goalRoom);

    /* gate chains along the final shortest path for each room, used by the lock tree */
    const linkMap = {};
    links.forEach(link => { linkMap[link.id] = link; });
    const isGateLink = link => !!link && ((link.requires && link.requires.length > 0) || (Number(link.keyReq) || 0) > 0);
    const gateChains = {};
    rooms.forEach(room => {
      const chain = [];
      let cursor = room.id;
      let guard = 0;
      while (cursor && finalBfs.parent[cursor] && guard++ < 400) {
        const step = finalBfs.parent[cursor];
        const link = linkMap[step.link];
        if (isGateLink(link)) chain.push(link.id);
        cursor = step.room;
      }
      gateChains[room.id] = chain.reverse();
    });

    /* -------- stats -------- */
    const openCount = links.filter(link => canPass(link, abilities, keys)).length;
    const lockedLinks = links.filter(link => !canPass(link, abilities, keys));
    const gateStats = {};
    links.forEach(link => {
      const gate = MV.gateById(link.gate);
      if (!gateStats[gate.id]) {
        gateStats[gate.id] = { id: gate.id, name: gate.name, code: gate.code, total: 0, open: 0 };
      }
      gateStats[gate.id].total++;
      if (canPass(link, abilities, keys)) gateStats[gate.id].open++;
    });

    const regionStats = (project.regions || []).map(region => {
      const regionRooms = rooms.filter(room => room.region === region.id);
      const regionReachable = regionRooms.filter(room => finalReachable.has(room.id));
      const regionItems = items.filter(item => {
        const room = roomMap[item.room];
        return room && room.region === region.id;
      });
      const reachableItems = regionItems.filter(item => finalReachable.has(item.room));
      return {
        id: region.id,
        name: region.name,
        code: region.code,
        tone: region.tone,
        totalRooms: regionRooms.length,
        reachableRooms: regionReachable.length,
        totalItems: regionItems.length,
        reachableItems: reachableItems.length
      };
    });

    const unreachableRooms = rooms.filter(room => !finalReachable.has(room.id));
    const unreachableItems = items.filter(item => !finalReachable.has(item.room));

    /* -------- warnings -------- */
    const warnings = [];
    const seen = new Set();
    function addWarning(level, key, title, text) {
      if (seen.has(key)) return;
      seen.add(key);
      warnings.push({ level, title, text });
    }

    if (!roomMap[project.startRoom]) {
      addWarning('error', 'no-start', '起点缺失', '项目没有有效的起点房间，分析无法开始。');
    }
    if (!roomMap[project.goalRoom]) {
      addWarning('error', 'no-goal', '终点缺失', '项目没有有效的终点房间。');
    } else if (!goalReached) {
      addWarning('error', 'goal-locked', '终点未闭合', '从起点无法到达终点。请检查门锁链、缺失能力或单向连接。');
    }

    const grantedBy = {};
    items.forEach(item => {
      if (!item.grants) return;
      (grantedBy[item.grants] = grantedBy[item.grants] || []).push(item);
    });

    lockedLinks.forEach(link => {
      const a = roomMap[link.a];
      const b = roomMap[link.b];
      const gate = MV.gateById(link.gate);
      const label = (a ? a.name : link.a) + ' ↔ ' + (b ? b.name : link.b);
      const missing = (link.requires || []).filter(req => !abilities.has(req));

      missing.forEach(req => {
        const defined = (project.abilities || []).some(ability => ability.id === req);
        const grants = grantedBy[req] || [];
        const reachableGrants = grants.filter(item => finalReachable.has(item.room));
        if (!defined) {
          addWarning('error', 'undefined-ability-' + req,
            '未定义能力',
            gate.name + '（' + label + '）需要能力 “' + req + '”，但项目能力表中不存在它。');
        } else if (!grants.length) {
          addWarning('error', 'no-source-' + req,
            '能力没有来源',
            gate.name + '（' + label + '）需要「' + MV.abilityName(project, req) + '」，但没有任何道具授予它。');
        } else if (!reachableGrants.length) {
          addWarning('warn', 'unreachable-source-' + req,
            '潜在锁死',
            gate.name + '（' + label + '）需要「' + MV.abilityName(project, req) + '」，但授予它的道具全部位于不可达房间：' +
            grants.slice(0, 3).map(item => (roomMap[item.room] || {}).name || item.room).join('、') + '。');
        }
      });

      if (keys < (Number(link.keyReq) || 0)) {
        const deficit = (Number(link.keyReq) || 0) - keys;
        if (keysTotal < (Number(link.keyReq) || 0)) {
          addWarning('error', 'key-total-' + link.id,
            '钥匙预算不足',
            gate.name + '（' + label + '）要求 ' + link.keyReq + ' 把钥匙，但整个项目只有 ' + keysTotal + ' 把。');
        } else {
          addWarning('warn', 'key-deficit-' + link.id,
            '钥匙尚未集齐',
            gate.name + '（' + label + '）还差 ' + deficit + ' 把钥匙，当前已收集 ' + keys + ' / ' + keysTotal + '。');
        }
      }
    });

    if (unreachableRooms.length) {
      const withItems = items.filter(item => !finalReachable.has(item.room));
      addWarning(
        withItems.length ? 'warn' : 'info',
        'unreachable-rooms',
        withItems.length ? '不可达房间包含道具' : '存在不可达房间',
        unreachableRooms.length + ' 个房间不可达' +
        (withItems.length ? '，其中包含 ' + withItems.length + ' 个道具：' +
          withItems.slice(0, 4).map(item => item.name).join('、') + (withItems.length > 4 ? ' 等' : '') : '') + '。'
      );
    }

    if (!rooms.some(room => room.type === 'boss')) {
      addWarning('info', 'no-boss', '没有 Boss 房', '当前路线没有 Boss 类型房间。若这是有意设计可忽略。');
    }
    if (!rooms.some(room => room.type === 'save')) {
      addWarning('info', 'no-save', '没有存档点', '建议在长路线或 Boss 前放置存档 / 安全屋。');
    }

    const timelineGroups = {};
    timeline.forEach(entry => {
      (timelineGroups[entry.step] = timelineGroups[entry.step] || []).push(entry);
    });

    return {
      reachable: Array.from(finalReachable),
      roomPhase,
      openLinks,
      unlockSteps,
      timeline,
      timelineGroups,
      keys,
      keysTotal,
      goalReached,
      goalReachedStep,
      path: pathInfo.path,
      pathLinks: pathInfo.pathLinks,
      gateChains,
      warnings,
      unreachableRooms: unreachableRooms.map(room => room.id),
      unreachableItems: unreachableItems.map(item => item.id),
      lockedLinks: lockedLinks.map(link => link.id),
      openCount,
      totalLinks: links.length,
      openCountTotal: links.length,
      gateStats: Object.keys(gateStats).map(key => gateStats[key]).sort((x, y) => y.total - x.total),
      regionStats,
      stats: {
        rooms: rooms.length,
        reachableRooms: finalReachable.size,
        items: items.length,
        collectedItems: collected.size,
        abilities: (project.abilities || []).length,
        acquiredAbilities: abilities.size,
        keys: keys,
        keysTotal: keysTotal,
        openLinks: openCount,
        totalLinks: links.length,
        phases: step + 1
      },
      stepCount: step + 1,
      collected: Array.from(collected),
      abilities: Array.from(abilities)
    };
  }

  Object.assign(MV, { analyze, canPass });
})(window);
