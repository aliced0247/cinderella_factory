/**
 * ワールド（部屋・グリッド・設備配置）のデータモデル
 *
 * Phase 3：部屋を右へ増築できる。rooms[] に部屋を並べ、
 * 部屋 ri はワールド上で x方向に ri*ROOM_W だけオフセットして配置する（隙間なし）。
 * 部屋の境目は壁＋扉。ベルトは部屋をまたいで繋がらない（近傍探索が部屋内で閉じるため）。
 *
 * 座標系：
 *   ・各設備/アイテムは「部屋インデックス room ＋ 部屋ローカルの (x,y)」で持つ
 *   ・描画用ワールドpxは tilePx(room,x,y) で求める（room オフセットを加味）
 */
window.CF = window.CF || {};

/** ゲーム全体の状態 */
CF.state = {
  money: 0,
  wardrobe: {},                               // 収蔵品：種別 → 個数（高級品のみ）
  equip: { body: null, head: null, hand: null }, // 装備中：部位 → アイテム種（null=なし）
  hand: null                                  // 手持ち（拾って運んでいるアイテム種）。セーブしない
};

CF.World = {
  rooms: [],
  _nextId: 1,

  /** 初期化（セーブがあれば復元） */
  init() {
    this.rooms = [];
    this._nextId = 1;
    CF.state.money = CF.START_MONEY;
    CF.state.wardrobe = {};
    CF.state.equip = { body: null, head: null, hand: null };
    CF.state.hand = null;

    const data = CF.Save.load();
    if (data) {
      CF.state.money = (data.money == null) ? CF.START_MONEY : data.money;
      if (data.wardrobe) CF.state.wardrobe = data.wardrobe;
      if (data.equip) {
        CF.state.equip = {
          body: data.equip.body || null,
          head: data.equip.head || null,
          hand: data.equip.hand || null
        };
      }
      (data.rooms || []).forEach((r, ri) => {
        this.rooms.push(this._createRoom(r.w || CF.ROOM_W, r.h || CF.ROOM_H));
        for (const b of r.buildings) {
          const inst = this.place(b.t, ri, b.x, b.y, b.d);
          if (inst && b.r != null) {
            const def = CF.BUILDINGS[b.t];
            if (def.recipes) inst.recipeIndex = Phaser.Math.Clamp(b.r, 0, def.recipes.length - 1);
          }
        }
      });
    }
    if (this.rooms.length === 0) {
      this.rooms.push(this._createRoom(CF.ROOM_W, CF.ROOM_H)); // 工房1部屋
    }
  },

  _createRoom(w, h) {
    const grid = [];
    for (let y = 0; y < h; y++) grid.push(new Array(w).fill(null));
    return { w, h, grid, buildings: [] };
  },

  /** 部屋を1つ増築（右へ）。成功なら新部屋インデックスを返す */
  addRoom() {
    if (this.rooms.length >= CF.MAX_ROOMS) return -1;
    this.rooms.push(this._createRoom(CF.ROOM_W, CF.ROOM_H));
    return this.rooms.length - 1;
  },

  canExpand() {
    return this.rooms.length < CF.MAX_ROOMS;
  },

  // ------------------------------------------------------------ 座標

  /** 部屋 ri のワールド原点（タイル単位・x） */
  offsetX(ri) {
    return ri * CF.ROOM_W;
  },

  /** 全部屋を並べた総幅（タイル） */
  totalWidthTiles() {
    return this.rooms.length * CF.ROOM_W;
  },

  /** 部屋ローカル (x,y) → ワールドpx（タイル中心） */
  tilePx(ri, x, y) {
    return {
      x: (this.offsetX(ri) + x + 0.5) * CF.TILE,
      y: (y + 0.5) * CF.TILE
    };
  },

  /** ワールドpx → { ri, x, y }（どの部屋のどのローカルマスか）。範囲外は null */
  worldToCell(px, py) {
    const gx = Math.floor(px / CF.TILE);
    const gy = Math.floor(py / CF.TILE);
    if (gy < 0 || gy >= CF.ROOM_H) return null;
    const ri = Math.floor(gx / CF.ROOM_W);
    if (ri < 0 || ri >= this.rooms.length) return null;
    return { ri, x: gx - ri * CF.ROOM_W, y: gy };
  },

  inBounds(ri, x, y) {
    const r = this.rooms[ri];
    return !!r && x >= 0 && y >= 0 && x < r.w && y < r.h;
  },

  /** 部屋 ri ローカル (x,y) の設備（無ければnull） */
  at(ri, x, y) {
    if (!this.inBounds(ri, x, y)) return null;
    return this.rooms[ri].grid[y][x];
  },

  /** 部屋 ri 内の種別ごとの設置数 */
  countOf(type, ri) {
    return this.rooms[ri].buildings.filter((b) => b.type === type).length;
  },

  /** 全部屋を通した泉（収入源）の総数 */
  spawnerCount() {
    let n = 0;
    for (const r of this.rooms) {
      n += r.buildings.filter((b) => CF.BUILDINGS[b.type].kind === 'spawner').length;
    }
    return n;
  },

  /** 設置できるか（範囲内・空き・上限） */
  canPlace(type, ri, x, y) {
    const def = CF.BUILDINGS[type];
    if (!def || !this.rooms[ri]) return false;
    if (def.limit && this.countOf(type, ri) >= def.limit) return false;
    for (let dy = 0; dy < def.size; dy++) {
      for (let dx = 0; dx < def.size; dx++) {
        if (!this.inBounds(ri, x + dx, y + dy)) return false;
        if (this.at(ri, x + dx, y + dy)) return false;
      }
    }
    return true;
  },

  /** 設置する。成功なら設備インスタンスを返す（失敗はnull） */
  place(type, ri, x, y, dir) {
    if (!this.canPlace(type, ri, x, y)) return null;
    const def = CF.BUILDINGS[type];
    const b = {
      id: this._nextId++,
      type, room: ri, x, y,
      dir: dir == null ? 0 : (dir & 3),
      size: def.size,
      recipeIndex: 0,
      // 動作状態（セーブ対象外）
      timer: 0, processing: null, output: null, incoming: false
    };
    if (def.kind === 'assembler') { b.buffer = {}; b.incomingCount = {}; }
    const room = this.rooms[ri];
    for (let dy = 0; dy < def.size; dy++) {
      for (let dx = 0; dx < def.size; dx++) {
        room.grid[y + dy][x + dx] = b;
      }
    }
    room.buildings.push(b);
    return b;
  },

  /** 撤去する */
  remove(b) {
    const room = this.rooms[b.room];
    for (let dy = 0; dy < b.size; dy++) {
      for (let dx = 0; dx < b.size; dx++) {
        if (room.grid[b.y + dy][b.x + dx] === b) room.grid[b.y + dy][b.x + dx] = null;
      }
    }
    const i = room.buildings.indexOf(b);
    if (i >= 0) room.buildings.splice(i, 1);
  },

  rotate(b) { b.dir = (b.dir + 1) & 3; },

  /** 設備の中心ワールドpx */
  centerPx(b) {
    return {
      x: (this.offsetX(b.room) + b.x + b.size / 2) * CF.TILE,
      y: (b.y + b.size / 2) * CF.TILE
    };
  },

  /** dir側の面の外側に隣接するローカルマス一覧（排出/出力先候補） */
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

  /** dirの反対側の面のローカルマス一覧（入力口） */
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
