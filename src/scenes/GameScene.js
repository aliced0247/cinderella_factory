/**
 * GameScene：工房（ワールド）の描画と操作
 *  - 床・設備・アイテム・姫の描画
 *  - タップ設置／ベルトのドラッグ連続敷設
 *  - 設置済みタップ → 回転/撤去ミニメニュー
 *  - ピンチズーム＋ドラッグスクロール
 */
window.CF = window.CF || {};

(function () {
  const T = () => CF.TILE;

  // 描画順（depth）
  const D_FLOOR = 0;
  const D_BELT = 10;
  const D_ITEM = 20;
  const D_SORT = 30;    // 機械・姫（+y/100000 でYソート）
  const D_FX = 90;
  const D_MENU = 100;

  CF.GameScene = class GameScene extends Phaser.Scene {
    constructor() {
      super('Game');
    }

    create() {
      this.buildingSprites = new Map(); // building.id -> sprite
      this.itemSprites = new Map();     // item.id -> sprite
      this.menu = null;                 // 回転/撤去ミニメニュー
      this.pinch = null;                // ピンチ状態
      this.drag = null;                 // 1本指ドラッグ状態
      this.paintLast = null;            // ベルト連続敷設の直前タイル
      this.chimneyTimer = 0;

      this.input.addPointer(2); // マルチタッチ（計3ポインタ）

      this.createFloor();

      // セーブ復元分の設備スプライト
      for (const b of CF.World.room().buildings) this.addBuildingSprite(b);

      this.createPrincess();
      this.createParticles();
      this.setupCamera();
      this.setupInput();

      // 物流イベント → 描画
      CF.events.on('item:add', this.onItemAdd, this);
      CF.events.on('item:remove', this.onItemRemove, this);
      CF.events.on('sell', this.onSell, this);
      CF.events.on('machine:out', this.onMachineOut, this);
      CF.events.on('tool', () => this.closeMenu());

      this.scale.on('resize', () => this.fitCamera(false));

      this.events.on('shutdown', () => {
        CF.events.off('item:add', this.onItemAdd, this);
        CF.events.off('item:remove', this.onItemRemove, this);
        CF.events.off('sell', this.onSell, this);
        CF.events.off('machine:out', this.onMachineOut, this);
      });
    }

    // ------------------------------------------------------------ 生成

    /** 床：クリーム×シュガーピンクの市松 */
    createFloor() {
      const room = CF.World.room();
      for (let y = 0; y < room.h; y++) {
        for (let x = 0; x < room.w; x++) {
          const key = (x + y) % 2 === 0 ? 'floor_a' : 'floor_b';
          this.add.image(x * T() + T() / 2, y * T() + T() / 2, key).setDepth(D_FLOOR);
        }
      }
      // 部屋の壁（縁取り）
      const g = this.add.graphics().setDepth(D_FLOOR + 1);
      g.lineStyle(4, CF.hex(CF.PALETTE.MILK_TEA), 1);
      g.strokeRect(-2, -2, room.w * T() + 4, room.h * T() + 4);
      g.lineStyle(2, CF.hex(CF.PALETTE.BISCUIT), 1);
      g.strokeRect(-4, -4, room.w * T() + 8, room.h * T() + 8);
    }

    createPrincess() {
      const room = CF.World.room();
      this.princess = this.add.image(room.w * T() / 2, room.h * T() / 2, 'princess');
      this.princess.setOrigin(0.5, 0.8); // 足元基準
    }

    createParticles() {
      this.sparkles = this.add.particles(0, 0, 'sparkle', {
        speed: { min: 15, max: 50 },
        lifespan: 700,
        scale: { start: 1.2, end: 0 },
        gravityY: -30,
        emitting: false
      }).setDepth(D_FX);
    }

    // ------------------------------------------------------------ カメラ

    setupCamera() {
      const room = CF.World.room();
      const m = 240; // 余白
      this.cameras.main.setBounds(-m, -m, room.w * T() + m * 2, room.h * T() + m * 2);
      this.cameras.main.setBackgroundColor(CF.PALETTE.MILK);
      this.fitCamera(true);
    }

    /** 部屋全体が画面に収まるズームに合わせる */
    fitCamera(center) {
      const room = CF.World.room();
      const cam = this.cameras.main;
      const sw = this.scale.width;
      const sh = this.scale.height - 140; // 上下UIぶんを概算で控除
      const fit = Math.min(sw / (room.w * T() + 24), sh / (room.h * T() + 24));
      this.minZoom = Math.max(fit * 0.6, 0.25);
      this.maxZoom = 3;
      cam.setZoom(Phaser.Math.Clamp(fit, this.minZoom, this.maxZoom));
      if (center) cam.centerOn(room.w * T() / 2, room.h * T() / 2 - 10);
    }

    // ------------------------------------------------------------ 入力

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
      if (CF.ui.isOverUI(p.x, p.y)) { p._cfWorld = false; return; }
      p._cfWorld = true;

      const wps = this.worldPointers();
      if (wps.length >= 2) {
        // ピンチ開始（1本指の操作は破棄）
        this.drag = null;
        this.paintLast = null;
        this.startPinch(wps[0], wps[1]);
        return;
      }

      const cam = this.cameras.main;
      this.drag = {
        id: p.id,
        startX: p.x, startY: p.y,
        scrollX: cam.scrollX, scrollY: cam.scrollY,
        moved: false
      };

      // ベルトはドラッグで連続敷設
      if (CF.ui.tool === 'belt') {
        this._beltBrokeToast = false; // ドラッグごとに不足トーストを1回だけ出す
        const t = this.tileAt(p);
        this.paintLast = t;
        this.paintBelt(t, null);
      }
    }

    onMove(p) {
      if (!p.isDown) return;

      if (this.pinch) { this.updatePinch(); return; }
      if (!this.drag || this.drag.id !== p.id) return;

      const dx = p.x - this.drag.startX;
      const dy = p.y - this.drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 12) this.drag.moved = true;

      if (CF.ui.tool === 'belt' && this.paintLast) {
        // ベルト塗り：通ったタイルに敷きつつ向きも更新
        const t = this.tileAt(p);
        if (t.x !== this.paintLast.x || t.y !== this.paintLast.y) {
          this.paintPath(this.paintLast, t);
          this.paintLast = t;
        }
        return;
      }

      // ドラッグスクロール
      if (this.drag.moved) {
        const cam = this.cameras.main;
        cam.scrollX = this.drag.scrollX - dx / cam.zoom;
        cam.scrollY = this.drag.scrollY - dy / cam.zoom;
        this.closeMenu();
      }
    }

    onUp(p) {
      if (this.pinch) {
        // どちらかが離れたらピンチ終了
        if (this.worldPointers().length < 2) this.pinch = null;
        return;
      }
      if (!this.drag || this.drag.id !== p.id) return;
      const drag = this.drag;
      this.drag = null;
      this.paintLast = null;
      if (drag.moved) return; // ドラッグはタップ扱いしない

      // --- タップ確定 ---
      const t = this.tileAt(p);

      // ミニメニューのボタン領域なら何もしない（ボタン側が処理）
      if (this.menu && this.menuContains(p)) return;

      if (CF.ui.tool && CF.ui.tool !== 'belt') {
        this.tryPlace(CF.ui.tool, p);
        return;
      }
      if (CF.ui.tool === 'belt') return; // ベルトはonDownで敷設済み

      // 道具なし：設置済みをタップ → 回転/撤去メニュー
      const b = CF.World.at(t.x, t.y);
      if (b) this.openMenu(b);
      else this.closeMenu();
    }

    // --- ピンチズーム ---

    startPinch(p1, p2) {
      const cam = this.cameras.main;
      this.pinch = {
        dist0: Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y),
        zoom0: cam.zoom,
        world0: cam.getWorldPoint((p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
      };
      this.closeMenu();
    }

    updatePinch() {
      const wps = this.worldPointers();
      if (wps.length < 2) return;
      const [p1, p2] = wps;
      const cam = this.cameras.main;
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      const zoom = Phaser.Math.Clamp(
        this.pinch.zoom0 * (dist / Math.max(this.pinch.dist0, 1)),
        this.minZoom, this.maxZoom
      );
      cam.setZoom(zoom);
      // ピンチ中心の世界座標が指の中点に留まるようにスクロール
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      cam.scrollX = this.pinch.world0.x - cam.width / 2 - (midX - cam.width / 2) / zoom;
      cam.scrollY = this.pinch.world0.y - cam.height / 2 - (midY - cam.height / 2) / zoom;
    }

    // ------------------------------------------------------------ 設置

    tileAt(p) {
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      return { x: Math.floor(w.x / T()), y: Math.floor(w.y / T()), wx: w.x, wy: w.y };
    }

    /** タップ位置を中心に据えた設置原点（2×2はタップ点が中央になるように） */
    originFor(type, t) {
      const size = CF.BUILDINGS[type].size;
      const room = CF.World.room();
      let ox = Math.round(t.wx / T() - size / 2);
      let oy = Math.round(t.wy / T() - size / 2);
      ox = Phaser.Math.Clamp(ox, 0, room.w - size);
      oy = Phaser.Math.Clamp(oy, 0, room.h - size);
      return { x: ox, y: oy };
    }

    tryPlace(type, p) {
      const t = this.tileAt(p);
      const o = this.originFor(type, t);
      const def = CF.BUILDINGS[type];

      if (def.limit && CF.World.countOf(type) >= def.limit) {
        CF.events.emit('toast', `${def.name}は${def.limit}つまでだよ`);
        return;
      }
      if (CF.state.money < def.cost) {
        CF.events.emit('toast', `${def.name}には${def.cost}リル必要だよ`);
        return;
      }
      if (!CF.World.canPlace(type, o.x, o.y)) {
        this.flashInvalid(o, def.size);
        return;
      }
      const b = CF.World.place(type, o.x, o.y, CF.ui.buildDir);
      this.spend(def.cost);
      this.addBuildingSprite(b);
      this.popSprite(this.buildingSprites.get(b.id));
      this.closeMenu();
      CF.Save.request();
    }

    /** 支払い（所持リルを減らしてUI更新） */
    spend(amount) {
      CF.state.money -= amount;
      CF.events.emit('money');
    }

    /** ベルト1マス敷設（既存ベルトなら向きだけ更新＝引き直し） */
    paintBelt(t, dir) {
      const room = CF.World.room();
      if (t.x < 0 || t.y < 0 || t.x >= room.w || t.y >= room.h) return;
      const existing = CF.World.at(t.x, t.y);
      if (existing) {
        // 引き直し（向きの更新）は無料。既存ベルトの再敷設はコスト不要
        if (existing.type === 'belt' && dir != null && existing.dir !== dir) {
          existing.dir = dir;
          this.updateBuildingSprite(existing);
          CF.Save.request();
        }
        return;
      }
      const cost = CF.BUILDINGS.belt.cost;
      if (CF.state.money < cost) {
        // ドラッグ中に連呼されるのでトーストは控えめに（1回だけ）
        if (!this._beltBrokeToast) {
          this._beltBrokeToast = true;
          CF.events.emit('toast', `ベルトには${cost}リル必要だよ`);
        }
        return;
      }
      const b = CF.World.place('belt', t.x, t.y, dir == null ? CF.ui.buildDir : dir);
      if (b) {
        this.spend(cost);
        this.addBuildingSprite(b);
        this.closeMenu();
        CF.Save.request();
      }
    }

    /** ドラッグ軌跡 from→to を1マスずつ辿って敷設 */
    paintPath(from, to) {
      let cx = from.x, cy = from.y;
      let guard = 64;
      while ((cx !== to.x || cy !== to.y) && guard-- > 0) {
        const sx = Math.sign(to.x - cx);
        const sy = Math.sign(to.y - cy);
        let nx = cx, ny = cy, dir;
        // X→Yの順で1マスずつ
        if (sx !== 0) { nx = cx + sx; dir = sx > 0 ? 0 : 2; }
        else { ny = cy + sy; dir = sy > 0 ? 1 : 3; }
        this.paintBelt({ x: cx, y: cy }, dir); // 通過元の向きを進行方向へ
        this.paintBelt({ x: nx, y: ny }, dir); // 進んだ先に敷設
        cx = nx; cy = ny;
      }
    }

    flashInvalid(o, size) {
      const r = this.add.rectangle(
        o.x * T() + size * T() / 2, o.y * T() + size * T() / 2,
        size * T(), size * T(),
        CF.hex(CF.PALETTE.CHERRY), 0.35
      ).setDepth(D_FX);
      this.tweens.add({ targets: r, alpha: 0, duration: 350, onComplete: () => r.destroy() });
    }

    // ------------------------------------------------------------ 設備スプライト

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
      spr.setRotation(b.dir * Math.PI / 2); // ベース画像は東向き
      if (b.type === 'belt') spr.setDepth(D_BELT);
      else spr.setDepth(D_SORT + (b.y + b.size) * T() / 100000);
    }

    removeBuilding(b) {
      // 撤去は半額払い戻し。ただし最後の泉（全種類合計で1個）は全額（詰み対策）
      let rate = CF.REFUND_RATE;
      if (CF.BUILDINGS[b.type].kind === 'spawner') {
        const spawners = CF.World.room().buildings
          .filter((x) => CF.BUILDINGS[x.type].kind === 'spawner').length;
        if (spawners <= 1) rate = 1.0; // これが最後の収入源 → 全額返す
      }
      const refund = Math.floor(CF.BUILDINGS[b.type].cost * rate);
      const c = CF.World.centerPx(b);

      CF.Logistics.onBuildingRemoved(b);
      CF.World.remove(b);
      const spr = this.buildingSprites.get(b.id);
      if (spr) spr.destroy();
      this.buildingSprites.delete(b.id);

      if (refund > 0) {
        CF.state.money += refund;
        CF.events.emit('money');
        this.floatText(c.x, c.y, `+${refund}リル`, CF.PALETTE.MINT_3);
      }
      CF.Save.request();
    }

    /** 任意位置に浮かび上がるテキスト（払い戻し・売上表示の共通化） */
    floatText(x, y, msg, color) {
      const tx = this.add.text(x, y - 10, msg, {
        fontSize: '13px', fontStyle: 'bold',
        color, stroke: CF.PALETTE.MILK, strokeThickness: 3
      }).setOrigin(0.5).setDepth(D_FX);
      this.tweens.add({
        targets: tx, y: y - 36, alpha: 0, duration: 800,
        onComplete: () => tx.destroy()
      });
    }

    popSprite(spr) {
      if (!spr) return;
      const sx = spr.scaleX, sy = spr.scaleY;
      spr.setScale(sx * 0.5, sy * 0.5);
      this.tweens.add({ targets: spr, scaleX: sx, scaleY: sy, duration: 160, ease: 'Back.Out' });
    }

    // ------------------------------------------------------------ ミニメニュー（回転/撤去）

    openMenu(b) {
      this.closeMenu();
      const c = CF.World.centerPx(b);
      const def = CF.BUILDINGS[b.type];
      const switchable = def.recipes && def.recipes.length > 1;

      const cont = this.add.container(c.x, c.y - b.size * T() / 2 - 30).setDepth(D_MENU);
      const width = switchable ? 168 : 120;
      this.menuHalfW = width / 2;

      // 背景
      const bg = this.add.rectangle(0, 0, width, 44, CF.hex(CF.PALETTE.MILK), 0.96)
        .setStrokeStyle(2, CF.hex(CF.PALETTE.GOLD_2));
      // 見出し（設備名＋レシピ名）
      const title = switchable ? `${def.name}：${CF.recipeName(def, b.recipeIndex)}` : def.name;
      const label = this.add.text(0, -32, title, {
        fontSize: '12px', fontStyle: 'bold',
        color: CF.PALETTE.COCOA_SHADOW,
        backgroundColor: CF.PALETTE.MILK,
        padding: { x: 6, y: 2 }
      }).setOrigin(0.5);
      cont.add([bg, label]);

      // ボタン位置（レシピ切替の有無で2〜3個）
      const xs = switchable ? [-52, 0, 52] : [-28, 28];
      let i = 0;

      // 回転
      this._menuButton(cont, xs[i++], '⟳', CF.PALETTE.LAVENDER_1, CF.PALETTE.LAVENDER_3, () => {
        CF.World.rotate(b);
        this.updateBuildingSprite(b);
        CF.Save.request();
      });

      // レシピ切替（複数レシピを持つ機械のみ）
      if (switchable) {
        const recBg = this.add.rectangle(xs[i], 0, 40, 34, CF.hex(CF.PALETTE.MINT_1))
          .setStrokeStyle(2, CF.hex(CF.PALETTE.MINT_3)).setInteractive();
        const recIcon = this.add.image(xs[i], 0, CF.ITEMS[def.recipes[b.recipeIndex].out].tex)
          .setScale(1.2);
        recBg.on('pointerup', () => {
          b.recipeIndex = (b.recipeIndex + 1) % def.recipes.length;
          recIcon.setTexture(CF.ITEMS[def.recipes[b.recipeIndex].out].tex);
          label.setText(`${def.name}：${CF.recipeName(def, b.recipeIndex)}`);
          CF.events.emit('toast', `レシピ：${CF.recipeName(def, b.recipeIndex)}`);
          CF.Save.request();
        });
        cont.add([recBg, recIcon]);
        i++;
      }

      // 撤去
      this._menuButton(cont, xs[i++], '✕', CF.PALETTE.SUGAR_PINK, CF.PALETTE.CHERRY, () => {
        this.removeBuilding(b);
        this.closeMenu();
      });

      this.menu = { cont, building: b };
    }

    /** ミニメニューのアイコンボタンを1つ足すヘルパ */
    _menuButton(cont, x, glyph, fill, stroke, onTap) {
      const bg = this.add.rectangle(x, 0, 40, 34, CF.hex(fill))
        .setStrokeStyle(2, CF.hex(stroke)).setInteractive();
      const tx = this.add.text(x, 0, glyph, {
        fontSize: '19px', color: stroke, fontStyle: 'bold'
      }).setOrigin(0.5);
      bg.on('pointerup', onTap);
      cont.add([bg, tx]);
    }

    closeMenu() {
      if (this.menu) {
        this.menu.cont.destroy();
        this.menu = null;
      }
    }

    /** 画面座標pがメニュー矩形内か（タップの取り合い防止） */
    menuContains(p) {
      if (!this.menu) return false;
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      const m = this.menu.cont;
      return Math.abs(w.x - m.x) < (this.menuHalfW || 64) + 4 && Math.abs(w.y - m.y) < 40;
    }

    // ------------------------------------------------------------ アイテム描画

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

    onSell(e) {
      this.sparkles.explode(8, e.x, e.y);
      this.floatText(e.x, e.y, `+${e.price}リル`, CF.PALETTE.GOLD_2);
    }

    onMachineOut(b) {
      const c = CF.World.centerPx(b);
      this.sparkles.explode(4, c.x, c.y - b.size * T() / 2);
    }

    // ------------------------------------------------------------ 毎フレーム

    update(time, delta) {
      const dt = Math.min(delta / 1000, 0.1); // タブ復帰時の暴走防止

      CF.Logistics.update(dt);

      // アイテムスプライト位置同期
      for (const item of CF.Logistics.items) {
        const spr = this.itemSprites.get(item.id);
        if (spr) { spr.x = item.x; spr.y = item.y; }
      }

      this.updatePrincess(dt);
      this.updateChimneys(dt);
    }

    /** 姫の移動（仮想スティック・farm_game流） */
    updatePrincess(dt) {
      const joy = CF.input.joy;
      if (!joy.x && !joy.y) return;
      const speed = 100; // px/秒
      const room = CF.World.room();
      const pad = 8;

      let nx = this.princess.x + joy.x * speed * dt;
      let ny = this.princess.y + joy.y * speed * dt;
      nx = Phaser.Math.Clamp(nx, pad, room.w * T() - pad);
      ny = Phaser.Math.Clamp(ny, 14, room.h * T() - 2);

      // 機械（2×2）はすり抜け不可。ベルトの上は歩ける（軸ごとに判定してスライド）
      const blocked = (x, y) => {
        const b = CF.World.at(Math.floor(x / T()), Math.floor(y / T()));
        return !!b && b.size > 1;
      };
      if (!blocked(nx, this.princess.y)) this.princess.x = nx;
      if (!blocked(this.princess.x, ny)) this.princess.y = ny;

      this.princess.setFlipX(joy.x < 0);
      this.princess.setDepth(D_SORT + this.princess.y / 100000);
    }

    /** 加工中の研磨機の煙突からキラキラ粒子 */
    updateChimneys(dt) {
      this.chimneyTimer += dt;
      if (this.chimneyTimer < 0.25) return;
      this.chimneyTimer = 0;
      for (const b of CF.World.room().buildings) {
        const kind = CF.BUILDINGS[b.type].kind;
        if ((kind === 'processor' || kind === 'assembler') && b.processing) {
          const c = CF.World.centerPx(b);
          this.sparkles.explode(1, c.x + Phaser.Math.Between(-8, 8), c.y - 30);
        }
      }
    }
  };
})();
