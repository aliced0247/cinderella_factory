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
      if (b.type === 'spawner') this._tickSpawner(b, dt);
      else if (b.type === 'polisher') this._tickPolisher(b, dt);
    }
  },

  _tickSpawner(b, dt) {
    const def = CF.BUILDINGS.spawner;
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

  _tickPolisher(b, dt) {
    const recipe = CF.BUILDINGS.polisher.recipe;
    // 加工中
    if (b.processing) {
      b.processing.t += dt;
      if (b.processing.t >= recipe.time) {
        b.processing = null;
        b.output = recipe.out;
      }
    }
    // 排出待ち → 出力口の先のベルトへ
    if (b.output && this.items.length < CF.ITEM_CAP) {
      for (const c of CF.World.frontCells(b)) {
        if (this.isFreeBelt(c.x, c.y)) {
          this.spawnAt(b.output, c.x, c.y);
          b.output = null;
          CF.events.emit('machine:out', b);
          break;
        }
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
      if (b.type === 'polisher') {
        // 機械に吸い込まれて加工開始
        b.incoming = false;
        b.processing = { t: 0 };
        this._removeItem(item);
      } else if (b.type === 'delivery') {
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

    if (target.type === 'belt') {
      if (!this.occupied[this.key(nx, ny)]) {
        this._startMove(item, nx, ny, null);
        this.occupied[this.key(nx, ny)] = true;
      }
      return;
    }

    if (target.type === 'polisher') {
      const recipe = CF.BUILDINGS.polisher.recipe;
      // 入力条件：搬送方向が機械の向きと一致 ＆ 入口セル ＆ 機械が空いている ＆ レシピ一致
      const isBack = CF.World.backCells(target).some((c) => c.x === nx && c.y === ny);
      const accepts = belt.dir === target.dir && isBack &&
        item.type === recipe.in &&
        !target.processing && !target.output && !target.incoming;
      if (accepts) {
        target.incoming = true;
        this._startMove(item, nx, ny, target);
      }
      return;
    }

    if (target.type === 'delivery') {
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
