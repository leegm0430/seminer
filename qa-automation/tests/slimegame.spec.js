// 슬라임 게임 자동 테스트
// - 테스트 이름 앞의 [공통-N]/[플레이-N]은 TC/슬라임게임_TC.xlsx의 번호다.
// - 게임 코드는 즉시 실행 함수 안에 있어 내부 값을 읽을 수 없다. 화면에 보이는 값(점수·다음 슬라임 이름·결과 창)으로만 판정한다.
// - 다음 슬라임은 Math.random으로 정해진다. 테스트마다 Math.random을 정해진 순서로 바꿔 결과를 매번 같게 만든다.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const TARGET = process.env.SLIME_TARGET || path.resolve(__dirname, '..', '..', 'slimegame.html');
const URL = pathToFileURL(TARGET).href;

const STAGE_NAMES = ['방울 슬라임', '미니 쁘띠 슬라임', '초록 슬라임', '블루 슬라임', '옐로우 큐브 슬라임'];
// Math.floor(v * 5) 가 원하는 단계가 되도록 고른 값
const STAGE_VALUE = [0.01, 0.21, 0.41, 0.61, 0.81];
const COOLDOWN_MS = 420;

/** 다음에 나올 슬라임 단계를 순서대로 고정한다.
 *  페이지를 불러오는 동안 외부 라이브러리도 Math.random을 쓰므로, 로드가 끝난 뒤 솔로 시작 직전에 바꾼다. */
async function fixRandom(page, stages) {
  const values = stages.map(s => STAGE_VALUE[s]);
  await page.evaluate((vals) => {
    let i = 0;
    Math.random = () => vals[i++ % vals.length];
  }, values);
}

/** 페이지 오류·콘솔 오류를 모은다. */
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}

async function openSolo(page, stages) {
  await page.goto(URL);
  if (stages) await fixRandom(page, stages);
  await page.click('#btn-solo');
  await expect(page.locator('#screen-solo')).toBeVisible();
  await page.locator('#canvas-solo').hover();
}

const nextName = (page) => page.locator('#solo-next-name');

// ---------------------------------------------------------------- 메뉴·화면 전환

test('[공통-7] 타이틀·서브 카피 노출', async ({ page }) => {
  await page.goto(URL);
  await expect(page.locator('h1')).toHaveText('슬라임 게임');
  await expect(page.locator('h1 + p')).toContainText('킹 슬라임');
});

test('[공통-8] 솔로 모드 진입 시 새 보드 초기화', async ({ page }) => {
  await openSolo(page);
  await expect(page.locator('#screen-menu')).toBeHidden();
  await expect(page.locator('#solo-score')).toHaveText('0');
  await expect(page.locator('#solo-chain .chain-item')).toHaveCount(11);
  await expect(page.locator('#solo-chain .chain-item.reached')).toHaveCount(0);
});

test('[공통-10] ← 메뉴로 링크로 메인 메뉴 복귀', async ({ page }) => {
  await openSolo(page);
  await page.click('#solo-back');
  await expect(page.locator('#screen-menu')).toBeVisible();
  await expect(page.locator('#screen-solo')).toBeHidden();
});

test('[공통-9] 멀티 모드 진입 시 방 만들기 탭 기본 활성', async ({ page }) => {
  await page.goto(URL);
  await page.click('#btn-multi');
  await expect(page.locator('#screen-multi-setup')).toBeVisible();
  await expect(page.locator('#panel-host')).toBeVisible();
  await expect(page.locator('#panel-join')).toBeHidden();
});

test('[플레이-24] [참가하기] 탭 전환 시 입력창 노출', async ({ page }) => {
  await page.goto(URL);
  await page.click('#btn-multi');
  await page.click('#tab-join');
  await expect(page.locator('#panel-join')).toBeVisible();
  await expect(page.locator('#join-input')).toBeVisible();
  await expect(page.locator('#panel-host')).toBeHidden();
});

test('[플레이-26] 빈 코드로 [연결하기] 시 안내 문구', async ({ page }) => {
  await page.goto(URL);
  await page.click('#btn-multi');
  await page.click('#tab-join');
  await page.fill('#join-input', '   ');
  await page.click('#join-btn');
  await expect(page.locator('#multi-status')).toHaveText('방 코드를 입력해주세요.');
});

test('[공통-11] 데스크톱(720px 초과) 모드 카드 가로 배치', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(URL);
  const solo = await page.locator('#btn-solo').boundingBox();
  const multi = await page.locator('#btn-multi').boundingBox();
  expect(Math.abs(solo.y - multi.y)).toBeLessThan(2);   // 같은 줄
  expect(multi.x).toBeGreaterThan(solo.x + solo.width - 1); // 오른쪽에
});

test('[공통-12] 모바일(720px 이하) 모드 카드 세로 배치', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  const solo = await page.locator('#btn-solo').boundingBox();
  const multi = await page.locator('#btn-multi').boundingBox();
  expect(multi.y).toBeGreaterThanOrEqual(solo.y + solo.height - 1); // 아래 줄
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollW).toBeLessThanOrEqual(390);                          // 가로 잘림 없음
});

// ---------------------------------------------------------------- 실행 환경

test('[공통-3] 물리 엔진 로드 후 콘솔 오류 없음', async ({ page }) => {
  const errors = collectErrors(page);
  await openSolo(page, [0, 1, 2]);
  expect(await page.evaluate(() => typeof window.Matter)).toBe('object');
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(COOLDOWN_MS + 80);
  }
  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

test('[공통-5] 외부 스크립트 차단 시 흰 화면 없이 메뉴 유지', async ({ page }) => {
  const errors = collectErrors(page);
  await page.route(/cdnjs\.cloudflare\.com/, route => route.abort());
  await page.goto(URL);
  await expect(page.locator('h1')).toHaveText('슬라임 게임'); // 흰 화면 아님
  await page.click('#btn-solo');
  await expect(page.locator('#screen-menu')).toBeVisible();              // 크래시 없이 메뉴에 머묾
  expect(errors.some(e => /Matter/.test(e))).toBeTruthy();              // 원인은 콘솔 오류로만 남음
});

// ---------------------------------------------------------------- 드롭

test('[플레이-4][플레이-6] 스페이스바로 드롭, 다음 슬라임 정보 갱신', async ({ page }) => {
  await openSolo(page, [0, 1, 2, 3, 4]);
  await expect(nextName(page)).toHaveText(STAGE_NAMES[0]);
  await page.keyboard.press('Space');
  await expect(nextName(page)).toHaveText(STAGE_NAMES[1]);
  await expect(page.locator('#solo-next-swatch')).toHaveCSS('background-color', 'rgb(255, 179, 209)'); // #FFB3D1
});

test('[플레이-3] 캔버스 클릭으로 드롭', async ({ page }) => {
  await openSolo(page, [0, 1, 2, 3, 4]);
  await page.locator('#canvas-solo').click({ position: { x: 190, y: 60 } });
  await expect(nextName(page)).toHaveText(STAGE_NAMES[1]);
});

test('[플레이-5] 드롭 쿨다운(0.42초) 내 추가 입력 무시', async ({ page }) => {
  await openSolo(page, [0, 1, 2, 3, 4]);
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');            // 0.42초 안의 두 번째 입력
  await page.waitForTimeout(100);
  await expect(nextName(page)).toHaveText(STAGE_NAMES[1]); // 한 번만 드롭됨
  await page.waitForTimeout(COOLDOWN_MS);
  await page.keyboard.press('Space');            // 쿨다운이 지난 뒤
  await expect(nextName(page)).toHaveText(STAGE_NAMES[2]);
});

// ---------------------------------------------------------------- 병합·점수

test('[플레이-7][플레이-8][플레이-10] 같은 단계 병합, 24점, 진화 체인 강조', async ({ page }) => {
  await openSolo(page, [0]);                     // 계속 1단계(방울)만 나오게
  await page.keyboard.press('Space');
  await page.waitForTimeout(COOLDOWN_MS + 600);  // 첫 슬라임이 바닥에 닿을 때까지
  await page.keyboard.press('Space');            // 같은 자리에 하나 더
  await expect(page.locator('#solo-score')).toHaveText('24', { timeout: 6000 }); // 2단계 점수 = 2*3/2*8
  await expect(page.locator('#solo-chain .chain-item').nth(1)).toHaveClass(/reached/);
});

// ---------------------------------------------------------------- 게임 오버 흐름

/** 가장 큰 낙하 단계(옐로우 큐브)를 계속 떨어뜨려 게임 오버를 만든다. */
async function playUntilGameOver(page) {
  const xs = [80, 190, 300];
  for (let i = 0; i < 120; i++) {
    if (await page.locator('#overlay-result').isVisible()) return;
    await page.mouse.move(0, 0);
    const box = await page.locator('#canvas-solo').boundingBox();
    await page.mouse.click(box.x + xs[i % xs.length] * box.width / 380, box.y + 40);
    await page.waitForTimeout(COOLDOWN_MS + 30);
  }
  throw new Error('120번 드롭해도 게임 오버가 나지 않음');
}

test('[플레이-16][플레이-12][공통-13][플레이-19] 게임 오버 → 최고 기록 → 결과 창 유지 → 다시하기', async ({ page }) => {
  await openSolo(page, [4]);

  await test.step('플레이-16 경고선을 넘겨 게임 오버', async () => {
    await playUntilGameOver(page);
    await expect(page.locator('#overlay-result')).toBeVisible();
    await expect(page.locator('#result-title')).toHaveText('게임 오버');
  });

  // 결과 창 점수 = 게임 오버 순간의 점수. (보드 점수는 탐색-1 버그 때문에 그 뒤에도 바뀔 수 있어 여기서는 쓰지 않는다)
  const score = await page.locator('#result-score').textContent();
  await test.step('플레이-12 최고 기록이 이번 점수로 갱신', async () => {
    expect(Number(score)).toBeGreaterThan(0);
    await expect(page.locator('#solo-best')).toHaveText(score);
  });

  await test.step('공통-13 Esc·바깥 클릭으로 닫히지 않음', async () => {
    await page.keyboard.press('Escape');
    await page.mouse.click(5, 5);
    await expect(page.locator('#overlay-result')).toBeVisible();
  });

  await test.step('플레이-19 다시하기 → 점수 0, 최고 기록 유지', async () => {
    await page.click('#result-retry');
    await expect(page.locator('#overlay-result')).toBeHidden();
    await expect(page.locator('#solo-score')).toHaveText('0');
    await expect(page.locator('#solo-best')).toHaveText(score);
  });
});

// 탐색 중 발견(2026-11-01): 기존 TC에 없는 항목이라 '탐색-1'로 추가.
// 게임 오버 뒤에도 물리 엔진이 멈추지 않아, 진행 중이던 병합 점수가 보드에만 더해진다(직접 재현 3회 중 2회).
// 매 판 생기지는 않으므로 최대 3판을 이어서 확인하고, 한 판이라도 어긋나면 실패로 본다.
test('[탐색-1] 게임 오버 뒤 보드 점수가 결과 창 점수와 같고 더 오르지 않음', async ({ page }) => {
  test.setTimeout(240_000);
  await openSolo(page, [4]);
  for (let game = 1; game <= 3; game++) {
    await playUntilGameOver(page);
    const result = await page.locator('#result-score').textContent();
    await page.waitForTimeout(3000);             // 남은 병합이 끝날 시간
    const board = await page.locator('#solo-score').textContent();
    expect(board, `${game}판째: 결과 창 ${result}점, 3초 뒤 보드 ${board}점`).toBe(result);
    await page.click('#result-retry');
  }
});

test('[플레이-20] 결과 창 [메뉴로]로 메인 메뉴 복귀', async ({ page }) => {
  await openSolo(page, [4]);
  await playUntilGameOver(page);
  await page.click('#result-menu');
  await expect(page.locator('#overlay-result')).toBeHidden();
  await expect(page.locator('#screen-menu')).toBeVisible();
});
