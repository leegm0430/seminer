// BLOODFALL 자동 테스트
// - 테스트 이름 앞의 [BF-NN]은 tc/bloodfall_tc.json 의 번호다(기획서 v0.9 근거, AI 초안).
// - 슬라임 게임과 달리 이 게임은 상태(game, CONFIG)와 함수가 전역에 있어 내부 값(체력·레벨·타이머)을 직접 읽어 판정한다.
//   화면(카드·HUD·결과 창)도 함께 확인한다.
// - 상황을 빠르게 만들기 위해 몬스터·오브·박스를 테스트가 직접 배치한다. 게임 규칙 코드는 건드리지 않는다.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const TARGET = process.env.BLOODFALL_TARGET || path.resolve(__dirname, '..', '..', '뱀서라이크', 'bloodfall_playable.html');
const URL = pathToFileURL(TARGET).href;

const ev = (page, fn, arg) => page.evaluate(fn, arg);
const state = (page) => ev(page, () => game && game.state);

/** 모드를 고르고 주무기 카드를 클릭해 게임을 시작한다. 시작 직후 몬스터를 비우고 자동 스폰을 멈춰 조용한 상태로 만든다. */
async function start(page, mode = 'solo', weapons = ['피스톨']) {
  await page.goto(URL);
  await page.click(mode === 'solo' ? '#btnSolo' : '#btnCoop');
  for (let i = 0; i < weapons.length; i++) {
    await expect(page.locator('#choiceTitle')).toHaveText(`P${i + 1} 주무기 선택`);
    await page.locator('#choiceCards .card', { hasText: weapons[i] }).click();
  }
  await expect.poll(() => state(page)).toBe('playing');
  await quiet(page);
}

/** 자동 스폰을 멈추고 화면의 몬스터·투사체를 지운다. */
const quiet = (page) => ev(page, () => {
  game.spawnTimer = 1e9; game.monsters = []; game.enemyProjectiles = []; game.hazards = []; game.pendingHazards = [];
});

/** 다음 Math.random 값을 고정한다(아이템 박스 효과 등). restoreRandom으로 되돌린다. */
const fixRandom = (page, v) => ev(page, (v) => { window.__realRandom = window.__realRandom || Math.random; Math.random = () => v; }, v);
const restoreRandom = (page) => ev(page, () => { if (window.__realRandom) Math.random = window.__realRandom; });

const P = (page, i = 0) => ev(page, (i) => {
  const p = game.players[i];
  return { x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, level: p.level, exp: p.exp, expToNext: p.expToNext,
           downed: p.downed, choosing: p.choosing && { kind: p.choosing.kind, timer: p.choosing.timer },
           pending: p.pendingChoices.map(c => c.kind), main: p.mainWeapon, weapons: p.weapons.map(w => w.type),
           magnet: p.magnetTimer };
}, i);

/** 플레이어 위치(+dx)에 경험치 오브를 놓는다. */
const dropOrb = (page, exp, i = 0, dx = 0) => ev(page, ([exp, i, dx]) => {
  const p = game.players[i]; game.orbs.push({ x: p.x + dx, y: p.y, exp, r: 5 });
}, [exp, i, dx]);

// ---------------------------------------------------------------- 메뉴·드래프트

test('[BF-01] 모드 선택 메뉴에 1인·2인 협동·온라인 버튼 노출', async ({ page }) => {
  await page.goto(URL);
  for (const id of ['#btnSolo', '#btnCoop', '#btnHost', '#btnJoinShow']) await expect(page.locator(id)).toBeVisible();
});

test('[BF-02] 게임 시작 시 주무기 카드 3장 제시, 선택 전 타이머 정지', async ({ page }) => {
  await page.goto(URL);
  await page.click('#btnSolo');
  await expect(page.locator('#choiceTitle')).toHaveText('P1 주무기 선택');
  const titles = await page.locator('#choiceCards .card h3').allTextContents();
  expect(titles).toEqual(['피스톨', '샷건', '레이저']);
  await expect(page.locator('#stageLabel')).toHaveText('주무기를 선택하세요');
  await page.waitForTimeout(1500);
  expect(await ev(page, () => game.elapsed)).toBe(0);
});

test('[BF-03] 주무기 카드 선택 시 그 무기 1개만 장착되고 게임 시작', async ({ page }) => {
  await start(page, 'solo', ['샷건']);
  const p = await P(page);
  expect(p.main).toBe('shotgun');
  expect(p.weapons).toEqual(['shotgun']);
  await expect(page.locator('#choiceOverlay')).toBeHidden();
});

test('[BF-04] 주무기 드래프트 10초 미선택 시 피스톨 자동 배정', async ({ page }) => {
  await page.goto(URL);
  await fixRandom(page, 0.99);       // 무작위 선택이라면 3번째 카드(레이저)가 뽑히도록 고정해 결과를 매번 같게 만든다
  await page.click('#btnSolo');
  await expect.poll(() => state(page), { timeout: 13_000 }).toBe('playing');
  await restoreRandom(page);
  const p = await P(page);
  expect(p.main, '기획서 §31.1: 미선택 시 피스톨(표준형) 자동 배정').toBe('bullet');
});

// ---------------------------------------------------------------- 조작·전투

test('[BF-05] WASD 이동, 맵 경계 밖으로 나가지 않음', async ({ page }) => {
  await start(page);
  const before = await P(page);
  await page.keyboard.down('d'); await page.waitForTimeout(1000); await page.keyboard.up('d');
  const after = await P(page);
  expect(after.x - before.x).toBeGreaterThan(100);   // 속도 170/초
  expect(after.x - before.x).toBeLessThan(260);
  await ev(page, () => { game.players[0].x = CONFIG.WORLD_W - 20; });
  await page.keyboard.down('d'); await page.waitForTimeout(600); await page.keyboard.up('d');
  const edge = await P(page);
  expect(edge.x).toBe(await ev(page, () => CONFIG.WORLD_W - CONFIG.PLAYER.radius));
});

test('[BF-06] 마우스 좌클릭을 누르는 동안만 주무기 발사', async ({ page }) => {
  await start(page);
  const box = await page.locator('#canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.waitForTimeout(600);
  expect(await ev(page, () => game.projectiles.length)).toBe(0);          // 누르지 않으면 발사 없음
  await page.mouse.down(); await page.waitForTimeout(400);
  expect(await ev(page, () => game.projectiles.length)).toBeGreaterThan(0);
  await page.mouse.up();
});

test('[BF-07] 조준 사격으로 몬스터 처치 시 처치 수·HUD 증가, 경험치 오브 드랍', async ({ page }) => {
  await start(page);
  // 플레이어 오른쪽 140px에 구울을 놓고, 그 화면 위치를 조준한다
  const target = await ev(page, () => {
    const p = game.players[0];
    const m = makeMonster('ghoul', p.x + 140, p.y); game.monsters.push(m);
    const s = worldToScreen(m.x, m.y); return { sx: s.x, sy: s.y };
  });
  const box = await page.locator('#canvas').boundingBox();
  await page.mouse.move(box.x + target.sx * box.width / 900, box.y + target.sy * box.height / 560);
  await page.mouse.down();
  await expect.poll(() => ev(page, () => game.kills), { timeout: 5000 }).toBe(1);
  await page.mouse.up();
  await expect(page.locator('#killCount')).toContainText('1 KILLS');
  expect(await ev(page, () => game.orbs.length + game.players[0].exp)).toBeGreaterThan(0); // 오브가 있거나 이미 흡수됨
});

// ---------------------------------------------------------------- 레벨업·무정지 카드 선택 (§33)

test('[BF-08] 레벨업 시 다음 필요 경험치 20×1.2^(레벨-1), LEVEL UP 카드 3장', async ({ page }) => {
  await start(page);
  await dropOrb(page, 20);
  await expect(page.locator('#choiceTitle')).toHaveText('P1 LEVEL UP');
  await expect(page.locator('#choiceCards .card')).toHaveCount(3);
  const p = await P(page);
  expect(p.level).toBe(2);
  expect(p.expToNext).toBe(Math.round(20 * 1.2));
  await expect(page.locator('#lvP1')).toHaveText('Lv2');
});

test('[BF-09] 연속 레벨업은 대기열로 이어지고 매번 10초가 새로 적용', async ({ page }) => {
  await start(page);
  await dropOrb(page, 20 + 24);                        // 2레벨 분량
  await expect.poll(async () => (await P(page)).level).toBe(3);
  await expect.poll(async () => (await P(page)).pending).toEqual(['levelup']);
  await page.waitForTimeout(2000);                     // 첫 카드 시간 일부 소진
  await page.locator('#choiceCards .card').first().click();
  await expect.poll(async () => { const p = await P(page); return p.choosing && p.choosing.kind; }).toBe('levelup');
  expect((await P(page)).choosing.timer).toBeGreaterThan(9);
  await expect(page.locator('#choiceTitle')).toHaveText('P1 LEVEL UP');
});

test('[BF-10][BF-11][BF-12][BF-13] 카드 선택 중 무적·이동 불가·보조무기 정지·시간은 흐름', async ({ page }) => {
  await start(page);
  await ev(page, () => { game.players[0].weapons.push({ type: 'whip', level: 1, timer: 0.5, manual: false, phase: 0 }); });
  await dropOrb(page, 20);
  await expect.poll(async () => ((await P(page)).choosing ? 'yes' : 'no')).toBe('yes');
  const before = await P(page);
  const t0 = await ev(page, () => game.elapsed);
  const whip = () => ev(page, () => game.players[0].weapons.find(w => w.type === 'whip').timer);
  const whip0 = await whip();                           // 선택이 시작된 뒤의 값 (그 전 프레임에는 정상적으로 줄어든다)
  await ev(page, () => { const p = game.players[0]; game.monsters.push(makeMonster('ghoul', p.x, p.y)); });
  await page.keyboard.down('d'); await page.waitForTimeout(1500); await page.keyboard.up('d');
  const after = await P(page);
  await test.step('BF-10 무적', async () => expect(after.hp).toBe(before.hp));
  await test.step('BF-11 이동 불가', async () => expect(after.x).toBe(before.x));
  await test.step('BF-12 보조무기 정지', async () => {
    expect(whip0).toBeGreaterThan(0);                   // 아직 발동 전 상태에서 멈췄는지
    expect(await whip()).toBe(whip0);
  });
  await test.step('BF-13 시간은 흐름', async () => expect(await ev(page, () => game.elapsed)).toBeGreaterThan(t0 + 1));
});

test('[BF-14] 레벨업 카드 10초 미선택 시 무작위 1장 자동 적용 후 복귀', async ({ page }) => {
  await start(page);
  const build = () => ev(page, () => {
    const p = game.players[0];
    return p.weapons.reduce((s, w) => s + w.level, 0) + Object.values(p.passivesOwned).reduce((a, b) => a + b, 0);
  });
  const b0 = await build();
  await dropOrb(page, 20);
  await expect(page.locator('#choiceOverlay')).toBeVisible();
  await expect(page.locator('#choiceOverlay')).toBeHidden({ timeout: 12_000 });
  expect((await P(page)).choosing).toBeNull();
  expect(await build()).toBe(b0 + 1);                  // 카드 1장이 적용됨
});

test('[BF-15] 레벨업 카드에 장착하지 않은 주무기는 등장하지 않음 (300회 생성)', async ({ page }) => {
  await start(page);
  const ids = await ev(page, () => {
    const seen = new Set();
    for (let i = 0; i < 300; i++) buildCardPool(game.players[0]).forEach(c => seen.add(c.id));
    return [...seen];
  });
  expect(ids.filter(id => /shotgun|laser/.test(id))).toEqual([]);
  expect(ids).toContain('up_bullet');
});

// ---------------------------------------------------------------- 2인 협동

test('[BF-16] 2인 협동 경험치 분배: 주운 사람 100%, 파트너 70%', async ({ page }) => {
  await start(page, 'coop', ['피스톨', '샷건']);
  await dropOrb(page, 10, 0);
  await expect.poll(async () => (await P(page, 0)).exp).toBe(10);
  expect((await P(page, 1)).exp).toBe(7);
});

test('[BF-17] 로컬 협동 동시 레벨업 시 한 명씩, 대기자의 10초는 흐르지 않음', async ({ page }) => {
  await start(page, 'coop', ['피스톨', '샷건']);
  await ev(page, () => { gainExp(game.players[0], 20); gainExp(game.players[1], 20); });
  await expect(page.locator('#choiceTitle')).toHaveText('P1 LEVEL UP');
  await page.waitForTimeout(2000);
  const p2wait = await P(page, 1);
  expect(p2wait.choosing).toBeNull();
  expect(p2wait.pending).toEqual(['levelup']);
  await page.locator('#choiceCards .card').first().click();
  await expect(page.locator('#choiceTitle')).toHaveText('P2 LEVEL UP');
  expect((await P(page, 1)).choosing.timer).toBeGreaterThan(9);
});

test('[BF-28] 2인 협동: 다운된 파트너 곁에 2.6초 머무르면 체력 50%로 소생', async ({ page }) => {
  await start(page, 'coop', ['피스톨', '샷건']);
  await ev(page, () => applyDamageToPlayer(game.players[1], 999));
  expect((await P(page, 1)).downed).toBe(true);
  await expect(page.locator('#resultOverlay')).toBeHidden();       // 한 명은 살아 있으니 게임 계속
  await ev(page, () => { const [a, b] = game.players; a.x = b.x - 20; a.y = b.y; });
  await expect.poll(async () => (await P(page, 1)).downed, { timeout: 5000 }).toBe(false);
  expect((await P(page, 1)).hp).toBe(50);
});

// ---------------------------------------------------------------- 보스 게이트 (§27, §31.2)

test('[BF-18][BF-19][BF-20] 05:00 보스 등장·타이머 정지 → 처치 → 전리품 3장·Act 2 → 선택 후 재개', async ({ page }) => {
  await start(page);
  await ev(page, () => {
    const p = game.players[0]; p.maxHp = p.hp = 1e6;                 // 보스 공격으로 죽지 않게
    p.weapons.push({ type: 'whip', level: 1, timer: 0, manual: false, phase: 0 }); // 전리품 '서로 다른 대상 2장' 조건
    game.elapsed = 299.5;
  });

  await test.step('BF-18 보스 등장, 타이머 정지, HUD', async () => {
    await expect.poll(() => ev(page, () => game.monsters.some(m => m.type === 'boss'))).toBe(true);
    const e1 = await ev(page, () => game.elapsed);
    await page.waitForTimeout(1500);
    expect(await ev(page, () => game.elapsed)).toBe(e1);
    expect(e1).toBeGreaterThanOrEqual(300);
    expect(e1).toBeLessThan(300.1);
    await expect(page.locator('#timerChip')).toContainText('⚔');
    await expect(page.locator('#bossHpWrap')).toBeVisible();
  });

  await test.step('BF-19 처치 → 전리품 3장, Act 2', async () => {
    await ev(page, () => { const b = game.monsters.find(m => m.type === 'boss'); damageMonster(b, 1e7, game.players[0]); });
    await expect(page.locator('#choiceTitle')).toHaveText('P1 보스 전리품');
    const cards = page.locator('#choiceCards .card');
    await expect(cards).toHaveCount(3);
    const titles = await cards.locator('h3').allTextContents();
    expect(titles.filter(t => t.includes('희귀 강화'))).toHaveLength(2);
    expect(new Set(titles).size).toBe(3);
    expect(titles).toContain('재정비');
    expect(await ev(page, () => game.stage)).toBe(2);
  });

  await test.step('BF-20 고르기 전 정지, 고른 뒤 재개', async () => {
    const e1 = await ev(page, () => game.elapsed);
    await page.waitForTimeout(1200);
    expect(await ev(page, () => game.elapsed)).toBe(e1);
    await page.locator('#choiceCards .card', { hasText: '재정비' }).click();
    await page.waitForTimeout(1200);
    expect(await ev(page, () => game.elapsed)).toBeGreaterThan(e1 + 0.8);
    await expect(page.locator('#stageLabel')).toHaveText('ACT 2 · 무너진 납골당');
  });
});

// ---------------------------------------------------------------- 아이템 박스 (§16)

/** 플레이어 위치에 박스를 놓고, 효과가 정해지는 무작위 값을 고정한다. */
async function openBox(page, roll) {
  await fixRandom(page, roll);
  await ev(page, () => { const p = game.players[0]; game.boxes.push({ x: p.x, y: p.y, r: 14 }); });
  await expect.poll(() => ev(page, () => game.boxes.length)).toBe(0);
  await restoreRandom(page);
}

test('[BF-21] 아이템 박스 포션: 최대 체력 10% 회복, 최대치 초과 안 함', async ({ page }) => {
  await start(page);
  await ev(page, () => { game.players[0].hp = 50; });
  await openBox(page, 0.1);
  expect((await P(page)).hp).toBe(60);
  await ev(page, () => { game.players[0].hp = 95; });
  await openBox(page, 0.1);
  expect((await P(page)).hp).toBe(100);
});

test('[BF-22] 아이템 박스 폭탄: 가까운 몬스터 10마리 처치, 보스 제외', async ({ page }) => {
  await start(page);
  await ev(page, () => {
    const p = game.players[0]; p.maxHp = p.hp = 1e6;
    for (let i = 0; i < 12; i++) game.monsters.push(makeMonster('ghoul', p.x + 150 + i * 25, p.y + 200)); // 가까운 순서 고정
    spawnBoss('boss');
  });
  const k0 = await ev(page, () => game.kills);
  await openBox(page, 0.5);
  expect(await ev(page, () => game.kills)).toBe(k0 + 10);
  const left = await ev(page, () => game.monsters.map(m => m.type));
  expect(left.filter(t => t === 'ghoul')).toHaveLength(2);
  expect(left).toContain('boss');
});

test('[BF-23] 아이템 박스 자석: 3초간 먼 경험치 오브도 흡수', async ({ page }) => {
  await start(page);
  await dropOrb(page, 1, 0, 600);                      // 줍기 범위(55px) 훨씬 밖
  await page.waitForTimeout(500);
  expect(await ev(page, () => game.orbs.length)).toBe(1);
  await openBox(page, 0.9);
  expect((await P(page)).magnet).toBeGreaterThan(2.5);
  await expect.poll(() => ev(page, () => game.orbs.length), { timeout: 3000 }).toBe(0);
});

// ---------------------------------------------------------------- 결과·재시작

test('[BF-24][BF-26] 1인 체력 0 → 전멸 결과 창, [다시 도전]으로 새 게임', async ({ page }) => {
  await start(page);
  await ev(page, () => { const p = game.players[0]; p.hp = 1; game.monsters.push(makeMonster('ghoul', p.x, p.y)); });
  await expect(page.locator('#resultOverlay')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#resultTitle')).toHaveText('전멸');
  await expect(page.locator('#resultStats')).toContainText('FAIL');
  await test.step('BF-26 다시 도전', async () => {
    await page.click('#btnRetry');
    await expect(page.locator('#resultOverlay')).toBeHidden();
    await expect(page.locator('#choiceTitle')).toHaveText('P1 주무기 선택');
    expect(await ev(page, () => [game.mode, game.kills, game.state])).toEqual(['solo', 0, 'draft']);
  });
});

test('[BF-25][BF-27] 최종 보스 처치 → 클리어 결과 창, [모드 선택으로] 메뉴 복귀', async ({ page }) => {
  await start(page);
  await ev(page, () => { game.players[0].maxHp = game.players[0].hp = 1e6; spawnBoss('nightfallDuke'); });
  await ev(page, () => { const b = game.monsters.find(m => m.type === 'nightfallDuke'); damageMonster(b, 1e7, game.players[0]); });
  await expect(page.locator('#resultTitle')).toHaveText('최종 보스 처치 · 클리어');
  await expect(page.locator('#resultStats')).toContainText('CLEAR');
  await test.step('BF-27 모드 선택으로', async () => {
    await page.click('#btnMenu');
    await expect(page.locator('#menuOverlay')).toBeVisible();
    expect(await ev(page, () => game)).toBeNull();
  });
});

// ---------------------------------------------------------------- 온라인·안정성

test('[BF-29] 온라인 참가: 4자리가 아닌 방 코드 입력 시 안내 문구', async ({ page }) => {
  await page.goto(URL);
  await page.click('#btnJoinShow');
  await page.fill('#joinCodeInput', '12');
  await page.click('#btnJoinGo');
  await expect(page.locator('#netStatus')).toContainText('4자리 방 코드를 입력해주세요.');
});

test('[BF-30] 몬스터 스폰·사격이 이어지는 20초 플레이 동안 콘솔 오류 없음', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(URL);
  await page.click('#btnSolo');
  await page.locator('#choiceCards .card', { hasText: '샷건' }).click();
  await ev(page, () => { game.players[0].maxHp = game.players[0].hp = 1e6; });
  const box = await page.locator('#canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.4);
  await page.mouse.down();
  for (const k of ['d', 's', 'a', 'w', 'd']) { await page.keyboard.down(k); await page.waitForTimeout(4000); await page.keyboard.up(k); }
  await page.mouse.up();
  expect(await ev(page, () => game.kills)).toBeGreaterThan(0);     // 실제로 전투가 일어났는지
  expect(errors).toEqual([]);
});
