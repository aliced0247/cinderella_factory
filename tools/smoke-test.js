/**
 * シンデレラ・ファクトリー スモークテスト
 * 実ブラウザでゲームを起動し、生産ライン一式を配置して
 * 「湧く→流れる→加工→納品→お金」のループが回るか自動検証する。
 *
 * 使い方：
 *   1) リポジトリ直下でローカルサーバー起動： npx http-server -p 8080 -s
 *   2) node tools/smoke-test.js
 *      （playwrightがグローバルの場合： NODE_PATH=$(npm root -g) node tools/smoke-test.js）
 *      （ブラウザの場所指定： PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers）
 * スクショは /tmp/shot_portrait.png ・ /tmp/shot_landscape.png に出力。
 */
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  const root = require('child_process').execSync('npm root -g').toString().trim();
  ({ chromium } = require(root + '/playwright'));
}

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--use-gl=swiftshader']
  });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://127.0.0.1:8080/index.html');
  await page.waitForFunction(() => window.CF && CF.game && CF.game.scene.isActive('Game'), null, { timeout: 15000 });
  // テストは常にまっさらな状態から
  await page.evaluate(() => localStorage.removeItem(CF.Save.KEY));
  await page.reload();
  await page.waitForFunction(() => window.CF && CF.game && CF.game.scene.isActive('Game'), null, { timeout: 15000 });
  console.log('✓ ゲーム起動（Gameシーン稼働）');

  // 生産ラインを配置（泉→ベルト→研磨機→ベルト→納品箱）
  const placed = await page.evaluate(() => {
    const gs = CF.game.scene.getScene('Game');
    const add = (t, x, y, d) => {
      const b = CF.World.place(t, x, y, d);
      if (b) gs.addBuildingSprite(b);
      return !!b;
    };
    const r = [];
    r.push(add('spawner', 2, 4, 0));
    r.push(add('belt', 4, 4, 0));
    r.push(add('belt', 5, 4, 0));
    r.push(add('belt', 6, 4, 0));
    r.push(add('polisher', 7, 3, 0));
    r.push(add('belt', 9, 3, 0));
    r.push(add('belt', 10, 3, 0));
    r.push(add('belt', 11, 3, 0));
    r.push(add('delivery', 12, 2, 0));
    // 原石直納ライン（泉2つ目・曲がりベルトも検証）
    r.push(add('spawner', 2, 8, 0));
    r.push(add('belt', 4, 8, 0));
    r.push(add('belt', 5, 8, 1));  // 南へ曲がる
    r.push(add('belt', 5, 9, 1));
    r.push(add('belt', 5, 10, 0)); // 東へ曲がる
    r.push(add('belt', 6, 10, 0));
    r.push(add('delivery', 7, 9, 0));
    // 上限テスト：3つ目の泉は置けないはず
    r.push(!CF.World.canPlace('spawner', 14, 10));
    CF.Save.request();
    return r;
  });
  if (placed.every(Boolean)) console.log('✓ ライン配置OK（泉上限2も確認）');
  else { console.log('✗ 配置失敗:', placed); process.exitCode = 1; }

  // 生産ループが回ってお金が増えるのを待つ（研磨宝石5リル以上）
  await page.waitForFunction(() => CF.state.money >= 5, null, { timeout: 30000 });
  const state = await page.evaluate(() => ({
    money: CF.state.money,
    items: CF.Logistics.items.length
  }));
  console.log(`✓ 生産ループ稼働：所持 ${state.money} リル / 稼働アイテム ${state.items} 個`);

  await page.waitForTimeout(3000);
  const money2 = await page.evaluate(() => CF.state.money);
  if (money2 > state.money) console.log(`✓ 継続稼働：${money2} リル（+${money2 - state.money}）`);
  else { console.log('✗ お金が増えていない'); process.exitCode = 1; }

  // セーブ＆リロード復元
  await page.evaluate(() => CF.Save.save());
  await page.reload();
  await page.waitForFunction(() => window.CF && CF.game && CF.game.scene.isActive('Game'), null, { timeout: 15000 });
  const restored = await page.evaluate(() => ({
    money: CF.state.money,
    buildings: CF.World.room().buildings.length
  }));
  if (restored.buildings === 16 && restored.money >= money2) {
    console.log(`✓ セーブ復元OK：設備 ${restored.buildings} 件 / ${restored.money} リル`);
  } else {
    console.log('✗ セーブ復元NG:', restored); process.exitCode = 1;
  }

  // スクショ（縦持ち→横持ち）
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/shot_portrait.png' });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/shot_landscape.png' });
  console.log('✓ スクショ保存（/tmp/shot_portrait.png, /tmp/shot_landscape.png）');

  if (errors.length) { console.log('✗ コンソールエラー:', errors.slice(0, 5)); process.exitCode = 1; }
  else console.log('✓ コンソールエラーなし');

  await browser.close();
})().catch((e) => { console.error('✗ テスト失敗:', e.message); process.exit(1); });
