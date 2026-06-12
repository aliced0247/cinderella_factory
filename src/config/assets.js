/**
 * アセット・マニフェスト（素材差し替えの一元管理ポイント）
 *
 * ★ここが「画像パスとロジックの分離」の要★
 *
 * 各エントリ：
 *   file … 画像ファイルのパス。null ならプレースホルダーを自動生成する
 *   gen  … プレースホルダー生成関数名（core/placeholders.js のキー）
 *   w,h  … 期待サイズ（px）。差し替え画像もこのサイズで作ること
 *
 * 【ドット素材が完成したら】
 *   file に 'assets/xxx.png' を書くだけで差し替え完了。コード変更は不要。
 *   例： building_spawner: { file: 'assets/spawner.png', gen: 'spawner', w: 64, h: 64 },
 *
 * 【向きの規約】
 *   向きを持つもの（ベルト・機械）は「東向き（→ +X）」で描く。回転はコード側で行う。
 */
window.CF = window.CF || {};

CF.ASSETS = {
  // --- 床（32×32） ---
  floor_a:                 { file: null, gen: 'floor_a',        w: 32, h: 32 },  // クリーム
  floor_b:                 { file: null, gen: 'floor_b',        w: 32, h: 32 },  // シュガーピンク

  // --- 搬送 ---
  belt:                    { file: null, gen: 'belt',           w: 32, h: 32 },  // 東向き

  // --- 泉（2×2） ---
  building_spawner:        { file: null, gen: 'spawner',        w: 64, h: 64 },  // 魔法の泉（宝石）
  building_spawner_silk:   { file: null, gen: 'spawner_silk',   w: 64, h: 64 },  // 絹糸の泉
  building_spawner_flower: { file: null, gen: 'spawner_flower', w: 64, h: 64 },  // 花の泉

  // --- 機械（2×2） ---
  building_polisher:       { file: null, gen: 'polisher',       w: 64, h: 64 },  // 研磨機
  building_sewing:         { file: null, gen: 'sewing',         w: 64, h: 64 },  // ミシン
  building_atelier:        { file: null, gen: 'atelier',        w: 64, h: 64 },  // 工房台

  // --- 納品（2×2） ---
  building_delivery:       { file: null, gen: 'delivery',       w: 64, h: 64 },  // 納品箱

  // --- 家具（2×2） ---
  building_closet:         { file: null, gen: 'closet',         w: 64, h: 64 },  // クローゼット

  // --- アイテム（16×16） ---
  item_gem_ore:            { file: null, gen: 'gem_ore',        w: 16, h: 16 },
  item_gem_polished:       { file: null, gen: 'gem_polished',   w: 16, h: 16 },
  item_silk:               { file: null, gen: 'silk',           w: 16, h: 16 },
  item_flower:             { file: null, gen: 'flower',         w: 16, h: 16 },
  item_ribbon:             { file: null, gen: 'ribbon',         w: 16, h: 16 },
  item_lace:               { file: null, gen: 'lace',           w: 16, h: 16 },
  item_bouquet:            { file: null, gen: 'bouquet',        w: 16, h: 16 },
  item_tiara:              { file: null, gen: 'tiara',          w: 16, h: 16 },
  item_dress:              { file: null, gen: 'dress',          w: 16, h: 16 },

  // --- キャラ ---
  princess:                { file: 'assets/princess.png', gen: 'princess', w: 59, h: 96 },  // 姫（差し替え済み 59×96）

  // --- エフェクト ---
  sparkle:                 { file: null, gen: 'sparkle',        w: 8,  h: 8 }    // キラキラ粒子
};
