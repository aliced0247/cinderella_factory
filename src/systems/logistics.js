/**
 * 物流シミュレーション（コア生産ループ）
 *   原料が湧く → ベルトで流れる → 加工される → 納品箱に入ってお金になる
 *
 * モデル：タイルホップ方式（アイテムはタイル中心→隣のタイル中心へ等速移動）
 * Phase 3：部屋ごとに独立。各アイテム/占有は room インデックスを持ち、
 *          全部屋を毎フレーム同時にシミュレートする（離れた部屋も動き続ける）。
 *          ベルト近傍探索は部屋内で閉じるので、扉をまたいだ搬送は起きない。
 *
 * 描画とは完全分離。GameScene は CF.events と items 配列だけを見る。
 *   emit: 'item:add' / 'item:remove' / 'sell' {x,y,price,type} / 'money' / 'machine:out'
 */
window.CF = window.CF || {};

CF.Logistics = {
  items: [],
  occupied: {},   // "room:x,y" -> true（ベルトマスの占有・予約）
  _nextId: 1,

  reset() {
    this.items = [];
    this.occupied = {};
    this._nextId = 1;
  },

  key(room, x, y) {
    return room + ':' + x + ',' + y;
  },

  isFreeBelt(room, x, y) {
    const b = CF.World.at(room, x, y);
    return !!b && b.type === 'belt' && !this.occupied[this.key(room, x, y)];
  },

  /** 部屋 room のベルトマス (tx,ty) に静止状態のアイテムを生成 */
  spawnAt(type, room, tx, ty) {
    const px = CF.World.tilePx(room, tx, ty);
    const item = {
      id: this._nextId++,
      type, room,
      mode: 'rest',
      tile: { x: tx, y: ty },
      x: px.x, y: px.y,
      from: null, to: null, dest: null, destB: null,
      prog: 0
    };
    this.occupied[this.key(room, tx, ty)] = true;
    this.items.push(item);
    CF.events.emit('item:add', item);
    return item;
  },

  _removeItem(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    CF.events.emit('item:remove', item);
  },

  /** 手拾い：ベルト上のアイテムを取り除いて占有を解放（中身は呼び出し側で手持ちに） */
  pickUp(item) {
    if (item.mode === 'rest') {
      delete this.occupied[this.key(item.room, item.tile.x, item.tile.y)];
    } else if (item.dest && !item.destB) {
      delete this.occupied[this.key(item.room, item.dest.x, item.dest.y)];
    }
    this._removeItem(item);
  },

  /** 手持ちを部屋 room のベルトマス (x,y) に置く。置けたら true */
  dropOnBelt(type, room, x, y) {
    if (!this.isFreeBelt(room, x, y) || this.items.length >= CF.ITEM_CAP) return false;
    this.spawnAt(type, room, x, y);
    return true;
  },

  /** ワールドpx 近傍で拾えるアイテム（ベルト上・機械搬入中でない）を返す */
  itemAtPx(px, py, maxDist) {
    let best = null, bestD = maxDist * maxDist;
    for (const item of this.items) {
      if (item.destB) continue; // 機械に吸い込まれ中は拾えない
      const dx = item.x - px, dy = item.y - py;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD) { bestD = d2; best = item; }
    }
    return best;
  },

  /** 設備撤去時の後始末（上のアイテム・搬入中アイテムを消す） */
  onBuildingRemoved(b) {
    const inside = (room, t) =>
      room === b.room && t.x >= b.x && t.x < b.x + b.size && t.y >= b.y && t.y < b.y + b.size;

    for (const item of this.items.slice()) {
      const restOn = item.mode === 'rest' && inside(item.room, item.tile);
      const movingTo = item.mode === 'move' && item.dest && inside(item.room, item.dest);
      const movingFrom = item.mode === 'move' && inside(item.room, item.tile);
      const intoMachine = item.destB === b;
      if (restOn || movingTo || movingFrom || intoMachine) {
        if (item.mode === 'rest') delete this.occupied[this.key(item.room, item.tile.x, item.tile.y)];
        if (item.mode === 'move' && item.dest && !item.destB) {
          delete this.occupied[this.key(item.room, item.dest.x, item.dest.y)];
        }
        this._removeItem(item);
      }
    }
  },

  update(dt) {
    this._tickMachines(dt);
    this._tickItems(dt);
  },

  // ------------------------------------------------------------ 機械（全部屋）

  _tickMachines(dt) {
    for (const room of CF.World.rooms) {
      for (const b of room.buildings) {
        const kind = CF.BUILDINGS[b.type].kind;
        if (kind === 'spawner') this._tickSpawner(b, dt);
        else if (kind === 'processor') this._tickProcessor(b, dt);
        else if (kind === 'assembler') this._tickAssembler(b, dt);
      }
    }
  },

  _tickSpawner(b, dt) {
    const def = CF.BUILDINGS[b.type];
    b.timer += dt;
    if (b.timer < def.interval) return;
    b.timer = def.interval;
    if (this.items.length >= CF.ITEM_CAP) return;
    for (const c of CF.World.frontCells(b)) {
      if (this.isFreeBelt(b.room, c.x, c.y)) {
        this.spawnAt(def.out, b.room, c.x, c.y);
        b.timer = 0;
        CF.events.emit('machine:out', b);
        break;
      }
    }
  },

  _tickProcessor(b, dt) {
    if (b.processing) {
      b.processing.t += dt;
      if (b.processing.t >= b.processing.time) { b.output = b.processing.out; b.processing = null; }
    }
    this._emitOutput(b);
  },

  _tickAssembler(b, dt) {
    const recipe = CF.BUILDINGS[b.type].recipes[b.recipeIndex];
    if (!b.processing && !b.output && this._hasInputs(b, recipe)) {
      for (const k in recipe.inputs) b.buffer[k] -= recipe.inputs[k];
      b.processing = { t: 0, time: recipe.time, out: recipe.out };
    }
    if (b.processing) {
      b.processing.t += dt;
      if (b.processing.t >= b.processing.time) { b.output = b.processing.out; b.processing = null; }
    }
    this._emitOutput(b);
  },

  _hasInputs(b, recipe) {
    for (const k in recipe.inputs) {
      if ((b.buffer[k] || 0) < recipe.inputs[k]) return false;
    }
    return true;
  },

  _emitOutput(b) {
    if (!b.output || this.items.length >= CF.ITEM_CAP) return;
    for (const c of CF.World.frontCells(b)) {
      if (this.isFreeBelt(b.room, c.x, c.y)) {
        this.spawnAt(b.output, b.room, c.x, c.y);
        b.output = null;
        CF.events.emit('machine:out', b);
        break;
      }
    }
  },

  // ------------------------------------------------------------ アイテム

  _tickItems(dt) {
    const speed = CF.BUILDINGS.belt.speed;
    for (const item of this.items.slice()) {
      if (item.mode === 'move') this._stepMove(item, dt, speed);
      else this._stepRest(item);
    }
  },

  _stepMove(item, dt, speed) {
    item.prog += dt * speed;
    const t = Math.min(item.prog, 1);
    item.x = item.from.x + (item.to.x - item.from.x) * t;
    item.y = item.from.y + (item.to.y - item.from.y) * t;
    if (item.prog < 1) return;

    if (item.destB) {
      const b = item.destB;
      const kind = CF.BUILDINGS[b.type].kind;
      if (kind === 'processor') {
        const recipe = CF.BUILDINGS[b.type].recipes[b.recipeIndex];
        b.incoming = false;
        b.processing = { t: 0, time: recipe.time, out: recipe.out };
        this._removeItem(item);
      } else if (kind === 'assembler') {
        b.incomingCount[item.type] = (b.incomingCount[item.type] || 1) - 1;
        b.buffer[item.type] = (b.buffer[item.type] || 0) + 1;
        this._removeItem(item);
      } else if (kind === 'delivery') {
        // 売上に変換！ ティアラ装備で +5%
        const base = CF.ITEMS[item.type].price;
        const mul = CF.state.equip.head === 'tiara' ? CF.EQUIP_FX.tiara.sellMul : 1;
        const price = Math.round(base * mul);
        CF.state.money += price;
        CF.events.emit('money');
        CF.events.emit('sell', { x: item.x, y: item.y, price, type: item.type });
        CF.Save.request();
        this._removeItem(item);
      } else {
        this._removeItem(item);
      }
      return;
    }
    item.tile = { x: item.dest.x, y: item.dest.y };
    item.dest = null;
    item.mode = 'rest';
  },

  _stepRest(item) {
    const belt = CF.World.at(item.room, item.tile.x, item.tile.y);
    if (!belt || belt.type !== 'belt') return;

    const d = CF.DIRS[belt.dir];
    const nx = item.tile.x + d.x;
    const ny = item.tile.y + d.y;
    const target = CF.World.at(item.room, nx, ny);
    if (!target) return; // 部屋の端＝行き止まり（扉をまたがない）

    const kind = CF.BUILDINGS[target.type].kind;

    if (kind === 'belt') {
      if (!this.occupied[this.key(item.room, nx, ny)]) {
        this._startMove(item, nx, ny, null);
        this.occupied[this.key(item.room, nx, ny)] = true;
      }
      return;
    }

    const intoInput = belt.dir === target.dir &&
      CF.World.backCells(target).some((c) => c.x === nx && c.y === ny);

    if (kind === 'processor') {
      const recipe = CF.BUILDINGS[target.type].recipes[target.recipeIndex];
      const accepts = intoInput && item.type === recipe.in &&
        !target.processing && !target.output && !target.incoming;
      if (accepts) { target.incoming = true; this._startMove(item, nx, ny, target); }
      return;
    }

    if (kind === 'assembler') {
      const recipe = CF.BUILDINGS[target.type].recipes[target.recipeIndex];
      const need = recipe.inputs[item.type];
      const cap = CF.BUILDINGS[target.type].bufferCap;
      const have = (target.buffer[item.type] || 0) + (target.incomingCount[item.type] || 0);
      const accepts = intoInput && need && have < cap;
      if (accepts) {
        target.incomingCount[item.type] = (target.incomingCount[item.type] || 0) + 1;
        this._startMove(item, nx, ny, target);
      }
      return;
    }

    if (kind === 'delivery') {
      this._startMove(item, nx, ny, target);
      return;
    }
    // spawner / furniture へは流れない（待機＝詰まり）
  },

  _startMove(item, nx, ny, destB) {
    delete this.occupied[this.key(item.room, item.tile.x, item.tile.y)];
    const to = CF.World.tilePx(item.room, nx, ny);
    item.mode = 'move';
    item.prog = 0;
    item.from = { x: item.x, y: item.y };
    item.to = { x: to.x, y: to.y };
    item.dest = { x: nx, y: ny };
    item.destB = destB;
  }
};
