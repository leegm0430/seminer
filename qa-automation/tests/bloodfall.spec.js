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

// =====================================================================================
// AI 보충 TC (BF-101~) — TC 작성 규칙 044 커버리지(C1~C5)로 2026-11-02 추가. TC 하나 = 테스트 하나.
// - 테스트 이름은 tc/bloodfall_tc.json의 [번호] 제목. 번호 앞자리 = 근거 칸(B01~B18).
// - 온라인 테스트는 P2P 라이브러리 대신 가짜 Peer를 넣어 서버 응답을 테스트가 직접 보낸다.
// =====================================================================================
const BFT = require('../tc/bloodfall_tc.json');
const BTITLE = Object.fromEntries(BFT.automated.map((x) => [x.id, x.title]));
function t(num, fn, opts) {
  const id = 'BF-' + num;
  if (!BTITLE[id]) throw new Error('TC JSON에 없는 번호: ' + id);
  test(`[${id}] ${BTITLE[id]}`, opts || {}, fn);
}
const CX = 1350, CY = 840;                                   // 월드 중앙(시작 위치)
const dmg = (page, i, v) => ev(page, ([i, v]) => applyDamageToPlayer(game.players[i], v), [i, v]);
/** 카드 풀을 n번 뽑아 나온 카드 id·제목을 모두 모은다 (풀에서 3장만 무작위로 뽑기 때문) */
const poolOf = (page, i = 0, n = 300) => ev(page, ([i, n]) => {
  const ids = new Set(), titles = new Set();
  for (let k = 0; k < n; k++) for (const c of buildCardPool(game.players[i])) { ids.add(c.id); titles.add(c.title); }
  return { ids: [...ids], titles: [...titles] };
}, [i, n]);
/** 카드 id가 들어간 레벨업 창을 연다 */
const openWith = (page, id, i = 0) => ev(page, ([id, i]) => {
  const p = game.players[i];
  for (let k = 0; k < 500; k++) {
    const cards = buildCardPool(p);
    if (cards.some((c) => c.id === id)) {
      p.choosing = { kind: 'levelup', cards, timer: 10, total: 10 };
      fillChoicePanel(p.id, 'levelup', cards, (cid) => resolveChoice(p, cid));
      return true;
    }
  }
  return false;
}, [id, i]);
const card = (page, text) => page.locator('#choiceCards .card', { hasText: text }).first();
/** 무기·패시브를 모두 최대로 (evolved: 피스톨까지 진화) */
const maxOut = (page, evolved) => ev(page, (evolved) => {
  const p = game.players[0];
  p.weapons = ['bullet', 'whip', 'aura', 'shuriken', 'drone'].map((type) => ({ type, level: 5, timer: 9, manual: type === 'bullet', evolved: type === 'bullet' ? evolved : true, phase: 0 }));
  Object.keys(p.passivesOwned).forEach((k) => { p.passivesOwned[k] = 5; });
}, evolved);
const killBoss = (page, type) => ev(page, (type) => {
  spawnBoss(type); const m = game.monsters[game.monsters.length - 1]; m.attackTimer = 99;
  damageMonster(m, 1e6, game.players[0]);
}, type);
const spawnB = (page, type, ratio = 1) => ev(page, ([type, r]) => {
  spawnBoss(type); const m = game.monsters[game.monsters.length - 1];
  m.hp = m.maxHp * r; m.attackTimer = 99; return game.monsters.length - 1;
}, [type, ratio]);

// ---------------------------------------------------------------- B01 메뉴
t(101, async ({ page }) => { await page.goto(URL); await expect(page.locator('#btnSolo')).toHaveText('1인 플레이'); });
t(102, async ({ page }) => { await page.goto(URL); await expect(page.locator('#btnCoop')).toHaveText('2인 협동 (로컬)'); });
t(103, async ({ page }) => { await page.goto(URL); await expect(page.locator('#joinPanel')).toBeHidden(); });
t(104, async ({ page }) => { await page.goto(URL); await page.click('#btnJoinShow'); await expect(page.locator('#joinPanel')).toBeVisible(); });
t(105, async ({ page }) => { await page.goto(URL); await page.click('#btnJoinShow'); await page.click('#btnJoinShow'); await expect(page.locator('#joinPanel')).toBeHidden(); });
t(106, async ({ page }) => { await page.goto(URL); await page.click('#btnJoinShow'); await expect(page.locator('#joinCodeInput')).toHaveAttribute('placeholder', '방 코드 4자리'); });
t(107, async ({ page }) => {
  await page.goto(URL); await page.click('#btnJoinShow');
  await page.locator('#joinCodeInput').pressSequentially('ABCDE');
  await expect(page.locator('#joinCodeInput')).toHaveValue('ABCD');
});
for (const [n, v] of [[108, 'ABC'], [109, ' AB ']]) t(n, async ({ page }) => {
  await page.goto(URL); await page.click('#btnJoinShow');
  await page.fill('#joinCodeInput', v); await page.click('#btnJoinGo');
  await expect(page.locator('#netStatus')).toHaveText('4자리 방 코드를 입력해주세요.');
});

// ---------------------------------------------------------------- B02 드래프트
const DESC = ['표준형 — 단발 조준 사격. 무난한 사거리와 연사', '근거리형 — 부채꼴 5발 동시 발사. 짧은 사거리, 순간 화력', '관통형 — 조준 방향 자동 관통 광선. 일직선 다수 처리'];
DESC.forEach((d, i) => t(201 + i, async ({ page }) => {
  await page.goto(URL); await page.click('#btnSolo');
  await expect(page.locator('#choiceCards .card p').nth(i)).toHaveText(d);
}));
t(204, async ({ page }) => {
  await page.goto(URL); await page.click('#btnSolo');
  expect(await page.locator('#choiceCards .card .rarity').allTextContents()).toEqual(['MAIN WEAPON', 'MAIN WEAPON', 'MAIN WEAPON']);
});
const fillPct = (page) => page.$eval('#choiceTimerFill', (e) => parseFloat(e.style.width));
t(205, async ({ page }) => { await page.goto(URL); await page.click('#btnSolo'); expect(await fillPct(page)).toBeGreaterThanOrEqual(95); });
t(206, async ({ page }) => {
  await page.goto(URL); await page.click('#btnSolo'); await page.waitForTimeout(5000);
  const v = await fillPct(page); expect(v).toBeGreaterThanOrEqual(40); expect(v).toBeLessThanOrEqual(60);
});
t(207, async ({ page }) => { await start(page, 'solo', ['피스톨']); expect((await P(page)).weapons).toEqual(['bullet']); });
t(208, async ({ page }) => { await start(page, 'solo', ['레이저']); expect((await P(page)).weapons).toEqual(['laser']); });
t(209, async ({ page }) => {
  await page.goto(URL); await page.click('#btnCoop');
  await card(page, '샷건').click();
  await expect(page.locator('#choiceTitle')).toHaveText('P2 주무기 선택');
});
t(210, async ({ page }) => {
  await start(page, 'coop', ['샷건', '샷건']);
  expect((await P(page, 0)).main).toBe('shotgun'); expect((await P(page, 1)).main).toBe('shotgun');
});

// ---------------------------------------------------------------- B03 HUD
t(301, async ({ page }) => { await start(page); await expect(page.locator('#timerChip')).toHaveText('20:00'); });
t(302, async ({ page }) => { await start(page); await ev(page, () => { game.elapsed = 0.5; }); await page.waitForTimeout(100); await expect(page.locator('#timerChip')).toHaveText('20:00'); });
t(303, async ({ page }) => { await start(page); await ev(page, () => { game.elapsed = 60; }); await expect(page.locator('#timerChip')).toHaveText('19:00'); });
t(304, async ({ page }) => { await start(page); await expect(page.locator('#killCount')).toContainText('0 KILLS'); });
t(305, async ({ page }) => { await start(page); await expect(page.locator('#lvP1')).toHaveText('Lv1'); });
t(306, async ({ page }) => { await start(page); await ev(page, () => { game.players[0].exp = 10; }); await expect.poll(() => page.$eval('#expP1', (e) => e.style.width)).toBe('50%'); });
t(307, async ({ page }) => { await start(page); await ev(page, () => { game.players[0].hp = 70; }); await expect.poll(() => page.$eval('#hpP1', (e) => e.style.width)).toBe('70%'); });
t(308, async ({ page }) => { await start(page); await expect(page.locator('#rowP2')).toBeHidden(); });
t(309, async ({ page }) => { await start(page, 'coop', ['피스톨', '피스톨']); await expect(page.locator('#rowP2')).toBeVisible(); });
['잠긴 묘지', '무너진 납골당', '저주받은 안뜰', '나이트폴 첨탑'].forEach((nm, i) => t(310 + i, async ({ page }) => {
  await start(page); await ev(page, (s) => { game.stage = s; }, i + 1);
  await expect(page.locator('#stageLabel')).toHaveText(`ACT ${i + 1} · ${nm}`);
}));
t(314, async ({ page }) => { await start(page); await expect(page.locator('#bossHpWrap')).toBeHidden(); });

// ---------------------------------------------------------------- B04 조작
const ownShots = (page, i) => ev(page, (i) => game.projectiles.filter((pr) => pr.owner === game.players[i]).length, i);
t(401, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']); const x0 = (await P(page, 1)).x;
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
  expect((await P(page, 1)).x).toBeGreaterThan(x0 + 40);
});
t(402, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']);
  await page.keyboard.down('Enter'); await page.waitForTimeout(400);
  expect(await ownShots(page, 1)).toBeGreaterThan(0);
  await page.keyboard.up('Enter');
});
t(403, async ({ page }) => {
  await start(page);
  await page.keyboard.down(' '); await page.waitForTimeout(500);
  expect(await ownShots(page, 0)).toBe(0);
  await page.keyboard.up(' ');
});
t(404, async ({ page }) => {
  await start(page);
  await ev(page, () => { mouseDown = true; }); await page.waitForTimeout(400);
  await ev(page, () => { mouseDown = false; game.projectiles = []; }); await page.waitForTimeout(600);
  expect(await ownShots(page, 0)).toBe(0);
});
t(405, async ({ page }) => {
  await start(page); const p0 = await P(page);
  await page.keyboard.down('w'); await page.keyboard.down('d'); await page.waitForTimeout(500);
  await page.keyboard.up('w'); await page.keyboard.up('d');
  const p1 = await P(page);
  expect(p1.x).toBeGreaterThan(p0.x + 20); expect(p1.y).toBeLessThan(p0.y - 20);
});

// ---------------------------------------------------------------- B05 카드 풀
t(501, async ({ page }) => { await start(page); expect((await poolOf(page)).titles).toContain('피스톨 강화 (1→2/5)'); });
t(502, async ({ page }) => { await start(page); expect((await poolOf(page)).titles).toContain('질풍의 가호 (1/5)'); });
t(503, async ({ page }) => {
  await start(page); const ids = (await poolOf(page)).ids;
  for (const s of ['new_whip', 'new_aura', 'new_shuriken', 'new_drone']) expect(ids).toContain(s);
});
t(504, async ({ page }) => { await start(page); await ev(page, () => { game.players[0].passivesOwned.speed = 5; }); expect((await poolOf(page)).ids).not.toContain('p_speed'); });
t(505, async ({ page }) => { await start(page); await ev(page, () => { game.players[0].passivesOwned.speed = 4; }); expect((await poolOf(page)).titles).toContain('질풍의 가호 (5/5)'); });
const setBullet = (page, o) => ev(page, (o) => { Object.assign(game.players[0].weapons.find((w) => w.type === 'bullet'), o); }, o);
t(506, async ({ page }) => { await start(page); await setBullet(page, { level: 5 }); expect((await poolOf(page)).ids).not.toContain('up_bullet'); });
t(507, async ({ page }) => {
  await start(page); await setBullet(page, { level: 5 }); await ev(page, () => { game.players[0].passivesOwned.speed = 1; });
  expect((await poolOf(page)).titles).toContain('관통탄');
});
t(508, async ({ page }) => {
  await start(page); await setBullet(page, { level: 5 }); await ev(page, () => { game.players[0].passivesOwned.power = 1; });
  expect((await poolOf(page)).ids).not.toContain('evo_bullet');
});
t(509, async ({ page }) => {
  await start(page); await setBullet(page, { level: 5, evolved: true }); await ev(page, () => { game.players[0].passivesOwned.speed = 1; });
  expect((await poolOf(page)).ids).not.toContain('evo_bullet');
});
t(510, async ({ page }) => {
  await start(page); await maxOut(page, false);
  await ev(page, () => startChoice(game.players[0], 'levelup'));
  await expect(page.locator('#choiceCards .card.evolution')).toHaveCount(1);
  await expect(page.locator('#choiceCards .card.evolution .rarity')).toHaveText('EVOLUTION');
});
t(511, async ({ page }) => {
  await start(page); await maxOut(page, true);
  await ev(page, () => startChoice(game.players[0], 'levelup'));
  await expect(page.locator('#choiceCards .card')).toHaveCount(1);
  await expect(page.locator('#choiceCards .card h3')).toHaveText('응급 처치');
});
t(512, async ({ page }) => { await start(page, 'coop', ['피스톨', '피스톨']); expect((await poolOf(page)).ids).toContain('synergy'); });
t(513, async ({ page }) => { await start(page); expect((await poolOf(page)).ids).not.toContain('synergy'); });
t(514, async ({ page }) => { await start(page); await ev(page, () => startChoice(game.players[0], 'levelup')); await expect(page.locator('#choiceCards .card')).toHaveCount(3); });
t(515, async ({ page }) => {
  await start(page, 'solo', ['샷건']);
  await ev(page, () => { const p = game.players[0]; p.weapons[0].level = 5; p.passivesOwned.speed = 1; });
  expect((await poolOf(page)).ids).not.toContain('evo_bullet');
});
/** 피스톨 한 발을 쏴서 피해량을 읽는다 */
const shotDmg = (page) => ev(page, () => new Promise((res) => {
  game.projectiles = []; mouseDown = true;
  const iv = setInterval(() => { const s = game.projectiles.find((pr) => pr.owner === game.players[0]); if (s) { clearInterval(iv); mouseDown = false; res(s.dmg); } }, 20);
}));
t(516, async ({ page }) => {
  await start(page); await setBullet(page, { level: 5 });
  const before = await shotDmg(page); await page.waitForTimeout(400);
  await setBullet(page, { evolved: true });
  const after = await shotDmg(page);
  expect(after / before).toBeCloseTo(1.6, 5);
});
t(517, async ({ page }) => {
  await start(page); expect(await openWith(page, 'new_whip')).toBe(true);
  await card(page, '채찍').click();
  expect((await P(page)).weapons).toContain('whip');
});
t(518, async ({ page }) => {
  await start(page); expect(await openWith(page, 'up_bullet')).toBe(true);
  await card(page, '피스톨 강화').click();
  expect(await ev(page, () => game.players[0].weapons.find((w) => w.type === 'bullet').level)).toBe(2);
});

// ---------------------------------------------------------------- B06 패시브 효과
const PASSIVE = [['p_speed', '질풍의 가호', () => game.players[0].speed, 187],
  ['p_hp', '불사의 심장', () => game.players[0].maxHp, 120],
  ['p_cd', '광기의 손놀림', () => game.globalCooldownMul, 0.92],
  ['p_pick', '탐욕의 시야', () => game.players[0].pickupRadius, 71.5],
  ['p_armor', '방탄조끼', () => game.players[0].damageTakenMul, 0.92],
  ['p_power', '강화장갑', () => game.globalDamageMul, 1.1]];
PASSIVE.forEach(([id, nm, read, v], i) => t(601 + i, async ({ page }) => {
  await start(page); expect(await openWith(page, id)).toBe(true);
  await card(page, nm).click();
  expect(await page.evaluate(read)).toBeCloseTo(v, 5);
}));
t(607, async ({ page }) => {
  await start(page); await ev(page, () => { game.players[0].hp = 50; });
  expect(await openWith(page, 'p_hp')).toBe(true); await card(page, '불사의 심장').click();
  expect((await P(page)).hp).toBe(70);
});
t(608, async ({ page }) => {
  await start(page); await ev(page, () => { game.players[0].damageTakenMul = 0.92; });
  await dmg(page, 0, 10);
  expect((await P(page)).hp).toBeCloseTo(90.8, 5);
});

// ---------------------------------------------------------------- B07 경험치
const gain = (page, v, i = 0) => ev(page, ([v, i]) => gainExp(game.players[i], v), [v, i]);
[[3, [20, 24], 29], [4, [20, 24, 29], 35], [5, [20, 24, 29, 35], 41]].forEach(([lv, steps, need], k) => t(701 + k, async ({ page }) => {
  await start(page); for (const s of steps) await gain(page, s);
  const p = await P(page); expect(p.level).toBe(lv); expect(p.expToNext).toBe(need);
}));
t(704, async ({ page }) => { await start(page); await gain(page, 19); const p = await P(page); expect(p.level).toBe(1); expect(p.exp).toBe(19); });
t(705, async ({ page }) => { await start(page); await gain(page, 20); const p = await P(page); expect(p.level).toBe(2); expect(p.exp).toBe(0); });
t(706, async ({ page }) => { await start(page); await gain(page, 25); const p = await P(page); expect([p.level, p.exp, p.expToNext]).toEqual([2, 5, 24]); });
t(707, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']); await dropOrb(page, 5, 0);
  await expect.poll(async () => (await P(page, 1)).exp).toBe(4);
});
t(708, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']);
  await ev(page, () => startChoice(game.players[1], 'levelup'));
  await dropOrb(page, 10, 0);
  await expect.poll(async () => (await P(page, 1)).exp).toBe(7);
});
t(709, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']);
  await ev(page, () => { game.players[0].magnetTimer = 3; });
  await dropOrb(page, 10, 0, -500);
  await expect.poll(async () => (await P(page, 1)).exp, { timeout: 4000 }).toBe(7);
});

// ---------------------------------------------------------------- B08 무정지
t(801, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']);
  const who = await ev(page, () => {
    startChoice(game.players[0], 'levelup');
    const m = makeMonster('ghoul', game.players[0].x + 20, game.players[0].y);
    return nearestTarget(m, aliveNonDownedPlayers()).id;
  });
  expect(who).toBe('P2');
});
t(802, async ({ page }) => {
  await start(page);
  await ev(page, () => { const p = game.players[0]; startChoice(p, 'levelup'); game.boxes.push({ x: p.x, y: p.y, r: 14 }); });
  await page.waitForTimeout(500);
  expect(await ev(page, () => game.boxes.length)).toBe(1);
});
t(803, async ({ page }) => {
  await start(page); await ev(page, () => startChoice(game.players[0], 'levelup'));
  await dropOrb(page, 5, 0); await page.waitForTimeout(500);
  expect(await ev(page, () => game.orbs.length)).toBe(1);
});
t(804, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']);
  await ev(page, () => { const [a, b] = game.players; applyDamageToPlayer(b, 999); a.x = b.x - 30; a.y = b.y; startChoice(a, 'levelup'); });
  await page.waitForTimeout(3000);
  expect((await P(page, 1)).downed).toBe(true);
});
t(805, async ({ page }) => { await start(page); await ev(page, () => startChoice(game.players[0], 'levelup')); await expect(page.locator('#choiceTitle')).toHaveText('P1 LEVEL UP'); });

// ---------------------------------------------------------------- B09 소생
const downP2At = (page, d) => ev(page, (d) => { const [a, b] = game.players; applyDamageToPlayer(b, 999); a.x = b.x - d; a.y = b.y; }, d);
t(901, async ({ page }) => { await start(page, 'coop', ['피스톨', '피스톨']); await downP2At(page, 45); await page.waitForTimeout(3000); expect((await P(page, 1)).downed).toBe(false); });
t(902, async ({ page }) => { await start(page, 'coop', ['피스톨', '피스톨']); await downP2At(page, 48); await page.waitForTimeout(3000); expect((await P(page, 1)).downed).toBe(true); });
t(903, async ({ page }) => { await start(page, 'coop', ['피스톨', '피스톨']); await downP2At(page, 45); await page.waitForTimeout(2300); expect((await P(page, 1)).downed).toBe(true); });
t(904, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']); await downP2At(page, 45); await page.waitForTimeout(2000);
  await ev(page, () => { game.players[0].x -= 300; }); await page.waitForTimeout(1000);
  await ev(page, () => { game.players[0].x += 300; }); await page.waitForTimeout(700);
  expect((await P(page, 1)).downed).toBe(true);           // 진행도가 줄지 않았다면 2.0+0.7 ≥ 2.6으로 이미 일어났을 것
});
t(905, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']); await dmg(page, 1, 999); await dmg(page, 0, 999);
  await expect(page.locator('#resultTitle')).toHaveText('전멸');
});
t(906, async ({ page }) => { await start(page, 'coop', ['피스톨', '피스톨']); await dmg(page, 1, 999); await expect(page.locator('#downFlagP2')).toBeVisible(); await expect(page.locator('#downFlagP2')).toHaveText('P2 DOWN'); });
t(907, async ({ page }) => { await start(page); await dmg(page, 0, 999); await expect(page.locator('#resultTitle')).toHaveText('전멸'); });

// ---------------------------------------------------------------- B10 보스 게이트
[[300, '블러드 배런'], [600, '그레이브 워든'], [900, '커스 마더'], [1200, '나이트폴 공작']].forEach(([sec, nm], i) => t(1001 + i, async ({ page }) => {
  await start(page);
  await ev(page, ([i, sec]) => { game.stage = i + 1; for (let k = 0; k < i; k++) game.bossSpawned[k] = true; game.elapsed = sec - 0.5; }, [i, sec]);
  await expect(page.locator('#bossHpLabel')).toHaveText(nm, { timeout: 3000 });
}));
const toBoss = (page, i, sec) => ev(page, ([i, sec]) => { game.stage = i + 1; for (let k = 0; k < i; k++) game.bossSpawned[k] = true; game.elapsed = sec - 0.2; }, [i, sec]);
t(1005, async ({ page }) => { await start(page); await toBoss(page, 0, 300); await expect(page.locator('#stageLabel')).toHaveText('보스를 처치하면 시간이 다시 흐릅니다'); });
t(1006, async ({ page }) => { await start(page); await toBoss(page, 3, 1200); await expect(page.locator('#stageLabel')).toHaveText('최종 보스를 처치해야 클리어됩니다'); });
t(1007, async ({ page }) => { await start(page); await toBoss(page, 0, 300); await expect(page.locator('#timerChip')).toHaveText('⚔ 15:00'); });
for (const [n, i, type, label] of [[1008, 1, 'graveWarden', 'ACT 3 · 저주받은 안뜰'], [1009, 2, 'curseMother', 'ACT 4 · 나이트폴 첨탑']]) t(n, async ({ page }) => {
  await start(page); await ev(page, (s) => { game.stage = s; }, i + 1);
  await killBoss(page, type);
  await expect(page.locator('#choiceTitle')).toHaveText('P1 보스 전리품');
  await page.locator('#choiceCards .card').first().click();
  await expect(page.locator('#stageLabel')).toHaveText(label);
});
for (const [n, type, stage] of [[1010, 'boss', 1], [1011, 'nightfallDuke', 4]]) t(n, async ({ page }) => {
  await start(page);
  await ev(page, ([type, s]) => { game.stage = s; game.bossSpawned.fill(true); spawnBoss(type); game.monsters[0].attackTimer = 99; game.spawnTimer = 0; }, [type, stage]);
  await page.waitForTimeout(3000);
  expect(await ev(page, () => game.monsters.filter((m) => !isBossType(m.type)).length)).toBeGreaterThan(0);
});
t(1012, async ({ page }) => {
  await start(page);
  await ev(page, () => { game.elapsed = 300; game.bossSpawned[0] = true; spawnBoss('boss'); game.monsters[0].attackTimer = 99; game.spawnTimer = 0; });
  await page.waitForTimeout(2000);
  const r = await ev(page, () => new Promise((res) => {
    const n0 = game.monsters.length; game.spawnTimer = 0;
    const iv = setInterval(() => { if (game.monsters.length > n0) { clearInterval(iv); res({ timer: game.spawnTimer, elapsed: game.elapsed }); } }, 5);
  }));
  expect(r.elapsed).toBe(300);
  expect(r.timer).toBeGreaterThan(0.8); expect(r.timer).toBeLessThanOrEqual(0.88 + 1e-9);   // 1.15 − 0.0009×300 = 0.88
});

// ---------------------------------------------------------------- B11 보스 페이즈·패턴
const phaseAt = async (page, type, ratio) => { const i = await spawnB(page, type, ratio); await page.waitForTimeout(150); return ev(page, (i) => game.monsters[i].phase, i); };
[[1101, 0.61, 1], [1102, 0.6, 2], [1103, 0.31, 2], [1104, 0.3, 3]].forEach(([n, r, ph]) => t(n, async ({ page }) => {
  await start(page); expect(await phaseAt(page, 'boss', r)).toBe(ph);
}));
const PATS = {
  boss: [['slam', 'burst'], ['slam', 'burst', 'summon'], ['slam', 'burst', 'summon', 'charge']],
  graveWarden: [['chainSweep', 'boneCage'], ['chainSweep', 'boneCage', 'graveBurst'], ['chainSweep', 'boneCage', 'graveBurst', 'chainSlam']],
  curseMother: [['curseBarrage'], ['curseBarrage', 'summonCaster'], ['curseBarrage', 'summonCaster', 'poisonFog', 'teleportBurst']],
  nightfallDuke: [['slam', 'summonWraith'], ['slam', 'summonWraith', 'bloodRail'], ['slam', 'summonWraith', 'bloodRail', 'charge', 'bloodRain']],
};
let pn = 1105;
for (const [type, phases] of Object.entries(PATS)) phases.forEach((pats, k) => t(pn++, async ({ page }) => {
  await start(page);
  const i = await spawnB(page, type, [1, 0.5, 0.2][k]); await page.waitForTimeout(150);
  expect(await ev(page, (i) => bossAvailablePatterns(game.monsters[i]), i)).toEqual(pats);
}));
/** 광폭화 보스의 실제 이동 배율 = 이동 거리 / (기본 속도 × 흐른 시간) */
const rageMul = async (page, type) => {
  await start(page);
  const i = await spawnB(page, type, 0.2);
  return ev(page, (i) => new Promise((res) => {
    const m = game.monsters[i]; const p = game.players[0];
    m.x = p.x + 900; m.y = p.y;                          // 멀리 두어 1초 안에 닿지 않게
    const x0 = m.x, y0 = m.y, t0 = game.animTime;
    setTimeout(() => res(Math.hypot(m.x - x0, m.y - y0) / (CONFIG.MONSTER[m.type].speed * (game.animTime - t0))), 1000);
  }), i);
};
t(1117, async ({ page }) => { expect(await rageMul(page, 'boss')).toBeCloseTo(1.35, 1); });
t(1118, async ({ page }) => { expect(await rageMul(page, 'graveWarden')).toBeCloseTo(1.3, 2); });
t(1119, async ({ page }) => {
  await start(page); const i = await spawnB(page, 'boss', 0.2);
  const cd = await ev(page, (i) => new Promise((res) => {
    const m = game.monsters[i]; m.x = game.players[0].x + 600;
    const real = Math.random; Math.random = () => 0;        // 첫 패턴(강타, 대기 4.5초) 고정
    m.attackTimer = 0;
    const iv = setInterval(() => { if (m.currentPattern && m.patternState === 'idle') { clearInterval(iv); Math.random = real; res(m.attackTimer); } }, 5);
  }), i);
  expect(cd).toBeLessThanOrEqual(4.5 * 0.7 + 1e-9); expect(cd).toBeGreaterThan(4.5 * 0.7 - 0.1);
});

// ---------------------------------------------------------------- B12 스폰
const pickCount = (page, stage, elapsed, n, type) => ev(page, ([s, e, n, type]) => {
  game.stage = s; game.elapsed = e; let c = 0; for (let k = 0; k < n; k++) if (pickMonsterType() === type) c++; return c;
}, [stage, elapsed, n, type]);
t(1201, async ({ page }) => { await start(page); expect(await pickCount(page, 1, 20, 1000, 'ghoul')).toBe(1000); });
t(1202, async ({ page }) => { await start(page); expect(await pickCount(page, 1, 200, 1000, 'caster')).toBe(0); });
const between = (v, lo, hi) => { expect(v).toBeGreaterThanOrEqual(lo); expect(v).toBeLessThanOrEqual(hi); };
t(1203, async ({ page }) => { await start(page); between(await pickCount(page, 2, 400, 10000, 'caster'), 1450, 1750); });
t(1204, async ({ page }) => { await start(page); between(await pickCount(page, 2, 400, 10000, 'bat'), 1250, 1550); });
t(1205, async ({ page }) => { await start(page); expect(await pickCount(page, 2, 400, 1000, 'bomber')).toBe(0); });
t(1206, async ({ page }) => { await start(page); between(await pickCount(page, 3, 700, 10000, 'bomber'), 850, 1150); });
t(1207, async ({ page }) => { await start(page); between(await pickCount(page, 4, 1000, 10000, 'golem'), 480, 720); });
const redCount = (page, stage, n) => ev(page, ([s, n]) => { game.stage = s; let c = 0; for (let k = 0; k < n; k++) if (makeMonster('ghoul', 0, 0).redMark) c++; return c; }, [stage, n]);
t(1208, async ({ page }) => { await start(page); expect(await redCount(page, 3, 1000)).toBe(0); });
t(1209, async ({ page }) => { await start(page); between(await redCount(page, 4, 5000), 500, 700); });
const redGhoul = (page) => ev(page, () => { game.stage = 4; for (let k = 0; k < 2000; k++) { const m = makeMonster('ghoul', 0, 0); if (m.redMark) return { hp: m.hp, exp: m.exp }; } return null; });
t(1210, async ({ page }) => { await start(page); expect((await redGhoul(page)).hp).toBe(32); });
t(1211, async ({ page }) => { await start(page); expect((await redGhoul(page)).exp).toBe(10); });
t(1212, async ({ page }) => {
  await start(page);
  const sizes = await ev(page, () => {
    const real = pickMonsterType; pickMonsterType = () => 'bat'; const out = [];
    for (let k = 0; k < 60; k++) { const n0 = game.monsters.length; spawnMonster(); out.push(game.monsters.length - n0); }
    pickMonsterType = real; game.monsters = []; return out;
  });
  expect(Math.min(...sizes)).toBe(3); expect(Math.max(...sizes)).toBe(5);
});
t(1213, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']);
  const timer = await ev(page, () => new Promise((res) => {
    game.elapsed = 0; const n0 = game.monsters.length; game.spawnTimer = 0;
    const iv = setInterval(() => { if (game.monsters.length > n0) { clearInterval(iv); res(game.spawnTimer); } }, 5);
  }));
  expect(timer).toBeLessThanOrEqual(1.15 / 1.7 + 1e-9); expect(timer).toBeGreaterThan(1.15 / 1.7 - 0.1);
});

// ---------------------------------------------------------------- B13 몬스터 행동
const bomberNear = (page) => ev(page, () => { const p = game.players[0]; const m = makeMonster('bomber', p.x + 40, p.y); game.monsters.push(m); return game.monsters.length - 1; });
t(1301, async ({ page }) => {
  await start(page); const i = await bomberNear(page);
  await expect.poll(() => ev(page, (i) => game.monsters[i] && game.monsters[i].fuseState, i)).toBe('fusing');
  await ev(page, (i) => damageMonster(game.monsters[i], 999, game.players[0]), i);
  await page.waitForTimeout(1200);
  expect((await P(page)).hp).toBe(100);
});
t(1302, async ({ page }) => { await start(page); await bomberNear(page); await page.waitForTimeout(1300); expect((await P(page)).hp).toBe(80); });
t(1303, async ({ page }) => { await start(page); await bomberNear(page); await page.waitForTimeout(1300); expect(await ev(page, () => game.orbs.length)).toBe(0); });
t(1304, async ({ page }) => {
  await start(page);
  const o = await ev(page, ([cx, cy]) => { const m = makeMonster('ghoul', cx + 300, cy); game.monsters.push(m); damageMonster(m, 999, game.players[0]); return game.orbs.map((x) => x.exp); }, [CX, CY]);
  expect(o).toEqual([5]);
});

// ---------------------------------------------------------------- B14 전리품
const lootOpen = async (page) => { await killBoss(page, 'boss'); await expect(page.locator('#choiceTitle')).toHaveText('P1 보스 전리품'); };
t(1401, async ({ page }) => { await start(page); await lootOpen(page); });
t(1402, async ({ page }) => { await start(page); await lootOpen(page); await expect(page.locator('#choiceCards .card')).toHaveCount(3, { timeout: 2000 }); });
for (const [n, from, to] of [[1403, 2, 4], [1404, 4, 5]]) t(n, async ({ page }) => {
  await start(page); await setBullet(page, { level: from }); await lootOpen(page);
  await card(page, '피스톨 희귀 강화 (+2)').click();
  expect(await ev(page, () => game.players[0].weapons.find((w) => w.type === 'bullet').level)).toBe(to);
});
for (const [n, hp, want] of [[1405, 30, 80], [1407, 90, 100]]) t(n, async ({ page }) => {
  await start(page); await ev(page, (h) => { game.players[0].hp = h; }, hp); await lootOpen(page);
  await card(page, '재정비').click();
  expect((await P(page)).hp).toBe(want);
});
t(1406, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']); await dmg(page, 1, 999); await lootOpen(page);
  await card(page, '재정비').click();
  const p2 = await P(page, 1); expect(p2.downed).toBe(false); expect(p2.hp).toBe(50);
});

// ---------------------------------------------------------------- B15 아이템 박스
t(1501, async ({ page }) => {
  await start(page);
  between(await ev(page, () => { for (let k = 0; k < 2000; k++) { const m = makeMonster('ghoul', 0, 0); damageMonster(m, 999, game.players[0]); } const n = game.boxes.length; game.boxes = []; game.orbs = []; return n; }), 70, 130);
});
t(1502, async ({ page }) => {
  await start(page);
  expect(await ev(page, () => { for (let k = 0; k < 300; k++) { const m = makeMonster('boss', 0, 0); damageMonster(m, 1e6, game.players[0]); } const n = game.boxes.length; game.orbs = []; return n; })).toBe(0);
});
t(1503, async ({ page }) => {
  await start(page);
  const c = await ev(page, () => {
    const p = game.players[0]; const c = { potion: 0, bomb: 0, magnet: 0 };
    for (let k = 0; k < 3000; k++) {
      p.hp = 50; p.magnetTimer = 0; game.screenFlash = 0; game.monsters = [];
      applyBoxEffect(p);
      if (p.hp > 50) c.potion++; else if (game.screenFlash > 0) c.bomb++; else if (p.magnetTimer > 0) c.magnet++;
    }
    p.hp = 100; p.magnetTimer = 0; return c;
  });
  for (const v of Object.values(c)) between(v, 900, 1100);
});
const bomb = (page, n) => ev(page, (n) => {
  const p = game.players[0]; for (let k = 0; k < n; k++) game.monsters.push(makeMonster('ghoul', p.x + 200 + k * 10, p.y));
  const real = Math.random; Math.random = () => 0.5; applyBoxEffect(p); Math.random = real;
  return { dead: game.monsters.filter((m) => m.dead).length, flash: game.screenFlash };
}, n);
t(1504, async ({ page }) => { await start(page); expect((await bomb(page, 4)).dead).toBe(4); });
t(1505, async ({ page }) => { await start(page); expect((await bomb(page, 1)).flash).toBeGreaterThan(0); });
t(1506, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']);
  await ev(page, () => { const b = game.players[1]; applyDamageToPlayer(b, 999); game.boxes.push({ x: b.x, y: b.y, r: 14 }); });
  await page.waitForTimeout(500);
  expect(await ev(page, () => game.boxes.length)).toBe(1);
});

// ---------------------------------------------------------------- B16 결과 창
['생존 시간', '총 처치 수', '평균 레벨', '결과'].forEach((lb, i) => t(1601 + i, async ({ page }) => {
  await start(page); await dmg(page, 0, 999);
  await expect(page.locator('#resultStats .l').nth(i)).toHaveText(lb);
}));
t(1605, async ({ page }) => {
  await start(page); await ev(page, () => { game.elapsed = 125; applyDamageToPlayer(game.players[0], 999); });
  await expect(page.locator('#resultStats .v').nth(0)).toHaveText('02:05');
});
t(1606, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']);
  await ev(page, () => { const [a, b] = game.players; a.level = 3; b.level = 4; applyDamageToPlayer(b, 999); applyDamageToPlayer(a, 999); });
  await expect(page.locator('#resultStats .v').nth(2)).toHaveText('Lv 4');
});
t(1607, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']); await dmg(page, 1, 999); await dmg(page, 0, 999);
  await page.click('#btnRetry');
  await expect(page.locator('#choiceTitle')).toHaveText('P1 주무기 선택');
  await card(page, '피스톨').click();
  await expect(page.locator('#choiceTitle')).toHaveText('P2 주무기 선택');
});
t(1608, async ({ page }) => {
  await start(page); await ev(page, () => { game.kills = 7; applyDamageToPlayer(game.players[0], 999); });
  await expect(page.locator('#resultStats .v').nth(1)).toHaveText('7');
});

// ---------------------------------------------------------------- B17 온라인 (가짜 연결)
function BF_FAKE_PEER() {
  window.__peers = [];
  class FakeConn {
    constructor(code) { this.code = code; this.open = false; this.h = {}; this.sent = []; this.closed = false; }
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); }
    emit(e, ...a) { (this.h[e] || []).forEach((f) => f(...a)); }
    send(o) { this.sent.push(o); }
    close() { if (this.closed) return; this.closed = true; this.open = false; this.emit('close'); }
  }
  class FakePeer {
    constructor(id) { this.id = id; this.h = {}; this.destroyed = false; this.conns = []; window.__peers.push(this); }
    on(e, f) { (this.h[e] = this.h[e] || []).push(f); }
    emit(e, ...a) { (this.h[e] || []).forEach((f) => f(...a)); }
    connect(code) { const c = new FakeConn(code); this.conns.push(c); window.__conn = c; return c; }
    destroy() { this.destroyed = true; }
  }
  window.__FakeConn = FakeConn;
  window.Peer = FakePeer;
}
async function online(page, { block = false, clock = false } = {}) {
  await page.route(/peerjs/, (r) => (block ? r.abort() : r.fulfill({ body: '/* 가짜 Peer 사용 */', contentType: 'application/javascript' })));
  if (!block) await page.addInitScript(BF_FAKE_PEER);
  if (clock) await page.clock.install();
  await page.goto(URL);
}
const peerDo = (page, fn, arg) => page.evaluate(([f, a]) => (0, eval)(f)(window.__peers[window.__peers.length - 1], a), [fn.toString(), arg]);
const net = (page) => page.locator('#netStatus');
async function joinBF(page, code = 'ABCD', opts) { await online(page, opts); await page.click('#btnJoinShow'); await page.fill('#joinCodeInput', code); await page.click('#btnJoinGo'); }
t(1701, async ({ page }) => { await online(page); await page.click('#btnHost'); await expect(net(page)).toHaveText('방을 여는 중...'); });
t(1702, async ({ page }) => {
  await online(page); await page.click('#btnHost'); await peerDo(page, (p) => p.emit('open'));
  await expect(page.locator('#netStatus .room-code')).toHaveText(/^[A-Z2-9]{4}$/);
});
t(1703, async ({ page }) => {
  await page.goto(URL);
  expect(await ev(page, () => { let bad = 0; for (let k = 0; k < 1000; k++) if (/[0O1I]/.test(makeRoomCode())) bad++; return bad; })).toBe(0);
});
t(1704, async ({ page }) => { await online(page, { clock: true }); await page.click('#btnHost'); await page.clock.runFor(11900); await expect(net(page)).not.toContainText('시간 초과'); });
t(1705, async ({ page }) => {
  await online(page, { clock: true }); await page.click('#btnHost'); await page.clock.runFor(12100);
  await expect(net(page)).toContainText('연결 서버에 접속하지 못했습니다 (시간 초과). 인터넷 연결을 확인해주세요.');
});
t(1706, async ({ page }) => {
  await online(page); await page.click('#btnHost'); await peerDo(page, (p) => p.emit('error', { type: 'server-error' }));
  await expect(net(page)).toContainText('연결 오류가 발생했습니다 (server-error).');
});
t(1707, async ({ page }) => { await joinBF(page); await expect(net(page)).toHaveText('연결하는 중...'); });
t(1708, async ({ page }) => { await joinBF(page, 'abcd'); await peerDo(page, (p) => p.emit('open')); expect(await peerDo(page, (p) => p.conns[0].code)).toBe('bloodfall-ABCD'); });
t(1709, async ({ page }) => {
  await joinBF(page); await peerDo(page, (p) => p.emit('open'));
  await peerDo(page, (p) => { p.conns[0].open = true; p.conns[0].emit('open'); });
  await expect(net(page)).toHaveText('호스트에 연결됨. 게임 시작을 기다리는 중...');
});
t(1710, async ({ page }) => {
  await joinBF(page); await peerDo(page, (p) => p.emit('error', { type: 'peer-unavailable' }));
  await expect(net(page)).toContainText('해당 방 코드를 찾을 수 없습니다. 코드를 다시 확인해주세요.');
});
t(1711, async ({ page }) => {
  await joinBF(page); await peerDo(page, (p) => p.emit('error', { type: 'peer-unavailable' }));
  await expect(net(page).getByRole('button', { name: '다시 시도' })).toBeVisible();
});
t(1712, async ({ page }) => {
  await joinBF(page, 'ABCD', { clock: true }); await page.clock.runFor(12100);
  await expect(net(page)).toContainText('연결 시간이 초과됐습니다. 방 코드와 인터넷 연결을 확인해주세요.');
});
t(1713, async ({ page }) => {
  await online(page, { block: true }); await page.click('#btnHost');
  await expect(net(page)).toHaveText('P2P 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침 해주세요.');
});
async function hostGame(page) {
  await online(page); await page.click('#btnHost'); await peerDo(page, (p) => p.emit('open'));
  await ev(page, () => { const c = new window.__FakeConn('guest'); c.open = true; window.__conn = c; window.__peers[0].emit('connection', c); c.emit('open'); });
}
t(1714, async ({ page }) => {
  await hostGame(page);
  await ev(page, () => window.__conn.close());
  await expect(page.getByText('상대방과의 연결이 끊어졌습니다.')).toBeVisible({ timeout: 2000 });
});
t(1715, async ({ page }) => { await hostGame(page); await expect(page.locator('#choiceTitle')).toHaveText('P1 주무기 선택'); });

// ---------------------------------------------------------------- B18 카메라
t(1801, async ({ page }) => {
  await start(page, 'coop', ['피스톨', '피스톨']);
  await ev(page, ([cx, cy]) => { game.players[0].x = cx - 200; game.players[1].x = cx + 200; game.players[0].y = game.players[1].y = cy; }, [CX, CY]);
  await page.waitForTimeout(2000);
  expect(await ev(page, () => game.camera.x)).toBeCloseTo(CX, -1);
});
t(1802, async ({ page }) => {
  await start(page); await ev(page, () => { game.players[0].x = 0; });
  await page.waitForTimeout(2000);
  expect(await ev(page, () => game.camera.x)).toBe(450);
});
