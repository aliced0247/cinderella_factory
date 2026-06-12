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
  },

  // --- 家具（Phase 3）：機能はあるが生産ラインには関与しない ---
  closet: {
    name: 'クローゼット', kind: 'furniture', size: 2, tex: 'building_closet',
    cost: 30
  }
};

/** 建設パレットの並び順（横スクロール対応） */
CF.BUILD_ORDER = [
  'spawner', 'spawner_silk', 'spawner_flower',
  'belt', 'polisher', 'sewing', 'atelier', 'delivery', 'closet'
];

// ============================================================ Phase 3：部屋・増築
CF.ROOM_W = 20;          // 1部屋の幅（マス）
CF.ROOM_H = 15;          // 1部屋の高さ（マス）
CF.EXPAND_COST = 800;    // 増築価格（リル）
CF.MAX_ROOMS = 2;        // Phase 3は2部屋まで（3部屋目以降はPhase 4）
CF.DOOR_Y = 6;           // 扉の開始マス（y）
CF.DOOR_H = 3;           // 扉の高さ（マス）。y=6,7,8 が通行可

// ============================================================ Phase 3：着せ替え
/** 装備スロット対応（高級品 → 部位） */
CF.EQUIP_SLOT = { dress: 'body', tiara: 'head', bouquet: 'hand' };
/** 装備効果（参考値。実処理は各所に埋め込み） */
CF.EQUIP_FX = {
  tiara:   { sellMul: 1.05 },  // 納品売上 +5%
  bouquet: { speedMul: 1.1 },  // 歩行速度 +10%
  dress:   { tint: true }      // 見た目変化（色相フィルタ仮実装）
};

/** 収蔵できる（＝高級品）か */
CF.isStorable = function (type) {
  return CF.ITEMS[type] && CF.ITEMS[type].tier === 'lux';
};

/** 姫スプライトの表示高さ（px）。機械(2×2=64px)と並んで自然な高さ。
 *  素材の実寸に依らずこの高さに合わせて等倍スケールする（差し替えに強い） */
CF.PRINCESS_DISPLAY_H = 60;


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
