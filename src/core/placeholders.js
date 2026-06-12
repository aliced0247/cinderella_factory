/**
 * プレースホルダー素材の自動生成（Phase 1）
 * パレット色の図形＋記号で描く。ドット素材完成後は config/assets.js の
 * file にパスを書けばこのファイルは一切使われなくなる。
 *
 * モック画像1号の方向性：
 *   機械＝ミント/ラベンダーの2系統＋金のオルゴール歯車＋リボン
 *   ベルト＝ピンク基調のリボンレーン
 *   煙突からはキラキラ粒子
 */
window.CF = window.CF || {};

(function () {
  const P = CF.PALETTE;
  const h = CF.hex;

  /** Graphics → テクスチャ化のヘルパ */
  function makeTex(scene, key, w, hgt, draw) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    draw(g, w, hgt);
    g.generateTexture(key, w, hgt);
    g.destroy();
  }

  /** 金のオルゴール歯車（共通パーツ） */
  function drawGear(g, cx, cy, r) {
    g.fillStyle(h(P.GOLD_2), 1);
    // 歯
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillRect(cx + Math.cos(a) * r - 2.5, cy + Math.sin(a) * r - 2.5, 5, 5);
    }
    g.fillCircle(cx, cy, r);
    g.fillStyle(h(P.GOLD_3), 1);
    g.fillCircle(cx, cy, r * 0.55);
    g.fillStyle(h(P.GOLD_1), 1);
    g.fillCircle(cx, cy, r * 0.28);
  }

  /** リボン（共通パーツ） */
  function drawRibbon(g, cx, cy, s, color) {
    g.fillStyle(color, 1);
    g.fillTriangle(cx - s, cy - s * 0.6, cx - s, cy + s * 0.6, cx, cy);
    g.fillTriangle(cx + s, cy - s * 0.6, cx + s, cy + s * 0.6, cx, cy);
    g.fillStyle(h(P.GOLD_2), 1);
    g.fillCircle(cx, cy, s * 0.32);
  }

  /** 花（共通パーツ：5枚花弁＋芯） */
  function drawFlower(g, cx, cy, r, petal, core) {
    g.fillStyle(petal, 1);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      g.fillCircle(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, r * 0.5);
    }
    g.fillStyle(core, 1);
    g.fillCircle(cx, cy, r * 0.42);
  }

  /**
   * 泉（原料スポナー）の共通ボディ。出力口＝東（金の矢印）
   * opts: { body, edge, basin, drawContent(g,cx,cy) }
   */
  function drawSpawnerBody(g, w, hgt, opts) {
    g.fillStyle(h(opts.body), 1);
    g.fillRoundedRect(2, 2, w - 4, hgt - 4, 8);
    g.lineStyle(2, h(opts.edge), 1);
    g.strokeRoundedRect(2, 2, w - 4, hgt - 4, 8);
    // 泉（水面/受け皿）
    g.fillStyle(h(opts.basin), 1);
    g.fillCircle(w / 2 - 6, hgt / 2, 14);
    g.lineStyle(2, h(opts.edge), 0.8);
    g.strokeCircle(w / 2 - 6, hgt / 2, 14);
    // 中身（湧くもの）
    opts.drawContent(g, w / 2 - 6, hgt / 2);
    // 金歯車（右下）
    drawGear(g, w - 14, hgt - 14, 7);
    // リボン（上）
    drawRibbon(g, w / 2, 9, 6, h(P.PINK_2));
    // 出力口（東＝右）：金の矢印
    g.fillStyle(h(P.GOLD_2), 1);
    g.fillTriangle(w - 9, hgt / 2 - 7, w - 9, hgt / 2 + 7, w - 1, hgt / 2);
  }

  CF.PLACEHOLDERS = {
    /** 床A：クリーム */
    floor_a(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        g.fillStyle(h(P.CREAM), 1);
        g.fillRect(0, 0, w, hgt);
        g.lineStyle(1, h(P.MILK_TEA), 0.35);
        g.strokeRect(0.5, 0.5, w - 1, hgt - 1);
      });
    },

    /** 床B：シュガーピンク */
    floor_b(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        g.fillStyle(h(P.SUGAR_PINK), 1);
        g.fillRect(0, 0, w, hgt);
        g.lineStyle(1, h(P.PINK_1), 0.5);
        g.strokeRect(0.5, 0.5, w - 1, hgt - 1);
      });
    },

    /** ベルトコンベア（東向き）：ピンクのリボンレーン＋進行方向シェブロン */
    belt(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        // レーン基調
        g.fillStyle(h(P.PINK_1), 1);
        g.fillRect(0, 2, w, hgt - 4);
        // 縁
        g.fillStyle(h(P.PINK_2), 1);
        g.fillRect(0, 2, w, 3);
        g.fillRect(0, hgt - 5, w, 3);
        // 進行方向シェブロン（→）
        g.fillStyle(h(P.PINK_3), 0.9);
        for (const cx of [8, 20]) {
          g.fillTriangle(cx, 9, cx, hgt - 9, cx + 7, hgt / 2);
        }
        // 金の鋲（オルゴール機構風）
        g.fillStyle(h(P.GOLD_2), 1);
        g.fillCircle(3, 3.5, 1.5);
        g.fillCircle(w - 3, 3.5, 1.5);
        g.fillCircle(3, hgt - 3.5, 1.5);
        g.fillCircle(w - 3, hgt - 3.5, 1.5);
      });
    },

    /** 魔法の泉（2×2・ミント系）：原料が湧く泉＋金歯車。出力口=東 */
    spawner(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        // 本体
        g.fillStyle(h(P.MINT_2), 1);
        g.fillRoundedRect(2, 2, w - 4, hgt - 4, 8);
        g.lineStyle(2, h(P.MINT_3), 1);
        g.strokeRoundedRect(2, 2, w - 4, hgt - 4, 8);
        // 泉（水面）
        g.fillStyle(h(P.MINT_1), 1);
        g.fillCircle(w / 2 - 6, hgt / 2, 14);
        g.lineStyle(2, h(P.MINT_3), 0.8);
        g.strokeCircle(w / 2 - 6, hgt / 2, 14);
        // 湧いた原石のしるし
        g.fillStyle(h(P.LAVENDER_2), 1);
        g.fillTriangle(w / 2 - 6, hgt / 2 - 7, w / 2 - 12, hgt / 2 + 3, w / 2, hgt / 2 + 3);
        // 金歯車（右下）
        drawGear(g, w - 14, hgt - 14, 7);
        // リボン（上）
        drawRibbon(g, w / 2, 9, 6, h(P.PINK_2));
        // 出力口（東＝右）：金の矢印
        g.fillStyle(h(P.GOLD_2), 1);
        g.fillTriangle(w - 9, hgt / 2 - 7, w - 9, hgt / 2 + 7, w - 1, hgt / 2);
      });
    },

    /** 研磨機（2×2・ラベンダー系）：入力口=西（ピンク）／出力口=東（金矢印） */
    polisher(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        // 本体
        g.fillStyle(h(P.LAVENDER_2), 1);
        g.fillRoundedRect(2, 2, w - 4, hgt - 4, 8);
        g.lineStyle(2, h(P.LAVENDER_3), 1);
        g.strokeRoundedRect(2, 2, w - 4, hgt - 4, 8);
        // 窓（加工室）
        g.fillStyle(h(P.LAVENDER_1), 1);
        g.fillRoundedRect(w / 2 - 11, hgt / 2 - 9, 22, 18, 5);
        // 金歯車（中央上）
        drawGear(g, w / 2, 13, 7);
        // リボン（下）
        drawRibbon(g, w / 2, hgt - 10, 6, h(P.PINK_2));
        // 入力口（西＝左）：ピンクの受け口
        g.fillStyle(h(P.PINK_2), 1);
        g.fillRect(0, hgt / 2 - 8, 6, 16);
        g.fillStyle(h(P.PINK_3), 1);
        g.fillTriangle(1, hgt / 2 - 5, 1, hgt / 2 + 5, 7, hgt / 2);
        // 出力口（東＝右）：金の矢印
        g.fillStyle(h(P.GOLD_2), 1);
        g.fillTriangle(w - 9, hgt / 2 - 7, w - 9, hgt / 2 + 7, w - 1, hgt / 2);
      });
    },

    /** 納品箱（2×2・金縁）：入れたら売上に */
    delivery(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        // 本体（クリーム×金縁の宝箱風）
        g.fillStyle(h(P.CREAM), 1);
        g.fillRoundedRect(3, 3, w - 6, hgt - 6, 7);
        g.lineStyle(3, h(P.GOLD_2), 1);
        g.strokeRoundedRect(3, 3, w - 6, hgt - 6, 7);
        // フタの線
        g.lineStyle(2, h(P.GOLD_3), 1);
        g.lineBetween(4, hgt / 2 - 4, w - 4, hgt / 2 - 4);
        // 投入口
        g.fillStyle(h(P.COCOA_SHADOW), 0.85);
        g.fillRoundedRect(w / 2 - 12, 12, 24, 7, 3);
        // ハート錠前（重要UI＝アクセント色を限定使用）
        const cx = w / 2, cy = hgt / 2 + 9;
        g.fillStyle(h(P.JEWEL_PINK), 1);
        g.fillCircle(cx - 4, cy - 2, 5);
        g.fillCircle(cx + 4, cy - 2, 5);
        g.fillTriangle(cx - 8.5, cy, cx + 8.5, cy, cx, cy + 10);
        // 金の鋲
        g.fillStyle(h(P.GOLD_1), 1);
        g.fillCircle(8, 8, 2);
        g.fillCircle(w - 8, 8, 2);
        g.fillCircle(8, hgt - 8, 2);
        g.fillCircle(w - 8, hgt - 8, 2);
      });
    },

    /** 宝石原石：岩＋うっすら覗くピンクの結晶 */
    gem_ore(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        g.fillStyle(h(P.COCOA_SHADOW), 1);
        g.fillCircle(w / 2, hgt / 2 + 1, 6);
        g.fillStyle(h(P.BISCUIT), 1);
        g.fillCircle(w / 2 - 2, hgt / 2 - 1, 4);
        g.fillStyle(h(P.PINK_2), 1);
        g.fillTriangle(w / 2 + 1, hgt / 2 - 5, w / 2 - 2, hgt / 2 + 1, w / 2 + 4, hgt / 2 + 1);
      });
    },

    /** 研磨宝石：ジュエルピンクのダイヤ（アクセント色＝レア物限定の使い方） */
    gem_polished(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        const cx = w / 2, cy = hgt / 2;
        g.fillStyle(h(P.JEWEL_PINK), 1);
        // ダイヤ形
        g.fillTriangle(cx - 6, cy - 2, cx + 6, cy - 2, cx, cy + 7);
        g.fillTriangle(cx - 6, cy - 2, cx + 6, cy - 2, cx, cy - 7);
        // 照り
        g.fillStyle(h(P.PINK_1), 1);
        g.fillTriangle(cx - 3, cy - 4, cx, cy - 6, cx + 1, cy - 3);
      });
    },

    /** 姫（32×48）：仮ドット人形 */
    princess(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        const cx = w / 2;
        // ドレス（Aライン）
        g.fillStyle(h(P.PINK_2), 1);
        g.fillTriangle(cx - 11, hgt - 4, cx + 11, hgt - 4, cx, 18);
        g.fillStyle(h(P.PINK_1), 1);
        g.fillTriangle(cx - 7, hgt - 5, cx + 7, hgt - 5, cx, 26);
        // 裾の縁取り
        g.fillStyle(h(P.PINK_3), 1);
        g.fillRect(cx - 11, hgt - 6, 22, 2);
        // 顔
        g.fillStyle(h(P.MILK), 1);
        g.fillCircle(cx, 13, 7);
        // 髪（はちみつブロンド）
        g.fillStyle(h(P.LEMON_3), 1);
        g.fillCircle(cx, 9, 7);
        g.fillRect(cx - 7, 9, 3, 10);
        g.fillRect(cx + 4, 9, 3, 10);
        // 目
        g.fillStyle(h(P.COCOA_SHADOW), 1);
        g.fillRect(cx - 4, 13, 2, 2);
        g.fillRect(cx + 2, 13, 2, 2);
        // ティアラ
        g.fillStyle(h(P.GOLD_2), 1);
        g.fillTriangle(cx - 4, 4, cx + 4, 4, cx, 0);
        g.fillRect(cx - 5, 3, 10, 2);
        // 胸元リボン
        drawRibbon(g, cx, 22, 4, h(P.JEWEL_PINK));
      });
    },

    // ============================================================ Phase 2

    /** 絹糸の泉（ミルクティー系）：糸巻きが湧く */
    spawner_silk(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        drawSpawnerBody(g, w, hgt, {
          body: P.MILK_TEA, edge: P.BISCUIT, basin: P.CREAM,
          drawContent: (gg, cx, cy) => {
            // 糸巻き
            gg.fillStyle(h(P.BISCUIT), 1);
            gg.fillRoundedRect(cx - 7, cy - 4, 14, 8, 2);
            gg.fillStyle(h(P.MILK), 1);
            for (let i = -5; i <= 5; i += 2) gg.fillRect(cx + i, cy - 4, 1, 8);
            gg.fillStyle(h(P.COCOA_SHADOW), 1);
            gg.fillRect(cx - 8, cy - 5, 2, 10);
            gg.fillRect(cx + 6, cy - 5, 2, 10);
          }
        });
      });
    },

    /** 花の泉（ピンク系）：コーラルの花が湧く */
    spawner_flower(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        drawSpawnerBody(g, w, hgt, {
          body: P.PINK_1, edge: P.PINK_3, basin: P.SUGAR_PINK,
          drawContent: (gg, cx, cy) => {
            drawFlower(gg, cx, cy, 9, h(P.CLEAR_CORAL), h(P.LEMON_2));
          }
        });
      });
    },

    /** ミシン（2×2・裁縫＝ピンク系）：入力口=西／出力口=東 */
    sewing(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        g.fillStyle(h(P.PINK_1), 1);
        g.fillRoundedRect(2, 2, w - 4, hgt - 4, 8);
        g.lineStyle(2, h(P.PINK_3), 1);
        g.strokeRoundedRect(2, 2, w - 4, hgt - 4, 8);
        // ミシンのアーム（金）＋針
        g.fillStyle(h(P.GOLD_2), 1);
        g.fillRoundedRect(w / 2 - 14, 12, 28, 7, 3);
        g.fillRect(w / 2 + 9, 18, 3, 12);
        g.fillStyle(h(P.GOLD_3), 1);
        g.fillRect(w / 2 + 10, 28, 1, 5); // 針
        // 布（ミント差し色）
        g.fillStyle(h(P.MINT_1), 1);
        g.fillRoundedRect(w / 2 - 13, hgt - 22, 26, 12, 3);
        // 歯車
        drawGear(g, w / 2 - 12, 14, 5);
        // 入力口（西＝左）：ピンクの受け口
        g.fillStyle(h(P.PINK_2), 1);
        g.fillRect(0, hgt / 2 - 8, 6, 16);
        g.fillStyle(h(P.PINK_3), 1);
        g.fillTriangle(1, hgt / 2 - 5, 1, hgt / 2 + 5, 7, hgt / 2);
        // 出力口（東＝右）：金の矢印
        g.fillStyle(h(P.GOLD_2), 1);
        g.fillTriangle(w - 9, hgt / 2 - 7, w - 9, hgt / 2 + 7, w - 1, hgt / 2);
      });
    },

    /** 工房台（2×2・ラベンダー×金の豪華な合成台）：入力口=西／出力口=東 */
    atelier(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        // 本体（ラベンダー＋金の厚縁）
        g.fillStyle(h(P.LAVENDER_2), 1);
        g.fillRoundedRect(2, 2, w - 4, hgt - 4, 9);
        g.lineStyle(3, h(P.GOLD_2), 1);
        g.strokeRoundedRect(2, 2, w - 4, hgt - 4, 9);
        // 作業天板（クリーム）
        g.fillStyle(h(P.CREAM), 1);
        g.fillRoundedRect(w / 2 - 15, hgt / 2 - 11, 30, 22, 5);
        g.lineStyle(1, h(P.GOLD_3), 0.8);
        g.strokeRoundedRect(w / 2 - 15, hgt / 2 - 11, 30, 22, 5);
        // 道具（金の針＋宝石）の意匠
        g.fillStyle(h(P.GOLD_2), 1);
        g.fillRect(w / 2 - 9, hgt / 2 - 6, 2, 14);
        g.fillStyle(h(P.JEWEL_PINK), 1);
        g.fillTriangle(w / 2 + 6, hgt / 2 - 2, w / 2 + 12, hgt / 2 - 2, w / 2 + 9, hgt / 2 + 5);
        g.fillTriangle(w / 2 + 6, hgt / 2 - 2, w / 2 + 12, hgt / 2 - 2, w / 2 + 9, hgt / 2 - 8);
        // 歯車（四隅の金）
        drawGear(g, 12, 12, 5);
        drawGear(g, w - 12, 12, 5);
        // 入力口（西＝左）
        g.fillStyle(h(P.LAVENDER_3), 1);
        g.fillRect(0, hgt / 2 - 8, 6, 16);
        g.fillStyle(h(P.LAVENDER_1), 1);
        g.fillTriangle(1, hgt / 2 - 5, 1, hgt / 2 + 5, 7, hgt / 2);
        // 出力口（東＝右）：金の矢印
        g.fillStyle(h(P.GOLD_2), 1);
        g.fillTriangle(w - 9, hgt / 2 - 7, w - 9, hgt / 2 + 7, w - 1, hgt / 2);
      });
    },

    // --- 新アイテム ---

    /** 絹糸：ミルクティーの糸巻き */
    silk(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        const cx = w / 2, cy = hgt / 2;
        g.fillStyle(h(P.MILK_TEA), 1);
        g.fillRoundedRect(cx - 5, cy - 4, 10, 8, 2);
        g.fillStyle(h(P.MILK), 1);
        for (let i = -3; i <= 3; i += 2) g.fillRect(cx + i, cy - 4, 1, 8);
        g.fillStyle(h(P.BISCUIT), 1);
        g.fillRect(cx - 6, cy - 5, 1.5, 10);
        g.fillRect(cx + 5, cy - 5, 1.5, 10);
      });
    },

    /** 花：コーラルの5枚花 */
    flower(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        drawFlower(g, w / 2, hgt / 2, 7, h(P.CLEAR_CORAL), h(P.LEMON_2));
      });
    },

    /** リボン：ピンク中間調の蝶形 */
    ribbon(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        drawRibbon(g, w / 2, hgt / 2, 6, h(P.PINK_2));
      });
    },

    /** レース：ミルク色の丸ドイリー（スカラップ縁＋ラベンダー点） */
    lace(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        const cx = w / 2, cy = hgt / 2;
        g.fillStyle(h(P.LAVENDER_1), 1);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          g.fillCircle(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 2.2);
        }
        g.fillStyle(h(P.MILK), 1);
        g.fillCircle(cx, cy, 5);
        g.lineStyle(1, h(P.LAVENDER_2), 1);
        g.strokeCircle(cx, cy, 5);
      });
    },

    /** ブーケ：コーラル＋ピンクの花束 */
    bouquet(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        const cx = w / 2, cy = hgt / 2;
        // 茎
        g.fillStyle(h(P.MINT_3), 1);
        g.fillRect(cx - 1, cy, 2, 7);
        // 花
        drawFlower(g, cx - 3, cy - 2, 4.5, h(P.CLEAR_CORAL), h(P.LEMON_2));
        drawFlower(g, cx + 3, cy - 1, 4.5, h(P.PINK_2), h(P.LEMON_1));
        drawFlower(g, cx, cy - 5, 4.5, h(P.JEWEL_PINK), h(P.LEMON_2));
        // 結びリボン
        drawRibbon(g, cx, cy + 5, 3, h(P.GOLD_2));
      });
    },

    /** ティアラ：金のティアラ＋宝石 */
    tiara(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        const cx = w / 2, cy = hgt / 2 + 2;
        g.fillStyle(h(P.GOLD_2), 1);
        // 台座の弧
        g.fillRect(cx - 7, cy, 14, 2);
        // 山（3つ）
        g.fillTriangle(cx - 7, cy, cx - 3, cy, cx - 5, cy - 6);
        g.fillTriangle(cx + 3, cy, cx + 7, cy, cx + 5, cy - 6);
        g.fillTriangle(cx - 3, cy, cx + 3, cy, cx, cy - 9);
        // 中央宝石
        g.fillStyle(h(P.JEWEL_PINK), 1);
        g.fillCircle(cx, cy - 9, 2);
        g.fillStyle(h(P.CLEAR_TURQUOISE), 1);
        g.fillCircle(cx - 5, cy - 6, 1.4);
        g.fillCircle(cx + 5, cy - 6, 1.4);
      });
    },

    /** ドレス：ピンクのドレス（高級品） */
    dress(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        const cx = w / 2, cy = hgt / 2;
        // スカート（Aライン）
        g.fillStyle(h(P.PINK_2), 1);
        g.fillTriangle(cx - 6, cy + 6, cx + 6, cy + 6, cx, cy - 3);
        // 胴
        g.fillStyle(h(P.PINK_3), 1);
        g.fillTriangle(cx - 3, cy - 1, cx + 3, cy - 1, cx, cy - 6);
        // 裾レース
        g.fillStyle(h(P.MILK), 1);
        g.fillRect(cx - 6, cy + 5, 12, 1.5);
        // 金の帯
        g.fillStyle(h(P.GOLD_2), 1);
        g.fillRect(cx - 3, cy - 1, 6, 1.5);
      });
    },

    // ============================================================ Phase 3

    /** クローゼット（2×2・ミルクティーの戸棚＋金の取っ手＋ハート） */
    closet(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        // 戸棚本体
        g.fillStyle(h(P.MILK_TEA), 1);
        g.fillRoundedRect(4, 3, w - 8, hgt - 6, 6);
        g.lineStyle(3, h(P.BISCUIT), 1);
        g.strokeRoundedRect(4, 3, w - 8, hgt - 6, 6);
        // 観音扉の合わせ目
        g.lineStyle(2, h(P.COCOA_SHADOW), 0.8);
        g.lineBetween(w / 2, 6, w / 2, hgt - 6);
        // 扉パネル（クリーム）
        g.fillStyle(h(P.CREAM), 1);
        g.fillRoundedRect(8, 8, w / 2 - 12, hgt - 16, 3);
        g.fillRoundedRect(w / 2 + 4, 8, w / 2 - 12, hgt - 16, 3);
        // ハートの飾り
        const heart = (cx, cy, s, col) => {
          g.fillStyle(h(col), 1);
          g.fillCircle(cx - s * 0.5, cy - s * 0.3, s * 0.55);
          g.fillCircle(cx + s * 0.5, cy - s * 0.3, s * 0.55);
          g.fillTriangle(cx - s, cy, cx + s, cy, cx, cy + s);
        };
        heart(w / 2 - 8, hgt / 2 - 4, 5, P.PINK_2);
        heart(w / 2 + 8, hgt / 2 - 4, 5, P.PINK_2);
        // 金の取っ手
        g.fillStyle(h(P.GOLD_2), 1);
        g.fillCircle(w / 2 - 4, hgt / 2 + 8, 2);
        g.fillCircle(w / 2 + 4, hgt / 2 + 8, 2);
        // 天板のリボン
        drawRibbon(g, w / 2, 6, 6, h(P.JEWEL_PINK));
      });
    },

    /** キラキラ粒子（4方向の星） */
    sparkle(scene, key, w, hgt) {
      makeTex(scene, key, w, hgt, (g) => {
        const cx = w / 2, cy = hgt / 2;
        g.fillStyle(h(P.LEMON_1), 1);
        g.fillTriangle(cx, 0, cx - 1.5, cy, cx + 1.5, cy);
        g.fillTriangle(cx, hgt, cx - 1.5, cy, cx + 1.5, cy);
        g.fillTriangle(0, cy, cx, cy - 1.5, cx, cy + 1.5);
        g.fillTriangle(w, cy, cx, cy - 1.5, cx, cy + 1.5);
        g.fillStyle(h(P.MILK), 1);
        g.fillCircle(cx, cy, 1.5);
      });
    }
  };
})();
