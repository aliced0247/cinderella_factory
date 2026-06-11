/**
 * 物流シミュレーション（コア生産ループ）
 *   原料が湧く → ベルトで流れる → 加工される → 納品箱に入ってお金になる
 *
 * モデル：タイルホップ方式
 *   ・アイテムは「タイル中心 → 隣のタイル中心」へ一定速度で移動する
 *   ・ベルト1マスに乗れるアイテムは1個（occupied で予約管理）
 *   ・曲がりはベルトの向きが変わるだけで自然に表現される
 *
 * 描画とは完全分離。GameScene は CF.events のイベントと items 配列だけを見る。
 *   emit: 'item:add' (item) / 'item:remove' (item) / 'sell' ({x,y,price}) / 'money'
 */
window.CF = window.CF || {};

CF.Logistics = {
  items: [],
  occupied: {},   // "x,y" -> true（ベルトマスの占有・予約）
  _nextId: 1,

  reset() {
    this.items = [];
    this.occupied = {};
    this._nextId = 1;
  },

  key(x, y) {
    return x + ',' + y;
  },

  isFreeBelt(x, y) {
    const b = CF.World.at(x, y);
    return !!b && b.type === 'belt' && !this.occupied[this.key(x, y)];
  },

  /** ベルトマス (tx,ty) に静止状態のアイテムを生成する */
  spawnAt(type, tx, ty) {
    const item = {
      id: this._nextId++,
      type,
      mode: 'rest',
      tile: { x: tx, y: ty },
      x: (tx + 0.5) * CF.TILE,
      y: (ty + 0.5) * CF.TILE,
      from: null, to: null, dest: null, destB: null,
      prog: 0
    };
    this.occupied[this.key(tx, ty)] = true;
    this.items.push(item);
    CF.events.emit('item:add', item);
    return item;
  },

  _removeItem(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
    CF.events.emit('item:remove', item);
  },

  /** 設備撤去時の後始末（上のアイテム・搬入中アイテムを消す） */
  onBuildingRemoved(b) {
    const inside = (t) =>
      t.x >= b.x && t.x < b.x + b.size && t.y >= b.y && t.y < b.y + b.size;

    for (const item of this.items.slice()) {
      const restOn = item.mode === 'rest' && inside(item.tile);
      const movingTo = item.mode === 'move' && item.dest && inside(item.dest);
      const movingFrom = item.mode === 'move' && inside(item.tile);
      const intoMachine = item.destB === b;
      if (restOn || movingTo || movingFrom || intoMachine) {
        // ベルト占有を解放
        if (item.mode === 'rest') delete this.occupied[this.key(item.tile.x, item.tile.y)];
        if (item.mode === 'move' && item.dest && !item.destB) {
          delete this.occupied[this.key(item.dest.x, item.dest.y)];
        }
        this._removeItem(item);
      }
    }
  },

  update(dt) {
    this._tickMachines(dt);
    this._tickItems(dt);
  },

  // ------------------------------------------------------------ 機械

  _tickMachines(dt) {
    for (const b of CF.World.room().buildings) {
      const kind = CF.BUILDINGS[b.type].kind;
      if (kind === 'spawner') this._tickSpawner(b, dt);
      else if (kind === 'processor') this._tickProcessor(b, dt);
      else if (kind === 'assembler') this._tickAssembler(b, dt);
    }
  },

  _tickSpawner(b, dt) {
    const def = CF.BUILDINGS[b.type];
    b.timer += dt;
    if (b.timer < def.interval) return;
    b.timer = def.interval; // 排出先が空くまで待機（空いた瞬間に出す）
    if (this.items.length >= CF.ITEM_CAP) return;
    for (const c of CF.World.frontCells(b)) {
      if (this.isFreeBelt(c.x, c.y)) {
        this.spawnAt(def.out, c.x, c.y);
        b.timer = 0;
        CF.events.emit('machine:out', b);
        break;
      }
    }
  },

  /** 1入力加工機（研磨機・ミシン）。出力種は加工開始時のレシピで確定済み */
  _tickProcessor(b, dt) {
    if (b.processing) {
      b.processing.t += dt;
      if (b.processing.t >= b.processing.time) {
        b.output = b.processing.out;
        b.processing = null;
      }
    }
    this._emitOutput(b);
  },

  /** 複数入力の合成台（工房台）。バッファが揃ったら加工開始 */
  _tickAssembler(b, dt) {
    const recipe = CF.BUILDINGS[b.type].recipes[b.recipeIndex];
    // 揃っていれば加工開始（加工中・排出待ちでない時のみ）
    if (!b.processing && !b.output && this._hasInputs(b, recipe)) {
      for (const k in recipe.inputs) b.buffer[k] -= recipe.inputs[k];
      b.processing = { t: 0, time: recipe.time, out: recipe.out };
    }
    if (b.processing) {
      b.processing.t += dt;
      if (b.processing.t >= b.processing.time) {
        b.output = b.processing.out;
        b.processing = null;
      }
    }
    this._emitOutput(b);
  },

  _hasInputs(b, recipe) {
    for (const k in recipe.inputs) {
      if ((b.buffer[k] || 0) < recipe.inputs[k]) return false;
    }
    return true;
  },

  /** 完成品を出力口の先のベルトへ排出（共通） */
  _emitOutput(b) {
    if (!b.output || this.items.length >= CF.ITEM_CAP) return;
    for (const c of CF.World.frontCells(b)) {
      if (this.isFreeBelt(c.x, c.y)) {
        this.spawnAt(b.output, c.x, c.y);
        b.output = null;
        CF.events.emit('machine:out', b);
        break;
      }
    }
  },

  // ------------------------------------------------------------ アイテム

  _tickItems(dt) {
    const speed = CF.BUILDINGS.belt.speed; // マス/秒
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
        // 機械に吸い込まれて加工開始（出力種は今のレシピで確定）
        const recipe = CF.BUILDINGS[b.type].recipes[b.recipeIndex];
        b.incoming = false;
        b.processing = { t: 0, time: recipe.time, out: recipe.out };
        this._removeItem(item);
      } else if (kind === 'assembler') {
        // 内部バッファに積む（揃ったら _tickAssembler が加工開始）
        b.incomingCount[item.type] = (b.incomingCount[item.type] || 1) - 1;
        b.buffer[item.type] = (b.buffer[item.type] || 0) + 1;
        this._removeItem(item);
      } else if (kind === 'delivery') {
        // 売上に変換！
        const price = CF.ITEMS[item.type].price;
        CF.state.money += price;
        CF.events.emit('money');
        CF.events.emit('sell', { x: item.x, y: item.y, price, type: item.type });
        CF.Save.request();
        this._removeItem(item);
      } else {
        this._removeItem(item); // 撤去等のレアケース
      }
      return;
    }
    // 次のベルトマスに到着
    item.tile = { x: item.dest.x, y: item.dest.y };
    item.dest = null;
    item.mode = 'rest';
  },

  _stepRest(item) {
    const belt = CF.World.at(item.tile.x, item.tile.y);
    if (!belt || belt.type !== 'belt') return; // 足場消失（撤去直後の保険）

    const d = CF.DIRS[belt.dir];
    const nx = item.tile.x + d.x;
    const ny = item.tile.y + d.y;
    const target = CF.World.at(nx, ny);
    if (!target) return; // 行き止まり

    const kind = CF.BUILDINGS[target.type].kind;

    if (kind === 'belt') {
      if (!this.occupied[this.key(nx, ny)]) {
        this._startMove(item, nx, ny, null);
        this.occupied[this.key(nx, ny)] = true;
      }
      return;
    }

    // 機械への投入は「搬送方向＝機械の向き」かつ「入力口（back面）セル」のときだけ
    const intoInput = belt.dir === target.dir &&
      CF.World.backCells(target).some((c) => c.x === nx && c.y === ny);

    if (kind === 'processor') {
      const recipe = CF.BUILDINGS[target.type].recipes[target.recipeIndex];
      const accepts = intoInput &&
        item.type === recipe.in &&
        !target.processing && !target.output && !target.incoming;
      if (accepts) {
        target.incoming = true;
        this._startMove(item, nx, ny, target);
      }
      return; // 受け入れ不可ならベルト上で待機（詰まり＝仕様）
    }

    if (kind === 'assembler') {
      const recipe = CF.BUILDINGS[target.type].recipes[target.recipeIndex];
      const cap = CF.BUILDINGS[target.type].bufferCap;
      // レシピ外の素材は受け取らない（ベルト上で詰まる＝仕様）
      if (intoInput && recipe.inputs[item.type] != null) {
        const have = (target.buffer[item.type] || 0) + (target.incomingCount[item.type] || 0);
        if (have < cap) {
          target.incomingCount[item.type] = (target.incomingCount[item.type] || 0) + 1;
          this._startMove(item, nx, ny, target);
        }
      }
      return;
    }

    if (kind === 'delivery') {
      this._startMove(item, nx, ny, target);
      return;
    }
    // spawner その他へは流れない（待機）
  },

  _startMove(item, nx, ny, destB) {
    delete this.occupied[this.key(item.tile.x, item.tile.y)];
    item.mode = 'move';
    item.prog = 0;
    item.from = { x: item.x, y: item.y };
    item.to = { x: (nx + 0.5) * CF.TILE, y: (ny + 0.5) * CF.TILE };
    item.dest = { x: nx, y: ny };
    item.destB = destB;
  }
};
