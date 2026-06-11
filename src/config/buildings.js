/**
 * 設置可能オブジェクト定義
 *
 * kind     … 動作カテゴリ。'spawner' / 'belt' / 'processor'（1入力加工）/
 *            'assembler'（複数入力合成）/ 'delivery'
 * size     … 一辺のマス数（正方形フットプリント）
 * tex      … テクスチャキー（config/assets.js のキーに対応）
 * cost     … 設置コスト（リル）
 * dir      … 向きの規約：0=東(+X) / 1=南(+Y) / 2=西(-X) / 3=北(-Y)
 *            ベース画像は「東向き」で作り、スプライト回転で表現する
 *            入力口＝向きの反対側の面（back）／出力口＝向きの面（front）
 *
 * recipes  … processor / assembler のレシピ配列。recipes.length>1 なら
 *            タップメニューにレシピ切替を出す
 *   processor： { in: '素材', out: '完成', time: 秒 }
 *   assembler： { inputs: { 素材: 個数, ... }, out: '完成', time: 秒 }
 */
window.CF = window.CF || {};

/** 向き→ベクトル */
CF.DIRS = [
  { x: 1, y: 0 },  // 0: 東
  { x: 0, y: 1 },  // 1: 南
  { x: -1, y: 0 }, // 2: 西
  { x: 0, y: -1 }  // 3: 北
];

CF.TILE = 32; // 基本タイル 32×32px（確定・変更不可）

CF.BUILDINGS = {
  // --- 泉（原料スポナー）：種類ごとに上限2 ---
  spawner: {
    name: '魔法の泉', kind: 'spawner', size: 2, tex: 'building_spawner',
    cost: 50, limit: 2, interval: 3.0, out: 'gem_ore'
  },
  spawner_silk: {
    name: '絹糸の泉', kind: 'spawner', size: 2, tex: 'building_spawner_silk',
    cost: 50, limit: 2, interval: 3.0, out: 'silk'
  },
  spawner_flower: {
    name: '花の泉', kind: 'spawner', size: 2, tex: 'building_spawner_flower',
    cost: 50, limit: 2, interval: 3.0, out: 'flower'
  },

  // --- 搬送 ---
  belt: {
    name: 'ベルト', kind: 'belt', size: 1, tex: 'belt',
    cost: 2, speed: 1.8
  },

  // --- 加工機（1入力） ---
  polisher: {
    name: '研磨機', kind: 'processor', size: 2, tex: 'building_polisher',
    cost: 20,
    recipes: [{ in: 'gem_ore', out: 'gem_polished', time: 3.0 }]
  },
  sewing: {
    name: 'ミシン', kind: 'processor', size: 2, tex: 'building_sewing',
    cost: 25,
    recipes: [
      { in: 'silk', out: 'ribbon', time: 3.0 },  // デフォルト：リボン
      { in: 'silk', out: 'lace',   time: 3.0 }
    ]
  },

  // --- 合成台（複数入力・内部バッファ）Phase 2の目玉 ---
  atelier: {
    name: '工房台', kind: 'assembler', size: 2, tex: 'building_atelier',
    cost: 40, bufferCap: 3,
    recipes: [
      { inputs: { gem_polished: 2 },        out: 'tiara',   time: 5.0 },
      { inputs: { ribbon: 1, flower: 1 },   out: 'bouquet', time: 5.0 },
      { inputs: { lace: 1, ribbon: 1 },     out: 'dress',   time: 5.0 }
    ]
  },

  // --- 納品 ---
  delivery: {
    name: '納品箱', kind: 'delivery', size: 2, tex: 'building_delivery',
    cost: 10
  }
};

/** 建設パレットの並び順（横スクロール対応） */
CF.BUILD_ORDER = [
  'spawner', 'spawner_silk', 'spawner_flower',
  'belt', 'polisher', 'sewing', 'atelier', 'delivery'
];

/** 撤去時の払い戻し率（半額）。ただし最後の泉だけは全額（詰み対策） */
CF.REFUND_RATE = 0.5;

/** 初期所持リル（最初のライン1本がぎりぎり組める額） */
CF.START_MONEY = 100;

/** 同時稼働アイテム数の上限（パフォーマンス設計：数百個規模） */
CF.ITEM_CAP = 300;

/** あるレシピの表示名（出力物の名前で表す） */
CF.recipeName = function (def, index) {
  if (!def.recipes) return '';
  const r = def.recipes[index] || def.recipes[0];
  return CF.ITEMS[r.out].name;
};
