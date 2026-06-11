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
