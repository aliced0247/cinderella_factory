/**
 * 設置可能オブジェクト定義（Phase 1は4種）
 *
 * size     … 一辺のマス数（正方形フットプリント）
 * tex      … テクスチャキー（config/assets.js のキーに対応）
 * dir      … 向きの規約：0=東(+X) / 1=南(+Y) / 2=西(-X) / 3=北(-Y)
 *            ベース画像は「東向き」で作り、スプライト回転で表現する
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
  spawner: {
    name: '魔法の泉',
    size: 2,
    tex: 'building_spawner',
    limit: 2,          // 設置数上限
    interval: 3.0,     // 排出間隔（秒）
    out: 'gem_ore'     // 排出アイテム
  },
  belt: {
    name: 'ベルト',
    size: 1,
    tex: 'belt',
    speed: 1.8         // 搬送速度（マス/秒）
  },
  polisher: {
    name: '研磨機',
    size: 2,
    tex: 'building_polisher',
    recipe: { in: 'gem_ore', out: 'gem_polished', time: 3.0 } // 加工時間（秒）
  },
  delivery: {
    name: '納品箱',
    size: 2,
    tex: 'building_delivery'
  }
};

/** 建設パレットの並び順 */
CF.BUILD_ORDER = ['spawner', 'belt', 'polisher', 'delivery'];

/** 同時稼働アイテム数の上限（パフォーマンス設計：数百個規模） */
CF.ITEM_CAP = 300;
