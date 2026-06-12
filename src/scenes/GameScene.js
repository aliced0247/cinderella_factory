/**
 * GameScene：工房（ワールド）の描画と操作
 *  - 複数部屋の床・壁・扉・設備・アイテム・姫の描画（Phase 3で増築対応）
 *  - タップ設置／ベルトのドラッグ連続敷設／回転・撤去・レシピ切替メニュー
 *  - 手拾い（ベルト上のアイテムを運ぶ）／クローゼット収蔵・着せ替え
 *  - 増築（工事中の扉タップ→確認）／カメラは姫に追従
 */
window.CF = window.CF || {};

(function () {
  const T = () => CF.TILE;

  const D_FLOOR = 0, D_BELT = 10, D_ITEM = 20, D_SORT = 30, D_FX = 90, D_MENU = 100, D_MODAL = 200;

  CF.GameScene = class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
      this.buildingSprites = new Map();
      this.itemSprites = new Map();
      this.floorAdded = 0;       // 床を描いた部屋数
      this.menu = null;
      this.pinch = null;
      this.drag = null;
      this.paintLast = null;
      this.chimneyTimer = 0;
      this.carriedSpr = null;

      this.input.addPointer(2);

      this.wallG = this.add.graphics().setDepth(D_FLOOR + 1);
      this.doorZones = [];       // 増築用「工事中の扉」当たり判定（ワールド矩形）
      this.refreshRooms();       // 床・壁・扉を全部屋ぶん描く

      for (const room of CF.World.rooms)
        for (const b of room.buildings) this.addBuildingSprite(b);

      this.createPrincess();
      this.createParticles();
      this.setupCamera();
      this.setupInput();

      CF.events.on('item:add', this.onItemAdd, this);
      CF.events.on('item:remove', this.onItemRemove, this);
      CF.events.on('sell', this.onSell, this);
      CF.events.on('machine:out', this.onMachineOut, this);
      CF.events.on('tool', () => this.closeMenu());
      // 着せ替え／増築は UIScene のモーダルから依頼される
      CF.events.on('appearance', this.applyPrincessAppearance, this);
      CF.events.on('expand:do', this.doExpand, this);

      this.scale.on('resize', () => this.fitCamera());

      this.events.on('shutdown', () => {
        CF.events.off('item:add', this.onItemAdd, this);
        CF.events.off('item:remove', this.onItemRemove, this);
        CF.events.off('sell', this.onSell, this);
        CF.events.off('machine:out', this.onMachineOut, this);
        CF.events.off('appearance', this.applyPrincessAppearance, this);
        CF.events.off('expand:do', this.doExpand, this);
      });
    }

    // ============================================================ 部屋（床・壁・扉）

    /** 未描画の部屋の床を足し、壁・扉を引き直す */
    refreshRooms() {
      for (let ri = this.floorAdded; ri < CF.World.rooms.length; ri++) this.createRoomFloor(ri);
      this.floorAdded = CF.World.rooms.length;
      this.drawWalls();
    }

    createRoomFloor(ri) {
      const ox = CF.World.offsetX(ri);
      for (let y = 0; y < CF.ROOM_H; y++) {
        for (let x = 0; x < CF.ROOM_W; x++) {
          const key = (x + y) % 2 === 0 ? 'floor_a' : 'floor_b';
          this.add.image((ox + x) * T() + T() / 2, y * T() + T() / 2, key).setDepth(D_FLOOR);
        }
      }
    }

    /** 外周壁＋部屋間の仕切り（扉は開口）＋未開放側の「工事中の扉」 */
    drawWalls() {
      const g = this.wallG;
      g.clear();
      this.doorZones = [];

      const n = CF.World.rooms.length;
      const totalW = n * CF.ROOM_W * T();
      const H = CF.ROOM_H * T();
      const dY0 = CF.DOOR_Y * T();
      const dY1 = (CF.DOOR_Y + CF.DOOR_H) * T();

      // 外周
      g.lineStyle(4, CF.hex(CF.PALETTE.MILK_TEA), 1);
      g.strokeRect(-2, -2, totalW + 4, H + 4);
      g.lineStyle(2, CF.hex(CF.PALETTE.BISCUIT), 1);
      g.strokeRect(-4, -4, totalW + 8, H + 8);

      // 部屋間の仕切り壁（扉は開口）
      for (let k = 1; k < n; k++) {
        const sx = k * CF.ROOM_W * T();
        g.lineStyle(4, CF.hex(CF.PALETTE.MILK_TEA), 1);
        g.lineBetween(sx, -2, sx, dY0);
        g.lineBetween(sx, dY1, sx, H + 2);
        // 扉の枠＆敷物（通れる印）
        g.fillStyle(CF.hex(CF.PALETTE.PINK_1), 0.55);
        g.fillRect(sx - 6, dY0, 12, dY1 - dY0);
        g.lineStyle(3, CF.hex(CF.PALETTE.GOLD_2), 1);
        g.lineBetween(sx, dY0 - 2, sx, dY0 + 4);
        g.lineBetween(sx, dY1 - 4, sx, dY1 + 2);
      }

      // 右端：まだ増築できるなら「工事中の扉」を描いてタップ受付
      if (CF.World.canExpand()) {
        const sx = totalW;
        g.fillStyle(CF.hex(CF.PALETTE.BISCUIT), 1);
        g.fillRect(sx - 14, dY0, 14, dY1 - dY0);
        g.lineStyle(2, CF.hex(CF.PALETTE.COCOA_SHADOW), 1);
        g.strokeRect(sx - 14, dY0, 14, dY1 - dY0);
        // 工事中の縞（レモン×ココア）
        g.lineStyle(3, CF.hex(CF.PALETTE.LEMON_3), 1);
        for (let yy = dY0 + 4; yy < dY1; yy += 10) g.lineBetween(sx - 14, yy, sx - 2, yy - 8);
        // 取っ手＝金ハート
        g.fillStyle(CF.hex(CF.PALETTE.GOLD_2), 1);
        g.fillCircle(sx - 7, (dY0 + dY1) / 2, 3);
        this.doorZones.push({ x0: sx - 44, x1: sx + 8, y0: dY0, y1: dY1 });
      }
    }

    createPrincess() {
      const start = CF.World.tilePx(0, CF.ROOM_W / 2, CF.ROOM_H / 2);
      this.princess = this.add.image(start.x, start.y, 'princess').setOrigin(0.5, 0.85);
      // もえちゃん裁定：59×96 スプライトは 1.3倍表示
      this.princess.setScale(1.3);
      this.princessTop = this.princess.displayHeight * 0.85; // 足元originから頭頂までの距離
      this.applyPrincessAppearance();
    }

    /** ドレス装備で見た目変化（色違い素材が来るまでは色相フィルタ＝tint仮実装） */
    applyPrincessAppearance() {
      if (CF.state.equip.body === 'dress') this.princess.setTint(0xBCA6F2); // ラベンダー寄り
      else this.princess.clearTint();
    }

    createParticles() {
      this.sparkles = this.add.particles(0, 0, 'sparkle', {
        speed: { min: 15, max: 50 }, lifespan: 700,
        scale: { start: 1.2, end: 0 }, gravityY: -30, emitting: false
      }).setDepth(D_FX);
    }

    // ============================================================ カメラ（姫に追従）

    setupCamera() {
      const cam = this.cameras.main;
      cam.setBackgroundColor(CF.PALETTE.MILK);
      this.updateCameraBounds();
      this.fitCamera();
      cam.startFollow(this.princess, true, 0.12, 0.12);
      cam.setFollowOffset(0, 24); // 下部UIぶん少し上に見せる
    }

    updateCameraBounds() {
      const m = 200;
      const totalW = CF.World.totalWidthTiles() * T();
      this.cameras.main.setBounds(-m, -m, totalW + m * 2, CF.ROOM_H * T() + m * 2);
    }

    /** 1部屋がだいたい収まるズームに合わせる（追従は維持） */
    fitCamera() {
      const cam = this.cameras.main;
      const sw = this.scale.width;
      const sh = this.scale.height - 140;
      const fit = Math.min(sw / (CF.ROOM_W * T() + 24), sh / (CF.ROOM_H * T() + 24));
      this.minZoom = Math.max(fit * 0.6, 0.25);
      this.maxZoom = 3;
      cam.setZoom(Phaser.Math.Clamp(fit, this.minZoom, this.maxZoom));
    }

    // ============================================================ 入力

    setupInput() {
      this.input.on('pointerdown', (p) => this.onDown(p));
      this.input.on('pointermove', (p) => this.onMove(p));
      this.input.on('pointerup', (p) => this.onUp(p));
      this.input.on('pointerupoutside', (p) => this.onUp(p));
    }

    worldPointers() {
      const ps = [this.input.pointer1, this.input.pointer2, this.input.pointer3];
      return ps.filter((p) => p && p.isDown && !CF.ui.isOverUI(p.x, p.y) && p._cfWorld);
    }

    onDown(p) {
      if (CF.ui.modal) return;                 // モーダル中は世界操作を止める
      if (CF.ui.isOverUI(p.x, p.y)) { p._cfWorld = false; return; }
      p._cfWorld = true;

      const wps = this.worldPointers();
      if (wps.length >= 2) { this.drag = null; this.paintLast = null; this.startPinch(wps[0], wps[1]); return; }

      this.drag = { id: p.id, startX: p.x, startY: p.y, moved: false };

      if (CF.ui.tool === 'belt' && !CF.state.hand) {
        this._beltBrokeToast = false;
        const t = this.tileAt(p);
        this.paintLast = { gx: t.gx, gy: t.gy };
        this.paintBelt(t.gx, t.gy, null);
      }
    }

    onMove(p) {
      if (CF.ui.modal || !p.isDown) return;
      if (this.pinch) { this.updatePinch(); return; }
      if (!this.drag || this.drag.id !== p.id) return;

      const dx = p.x - this.drag.startX, dy = p.y - this.drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 12) this.drag.moved = true;

      if (CF.ui.tool === 'belt' && !CF.state.hand && this.paintLast) {
        const t = this.tileAt(p);
        if (t.gx !== this.paintLast.gx || t.gy !== this.paintLast.gy) {
          this.paintPath(this.paintLast, { gx: t.gx, gy: t.gy });
          this.paintLast = { gx: t.gx, gy: t.gy };
        }
      }
      // カメラは姫追従なのでドラッグスクロールは行わない
    }

    onUp(p) {
      if (this.pinch) { if (this.worldPointers().length < 2) this.pinch = null; return; }
      if (CF.ui.modal) return;
      if (!this.drag || this.drag.id !== p.id) return;
      const drag = this.drag; this.drag = null; this.paintLast = null;
      if (drag.moved) return;

      const t = this.tileAt(p);
      if (this.menu && this.menuContains(p)) return;

      // 建設ツール選択中（ベルト以外）→ 設置
      if (CF.ui.tool && CF.ui.tool !== 'belt' && !CF.state.hand) { this.tryPlace(CF.ui.tool, t); return; }
      if (CF.ui.tool === 'belt' && !CF.state.hand) return; // ベルトはonDownで敷設済み

      const cell = CF.World.worldToCell(t.wx, t.wy);
      const b = cell ? CF.World.at(cell.ri, cell.x, cell.y) : null;

      // 手持ちがある → 置く / 収蔵
      if (CF.state.hand) { this.handleCarryTap(b, cell); return; }

      // ベルト上のアイテムを手拾い
      const item = CF.Logistics.itemAtPx(t.wx, t.wy, T() * 0.55);
      if (item) { this.pickUpItem(item); return; }

      // 設備タップ
      if (b) {
        if (b.type === 'closet') CF.events.emit('wardrobe:open');
        else this.openMenu(b);
        return;
      }

      // 工事中の扉タップ → 増築確認
      if (this.tappedDoorZone(t.wx, t.wy)) { CF.events.emit('expand:open'); return; }

      this.closeMenu();
    }

    startPinch(p1, p2) {
      this.pinch = { dist0: Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y), zoom0: this.cameras.main.zoom };
      this.closeMenu();
    }

    updatePinch() {
      const wps = this.worldPointers();
      if (wps.length < 2) return;
      const [p1, p2] = wps;
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      const zoom = Phaser.Math.Clamp(this.pinch.zoom0 * (dist / Math.max(this.pinch.dist0, 1)), this.minZoom, this.maxZoom);
      this.cameras.main.setZoom(zoom); // 追従はそのまま、ズームだけ変える
    }

    // ============================================================ 設置

    /** ワールド座標とワールドタイル（gx,gy） */
    tileAt(p) {
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      return { gx: Math.floor(w.x / T()), gy: Math.floor(w.y / T()), wx: w.x, wy: w.y };
    }

    /** ワールドタイル → { ri, x, y }（部屋ローカル）or null */
    resolveCell(gx, gy) {
      if (gy < 0 || gy >= CF.ROOM_H) return null;
      const ri = Math.floor(gx / CF.ROOM_W);
      if (ri < 0 || ri >= CF.World.rooms.length) return null;
      return { ri, x: gx - ri * CF.ROOM_W, y: gy };
    }

    tryPlace(type, t) {
      const def = CF.BUILDINGS[type];
      const baseCell = CF.World.worldToCell(t.wx, t.wy);
      if (!baseCell) return;
      const ri = baseCell.ri;
      // 2×2はタップ点中心。部屋ローカルでクランプ
      const lxC = t.wx / T() - CF.World.offsetX(ri);
      let ox = Phaser.Math.Clamp(Math.round(lxC - def.size / 2), 0, CF.ROOM_W - def.size);
      let oy = Phaser.Math.Clamp(Math.round(t.wy / T() - def.size / 2), 0, CF.ROOM_H - def.size);

      if (def.limit && CF.World.countOf(type, ri) >= def.limit) {
        CF.events.emit('toast', `${def.name}は1部屋に${def.limit}つまでだよ`); return;
      }
      if (CF.state.money < def.cost) { CF.events.emit('toast', `${def.name}には${def.cost}リル必要だよ`); return; }
      if (!CF.World.canPlace(type, ri, ox, oy)) { this.flashInvalid(ri, ox, oy, def.size); return; }

      const b = CF.World.place(type, ri, ox, oy, CF.ui.buildDir);
      this.spend(def.cost);
      this.addBuildingSprite(b);
      this.popSprite(this.buildingSprites.get(b.id));
      this.closeMenu();
      CF.Save.request();
    }

    spend(amount) { CF.state.money -= amount; CF.events.emit('money'); }

    /** ベルト1マス敷設（ワールドタイル指定。既存ベルトは向き更新＝無料） */
    paintBelt(gx, gy, dir) {
      const cell = this.resolveCell(gx, gy);
      if (!cell) return;
      const existing = CF.World.at(cell.ri, cell.x, cell.y);
      if (existing) {
        if (existing.type === 'belt' && dir != null && existing.dir !== dir) {
          existing.dir = dir; this.updateBuildingSprite(existing); CF.Save.request();
        }
        return;
      }
      const cost = CF.BUILDINGS.belt.cost;
      if (CF.state.money < cost) {
        if (!this._beltBrokeToast) { this._beltBrokeToast = true; CF.events.emit('toast', `ベルトには${cost}リル必要だよ`); }
        return;
      }
      const b = CF.World.place('belt', cell.ri, cell.x, cell.y, dir == null ? CF.ui.buildDir : dir);
      if (b) { this.spend(cost); this.addBuildingSprite(b); this.closeMenu(); CF.Save.request(); }
    }

    paintPath(from, to) {
      let cx = from.gx, cy = from.gy, guard = 64;
      while ((cx !== to.gx || cy !== to.gy) && guard-- > 0) {
        const sx = Math.sign(to.gx - cx), sy = Math.sign(to.gy - cy);
        let nx = cx, ny = cy, dir;
        if (sx !== 0) { nx = cx + sx; dir = sx > 0 ? 0 : 2; }
        else { ny = cy + sy; dir = sy > 0 ? 1 : 3; }
        this.paintBelt(cx, cy, dir);
        this.paintBelt(nx, ny, dir);
        cx = nx; cy = ny;
      }
    }

    flashInvalid(ri, x, y, size) {
      const c = CF.World.tilePx(ri, x + size / 2 - 0.5, y + size / 2 - 0.5);
      const r = this.add.rectangle(c.x, c.y, size * T(), size * T(), CF.hex(CF.PALETTE.CHERRY), 0.35).setDepth(D_FX);
      this.tweens.add({ targets: r, alpha: 0, duration: 350, onComplete: () => r.destroy() });
    }

    // ============================================================ 設備スプライト

    addBuildingSprite(b) {
      const def = CF.BUILDINGS[b.type];
      const c = CF.World.centerPx(b);
      const spr = this.add.image(c.x, c.y, def.tex);
      this.applyDirAndDepth(b, spr);
      this.buildingSprites.set(b.id, spr);
      return spr;
    }

    updateBuildingSprite(b) {
      const spr = this.buildingSprites.get(b.id);
      if (spr) this.applyDirAndDepth(b, spr);
    }

    applyDirAndDepth(b, spr) {
      spr.setRotation(b.dir * Math.PI / 2);
      if (b.type === 'belt') spr.setDepth(D_BELT);
      else spr.setDepth(D_SORT + (b.y + b.size) * T() / 100000);
    }

    removeBuilding(b) {
      // 撤去は半額。ただし最後の泉（全部屋合計で1個）は全額（詰み対策）
      let rate = CF.REFUND_RATE;
      if (CF.BUILDINGS[b.type].kind === 'spawner' && CF.World.spawnerCount() <= 1) rate = 1.0;
      const refund = Math.floor(CF.BUILDINGS[b.type].cost * rate);
      const c = CF.World.centerPx(b);

      CF.Logistics.onBuildingRemoved(b);
      CF.World.remove(b);
      const spr = this.buildingSprites.get(b.id);
      if (spr) spr.destroy();
      this.buildingSprites.delete(b.id);

      if (refund > 0) {
        CF.state.money += refund; CF.events.emit('money');
        this.floatText(c.x, c.y, `+${refund}リル`, CF.PALETTE.MINT_3);
      }
      CF.Save.request();
    }

    floatText(x, y, msg, color) {
      const tx = this.add.text(x, y - 10, msg, {
        fontSize: '13px', fontStyle: 'bold', color, stroke: CF.PALETTE.MILK, strokeThickness: 3
      }).setOrigin(0.5).setDepth(D_FX);
      this.tweens.add({ targets: tx, y: y - 36, alpha: 0, duration: 800, onComplete: () => tx.destroy() });
    }

    popSprite(spr) {
      if (!spr) return;
      const sx = spr.scaleX, sy = spr.scaleY;
      spr.setScale(sx * 0.5, sy * 0.5);
      this.tweens.add({ targets: spr, scaleX: sx, scaleY: sy, duration: 160, ease: 'Back.Out' });
    }

    // ============================================================ 手拾い／収蔵

    pickUpItem(item) {
      CF.state.hand = item.type;
      CF.Logistics.pickUp(item);
      this.refreshCarried();
      CF.events.emit('toast', `${CF.ITEMS[item.type].name}を持った（ベルトかクローゼットへ）`);
    }

    handleCarryTap(b, cell) {
      const type = CF.state.hand;
      if (b && b.type === 'closet') {
        if (CF.isStorable(type)) {
          CF.state.wardrobe[type] = (CF.state.wardrobe[type] || 0) + 1;
          CF.state.hand = null; this.refreshCarried();
          CF.events.emit('toast', `${CF.ITEMS[type].name}をクローゼットに収蔵`);
          CF.Save.request();
        } else {
          CF.events.emit('toast', '収蔵できるのは高級品だけだよ');
        }
        return;
      }
      if (b && b.type === 'belt' && cell) {
        if (CF.Logistics.dropOnBelt(type, cell.ri, cell.x, cell.y)) {
          CF.state.hand = null; this.refreshCarried();
        } else {
          CF.events.emit('toast', 'そのベルトは塞がってるよ');
        }
        return;
      }
      CF.events.emit('toast', 'ベルトかクローゼットに置いてね');
    }

    /** 手持ちアイコン（姫の頭上）を更新 */
    refreshCarried() {
      if (CF.state.hand) {
        if (!this.carriedSpr) {
          this.carriedSpr = this.add.image(0, 0, CF.ITEMS[CF.state.hand].tex).setDepth(D_FX).setScale(1.3);
        } else {
          this.carriedSpr.setTexture(CF.ITEMS[CF.state.hand].tex).setVisible(true);
        }
      } else if (this.carriedSpr) {
        this.carriedSpr.setVisible(false);
      }
    }

    // ============================================================ ミニメニュー（回転/レシピ/撤去）

    openMenu(b) {
      this.closeMenu();
      const c = CF.World.centerPx(b);
      const def = CF.BUILDINGS[b.type];
      const switchable = def.recipes && def.recipes.length > 1;
      const cont = this.add.container(c.x, c.y - b.size * T() / 2 - 30).setDepth(D_MENU);
      const width = switchable ? 168 : 120;
      this.menuHalfW = width / 2;

      const bg = this.add.rectangle(0, 0, width, 44, CF.hex(CF.PALETTE.MILK), 0.96).setStrokeStyle(2, CF.hex(CF.PALETTE.GOLD_2));
      const title = switchable ? `${def.name}：${CF.recipeName(def, b.recipeIndex)}` : def.name;
      const label = this.add.text(0, -32, title, {
        fontSize: '12px', fontStyle: 'bold', color: CF.PALETTE.COCOA_SHADOW,
        backgroundColor: CF.PALETTE.MILK, padding: { x: 6, y: 2 }
      }).setOrigin(0.5);
      cont.add([bg, label]);

      const xs = switchable ? [-52, 0, 52] : [-28, 28];
      let i = 0;
      this._menuButton(cont, xs[i++], '⟳', CF.PALETTE.LAVENDER_1, CF.PALETTE.LAVENDER_3, () => {
        CF.World.rotate(b); this.updateBuildingSprite(b); CF.Save.request();
      });
      if (switchable) {
        const recBg = this.add.rectangle(xs[i], 0, 40, 34, CF.hex(CF.PALETTE.MINT_1)).setStrokeStyle(2, CF.hex(CF.PALETTE.MINT_3)).setInteractive();
        const recIcon = this.add.image(xs[i], 0, CF.ITEMS[def.recipes[b.recipeIndex].out].tex).setScale(1.2);
        recBg.on('pointerup', () => {
          b.recipeIndex = (b.recipeIndex + 1) % def.recipes.length;
          recIcon.setTexture(CF.ITEMS[def.recipes[b.recipeIndex].out].tex);
          label.setText(`${def.name}：${CF.recipeName(def, b.recipeIndex)}`);
          CF.events.emit('toast', `レシピ：${CF.recipeName(def, b.recipeIndex)}`); CF.Save.request();
        });
        cont.add([recBg, recIcon]); i++;
      }
      this._menuButton(cont, xs[i++], '✕', CF.PALETTE.SUGAR_PINK, CF.PALETTE.CHERRY, () => {
        this.removeBuilding(b); this.closeMenu();
      });
      this.menu = { cont, building: b };
    }

    _menuButton(cont, x, glyph, fill, stroke, onTap) {
      const bg = this.add.rectangle(x, 0, 40, 34, CF.hex(fill)).setStrokeStyle(2, CF.hex(stroke)).setInteractive();
      const tx = this.add.text(x, 0, glyph, { fontSize: '19px', color: stroke, fontStyle: 'bold' }).setOrigin(0.5);
      bg.on('pointerup', onTap);
      cont.add([bg, tx]);
    }

    closeMenu() { if (this.menu) { this.menu.cont.destroy(); this.menu = null; } }

    menuContains(p) {
      if (!this.menu) return false;
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      const m = this.menu.cont;
      return Math.abs(w.x - m.x) < (this.menuHalfW || 64) + 4 && Math.abs(w.y - m.y) < 40;
    }

    // ============================================================ 増築（モーダルはUISceneが描画）

    /** UISceneの増築ダイアログ「増築する」から依頼される */
    doExpand() {
      if (CF.state.money < CF.EXPAND_COST || !CF.World.canExpand()) return;
      const ri = CF.World.addRoom();
      if (ri < 0) return;
      this.spend(CF.EXPAND_COST);
      this.refreshRooms();          // 新部屋の床＋扉の引き直し
      this.updateCameraBounds();
      CF.events.emit('toast', '工房を増築した！新しい扉から行けるよ');
      CF.Save.request();
    }

    /** ワールド座標が「工事中の扉」当たり判定内か */
    tappedDoorZone(wx, wy) {
      return this.doorZones.some((z) => wx >= z.x0 && wx <= z.x1 && wy >= z.y0 && wy <= z.y1);
    }

    // ============================================================ アイテム描画

    onItemAdd(item) {
      const spr = this.add.image(item.x, item.y, CF.ITEMS[item.type].tex).setDepth(D_ITEM);
      this.itemSprites.set(item.id, spr);
      this.popSprite(spr);
    }

    onItemRemove(item) {
      const spr = this.itemSprites.get(item.id);
      if (spr) spr.destroy();
      this.itemSprites.delete(item.id);
    }

    onSell(e) { this.sparkles.explode(8, e.x, e.y); this.floatText(e.x, e.y, `+${e.price}リル`, CF.PALETTE.GOLD_2); }

    onMachineOut(b) { const c = CF.World.centerPx(b); this.sparkles.explode(4, c.x, c.y - b.size * T() / 2); }

    // ============================================================ 毎フレーム

    update(time, delta) {
      const dt = Math.min(delta / 1000, 0.1);
      CF.Logistics.update(dt);
      for (const item of CF.Logistics.items) {
        const spr = this.itemSprites.get(item.id);
        if (spr) { spr.x = item.x; spr.y = item.y; }
      }
      this.updatePrincess(dt);
      this.updateCarried();
      this.updateChimneys(dt);
    }

    updatePrincess(dt) {
      const joy = CF.input.joy;
      if (CF.ui.modal || (!joy.x && !joy.y)) return;
      const speed = 100 * (CF.state.equip.hand === 'bouquet' ? CF.EQUIP_FX.bouquet.speedMul : 1);
      const pad = 8;
      const totalW = CF.World.totalWidthTiles() * T();

      let nx = Phaser.Math.Clamp(this.princess.x + joy.x * speed * dt, pad, totalW - pad);
      let ny = Phaser.Math.Clamp(this.princess.y + joy.y * speed * dt, 14, CF.ROOM_H * T() - 2);

      const blocked = (x, y) => {
        const c = CF.World.worldToCell(x, y);
        const b = c && CF.World.at(c.ri, c.x, c.y);
        return !!b && b.size > 1; // 2×2設備・家具はすり抜け不可
      };

      if (!blocked(nx, this.princess.y) && !this.seamBlocked(this.princess.x, nx, this.princess.y))
        this.princess.x = nx;
      if (!blocked(this.princess.x, ny)) this.princess.y = ny;

      this.princess.setFlipX(joy.x < 0);
      this.princess.setDepth(D_SORT + this.princess.y / 100000);
    }

    /** x0→x1 の移動が部屋の仕切り壁（扉以外）を横切るなら true */
    seamBlocked(x0, x1, y) {
      const inDoor = y >= CF.DOOR_Y * T() && y <= (CF.DOOR_Y + CF.DOOR_H) * T();
      if (inDoor) return false;
      const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
      for (let k = 1; k < CF.World.rooms.length; k++) {
        const sx = k * CF.ROOM_W * T();
        if (lo < sx && hi >= sx) return true;
      }
      return false;
    }

    updateCarried() {
      if (!this.carriedSpr || !this.carriedSpr.visible) return;
      this.carriedSpr.x = this.princess.x;
      this.carriedSpr.y = this.princess.y - this.princessTop - 8;
    }

    updateChimneys(dt) {
      this.chimneyTimer += dt;
      if (this.chimneyTimer < 0.25) return;
      this.chimneyTimer = 0;
      for (const room of CF.World.rooms) {
        for (const b of room.buildings) {
          const kind = CF.BUILDINGS[b.type].kind;
          if ((kind === 'processor' || kind === 'assembler') && b.processing) {
            const c = CF.World.centerPx(b);
            this.sparkles.explode(1, c.x + Phaser.Math.Between(-8, 8), c.y - 30);
          }
        }
      }
    }
  };
})();
