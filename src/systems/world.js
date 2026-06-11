/**
 * ワールド（部屋・グリッド・設備配置）のデータモデル
 *
 * 将来「部屋を買い足して拡張」できるよう、rooms は配列で持つ。
 * Phase 1 では rooms[0]（工房1部屋 20×15）のみを使う。
 */
window.CF = window.CF || {};

/** ゲーム全体の状態 */
CF.state = {
  money: 0
};

CF.World = {
  rooms: [],
  activeRoom: 0,
  _nextId: 1,

  /** 初期化（セーブがあれば復元） */
  init() {
    this.rooms = [];
    this._nextId = 1;
    CF.state.money = 0;

    const data = CF.Save.load();
    if (data) {
      CF.state.money = data.money || 0;
      for (const r of data.rooms) {
        const room = this._createRoom(r.w, r.h);
        this.rooms.push(room);
        for (const b of r.buildings) {
          // セーブ復元はバリデーション込みで再配置（壊れたデータに耐える）
          this.place(b.t, b.x, b.y, b.d, this.rooms.length - 1);
        }
      }
    }
    if (this.rooms.length === 0) {
      this.rooms.push(this._createRoom(20, 15)); // 工房1部屋：20×15マス
    }
  },

  _createRoom(w, h) {
    const grid = [];
    for (let y = 0; y < h; y++) {
      grid.push(new Array(w).fill(null));
    }
    return { w, h, grid, buildings: [] };
  },

  room() {
    return this.rooms[this.activeRoom];
  },

  inBounds(x, y) {
    const r = this.room();
    return x >= 0 && y >= 0 && x < r.w && y < r.h;
  },

  /** そのマスにある設備（無ければnull） */
  at(x, y) {
    if (!this.inBounds(x, y)) return null;
    return this.room().grid[y][x];
  },

  /** 種別ごとの設置数 */
  countOf(type) {
    return this.room().buildings.filter((b) => b.type === type).length;
  },

  /** 設置できるか（範囲内・空き・上限） */
  canPlace(type, x, y) {
    const def = CF.BUILDINGS[type];
    if (!def) return false;
    if (def.limit && this.countOf(type) >= def.limit) return false;
    for (let dy = 0; dy < def.size; dy++) {
      for (let dx = 0; dx < def.size; dx++) {
        if (!this.inBounds(x + dx, y + dy)) return false;
        if (this.at(x + dx, y + dy)) return false;
      }
    }
    return true;
  },

  /**
   * 設置する。成功なら設備インスタンスを返す（失敗はnull）
   * インスタンス：{ id, type, x, y, dir, size, ...機械の動作状態 }
   */
  place(type, x, y, dir, roomIndex) {
    const ri = roomIndex == null ? this.activeRoom : roomIndex;
    const prevActive = this.activeRoom;
    this.activeRoom = ri;
    if (!this.canPlace(type, x, y)) {
      this.activeRoom = prevActive;
      return null;
    }
    const def = CF.BUILDINGS[type];
    const b = {
      id: this._nextId++,
      type, x, y,
      dir: dir == null ? 0 : (dir & 3),
      size: def.size,
      // --- 機械の動作状態（セーブ対象外） ---
      timer: 0,          // スポナー：排出タイマー
      processing: null,  // 研磨機：{ t } 加工中
      output: null,      // 研磨機：完成して排出待ちのアイテム種
      incoming: false    // 研磨機：搬入中のアイテムがいる
    };
    const room = this.rooms[ri];
    for (let dy = 0; dy < def.size; dy++) {
      for (let dx = 0; dx < def.size; dx++) {
        room.grid[y + dy][x + dx] = b;
      }
    }
    room.buildings.push(b);
    this.activeRoom = prevActive;
    return b;
  },

  /** 撤去する */
  remove(b) {
    const room = this.room();
    for (let dy = 0; dy < b.size; dy++) {
      for (let dx = 0; dx < b.size; dx++) {
        if (room.grid[b.y + dy][b.x + dx] === b) {
          room.grid[b.y + dy][b.x + dx] = null;
        }
      }
    }
    const i = room.buildings.indexOf(b);
    if (i >= 0) room.buildings.splice(i, 1);
  },

  /** 回転（時計回りに90°） */
  rotate(b) {
    b.dir = (b.dir + 1) & 3;
  },

  /** 設備が占めるマスの中心（ワールドpx） */
  centerPx(b) {
    return {
      x: (b.x + b.size / 2) * CF.TILE,
      y: (b.y + b.size / 2) * CF.TILE
    };
  },

  /**
   * 設備の「dir側の面」の外側に隣接するマス一覧
   * （スポナーの排出先・研磨機の出力先の候補）
   */
  frontCells(b) {
    const d = CF.DIRS[b.dir];
    const cells = [];
    for (let i = 0; i < b.size; i++) {
      let cx, cy;
      if (d.x === 1)       { cx = b.x + b.size; cy = b.y + i; }
      else if (d.x === -1) { cx = b.x - 1;      cy = b.y + i; }
      else if (d.y === 1)  { cx = b.x + i;      cy = b.y + b.size; }
      else                 { cx = b.x + i;      cy = b.y - 1; }
      cells.push({ x: cx, y: cy });
    }
    return cells;
  },

  /** 設備の「dirの反対側の面」のマス（研磨機の入力口セル）一覧 */
  backCells(b) {
    const d = CF.DIRS[b.dir];
    const cells = [];
    for (let i = 0; i < b.size; i++) {
      let cx, cy;
      if (d.x === 1)       { cx = b.x;              cy = b.y + i; }
      else if (d.x === -1) { cx = b.x + b.size - 1; cy = b.y + i; }
      else if (d.y === 1)  { cx = b.x + i;          cy = b.y; }
      else                 { cx = b.x + i;          cy = b.y + b.size - 1; }
      cells.push({ x: cx, y: cy });
    }
    return cells;
  }
};
