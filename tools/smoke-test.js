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

  // 初期所持リル（最初のライン1本がぎりぎり組める額）
  const startMoney = await page.evaluate(() => CF.state.money);
  if (startMoney === 100) console.log('✓ 初期所持リル 100');
  else { console.log('✗ 初期所持リルが100でない:', startMoney); process.exitCode = 1; }

  // 生産ライン1本を「コストを払って」配置（曲がりベルト2回を含む）
  const cost = await page.evaluate(() => {
    const gs = CF.game.scene.getScene('Game');
    // 設置：コスト判定→支払い→設備生成（ゲーム本体と同じ流れ）
    const buy = (t, x, y, d) => {
      const def = CF.BUILDINGS[t];
      if (CF.state.money < def.cost) return false;
      if (!CF.World.canPlace(t, x, y)) return false;
      const b = CF.World.place(t, x, y, d);
      gs.spend(def.cost);
      gs.addBuildingSprite(b);
      return true;
    };
    const r = [];
    r.push(buy('spawner', 2, 4, 0));
    r.push(buy('belt', 4, 4, 0));
    r.push(buy('belt', 5, 4, 1));  // 南へ曲がる
    r.push(buy('belt', 5, 5, 1));
    r.push(buy('belt', 5, 6, 0));  // 東へ曲がる
    r.push(buy('belt', 6, 6, 0));
    r.push(buy('polisher', 7, 5, 0));
    r.push(buy('belt', 9, 5, 0));
    r.push(buy('belt', 10, 5, 0));
    r.push(buy('delivery', 11, 4, 0));
    CF.Save.request();
    return { ok: r.every(Boolean), money: CF.state.money };
  });
  // 50 + 7×2 + 20 + 10 = 94 → 残り6リル
  if (cost.ok && cost.money === 6) console.log(`✓ コスト支払いOK（94リル消費 → 残り${cost.money}リル）`);
  else { console.log('✗ コスト計算が合わない:', cost); process.exitCode = 1; }

  // 残金6リルでは魔法の泉(50)も研磨機(20)も買えない
  const broke = await page.evaluate(() => ({
    spawner: CF.game.scene.getScene('UI').affordable('spawner'),
    belt: CF.game.scene.getScene('UI').affordable('belt')
  }));
  if (!broke.spawner && broke.belt) console.log('✓ リル不足ゲートOK（泉×／ベルト○）');
  else { console.log('✗ 不足ゲートNG:', broke); process.exitCode = 1; }

  // 上限テスト：泉は1つしか置いていないが、3つ目相当の判定（上限2）
  const limitOk = await page.evaluate(() => {
    CF.World.place('spawner', 2, 10, 0); // 2つ目（コスト無視・上限確認用）
    return !CF.World.canPlace('spawner', 14, 10); // 3つ目は不可
  });
  if (limitOk) console.log('✓ 泉の上限2を確認');
  else { console.log('✗ 上限チェックNG'); process.exitCode = 1; }

  // 撤去の半額払い戻し（泉50 → +25）
  const refund = await page.evaluate(() => {
    const gs = CF.game.scene.getScene('Game');
    const before = CF.state.money;
    const sp = CF.World.room().buildings.find(b => b.type === 'spawner' && b.x === 2 && b.y === 10);
    gs.removeBuilding(sp);
    return CF.state.money - before;
  });
  if (refund === 25) console.log('✓ 撤去の半額払い戻しOK（泉50 → +25）');
  else { console.log('✗ 払い戻しNG:', refund); process.exitCode = 1; }

  // 生産ループが回ってお金が増えるのを待つ（研磨宝石5リル以上）
  const moneyNow = await page.evaluate(() => CF.state.money);
  await page.waitForFunction((m) => CF.state.money >= m + 5, moneyNow, { timeout: 30000 });
  const state = await page.evaluate(() => ({
    money: CF.state.money,
    items: CF.Logistics.items.length
  }));
  console.log(`✓ 生産ループ稼働：所持 ${state.money} リル / 稼働アイテム ${state.items} 個`);

  // 次の納品まで待つ（研磨1サイクル＝湧き3s＋搬送＋研磨3s＋搬送で十数秒かかる）
  await page.waitForFunction((m) => CF.state.money > m, state.money, { timeout: 20000 });
  const money2 = await page.evaluate(() => CF.state.money);
  console.log(`✓ 継続稼働：${money2} リル（+${money2 - state.money}）`);

  // セーブ＆リロード復元
  await page.evaluate(() => CF.Save.save());
  await page.reload();
  await page.waitForFunction(() => window.CF && CF.game && CF.game.scene.isActive('Game'), null, { timeout: 15000 });
  const restored = await page.evaluate(() => ({
    money: CF.state.money,
    buildings: CF.World.room().buildings.length
  }));
  if (restored.buildings === 10 && restored.money >= money2) {
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
