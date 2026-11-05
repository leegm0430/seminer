// 기밀 경로의 고정 실행기: AI가 쓴 코드를 실행하지 않고, 정해진 조작(누르기·입력·키)과 판정만 한다.
// 사용 (secure_tc.py가 부른다):
//   node tools/local_runner.cjs scan <게임.html> <요소목록.json>
//   node tools/local_runner.cjs run  <게임.html> <계획.json> <결과.json> <스크린샷 폴더>
// 게임 페이지의 외부 통신은 막는다 (file: data: blob: 만 허용). 화면에는 건수만 출력한다.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('@playwright/test');

const CLICK_MS = 2500;
const CHECK_MS = 1500;

async function openPage(browser, url, counters) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.route('**/*', route => {
    const u = route.request().url();
    if (/^(file|data|blob):/.test(u)) return route.continue();
    counters.blocked += 1;
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 15000 });
  return { context, page };
}

// 페이지 안에서 조작할 수 있는 요소를 모은다 (숨은 화면의 요소 포함)
function collect() {
  const out = [];
  const nodes = document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[onclick]');
  for (const el of nodes) {
    const tag = el.tagName.toLowerCase();
    const text = (el.innerText || el.textContent || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const id = el.id || '';
    if (!id && !text) continue;
    if (!id && /["\\]/.test(text)) continue;
    out.push({ tag, text, sel: id ? `[id="${id.replace(/"/g, '\\"')}"]` : `${tag}:text-is("${text}")` });
  }
  return { elements: out, canvas: document.querySelectorAll('canvas').length };
}

async function scan(gamePath, outPath) {
  const url = pathToFileURL(gamePath).href;
  const counters = { blocked: 0 };
  const browser = await chromium.launch();
  const found = new Map();
  let canvas = 0;
  const add = r => { canvas = Math.max(canvas, r.canvas); for (const e of r.elements) if (!found.has(e.sel)) found.set(e.sel, e); };
  const first = await openPage(browser, url, counters);
  add(await first.page.evaluate(collect));
  await first.context.close();
  // 버튼을 한 번씩 눌러 그때 새로 생기는 요소도 찾는다 (한 단계, 최대 15개)
  for (const e of [...found.values()].slice(0, 15)) {
    const s = await openPage(browser, url, counters);
    try {
      await s.page.locator(e.sel).first().click({ timeout: 800 });
      add(await s.page.evaluate(collect));
    } catch { /* 숨었거나 눌리지 않는 요소 */ }
    await s.context.close();
  }
  await browser.close();
  fs.writeFileSync(outPath, JSON.stringify({ elements: [...found.values()], canvas, blocked: counters.blocked }), 'utf8');
  console.log(`  화면 요소 ${found.size}개 · canvas ${canvas}개 · 막은 외부 요청 ${counters.blocked}건`);
}

async function holds(page, check) {
  if (check.kind === 'text_visible' || check.kind === 'text_hidden') {
    const visible = await page.getByText(check.text).filter({ visible: true }).count() > 0;
    return check.kind === 'text_visible' ? visible : !visible;
  }
  const loc = page.locator(check.sel).first();
  if (await loc.count() === 0) return false;
  const enabled = await loc.isEnabled();
  return check.kind === 'enabled' ? enabled : !enabled;
}

async function holdsWithin(page, check) {
  const end = Date.now() + CHECK_MS;
  for (;;) {
    if (await holds(page, check)) return true;
    if (Date.now() > end) return false;
    await page.waitForTimeout(100);
  }
}

async function runOne(browser, url, plan, shotDir, counters) {
  const { context, page } = await openPage(browser, url, counters);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 200)));
  const r = { id: plan.id, status: 'passed', detail: '', screenshot: '', errors };
  try {
    const before = await holds(page, plan.check);
    for (const [i, a] of plan.actions.entries()) {
      for (let n = 0; n < a.repeat; n += 1) {
        try {
          const loc = page.locator(a.sel).first();
          if (a.do === 'fill') await loc.fill(a.value, { timeout: CLICK_MS });
          else if (a.do === 'press') await page.keyboard.press(a.value);
          else await loc.click({ timeout: CLICK_MS });
        } catch {
          r.status = 'blocked';
          r.detail = `${i + 1}번째 조작(${n + 1}회째)을 할 수 없음`;
          break;
        }
      }
      if (r.status === 'blocked') break;
    }
    if (r.status !== 'blocked') {
      if (await holdsWithin(page, plan.check)) {
        // 조작 전에도 이미 맞았다면 조작 결과를 판정했다고 볼 수 없다
        if (before && plan.actions.length) { r.status = 'weak'; r.detail = '조작 전에도 같은 상태 — 판정이 약함'; }
      } else {
        r.status = 'failed';
        r.detail = '기대한 상태가 아님';
      }
    }
  } catch (e) {
    r.status = 'blocked';
    r.detail = '실행 오류';
  }
  if (r.status === 'failed' || r.status === 'blocked') {
    const shot = path.join(shotDir, `${plan.id}.png`);
    await page.screenshot({ path: shot }).catch(() => {});
    if (fs.existsSync(shot)) r.screenshot = path.basename(shot);
  }
  await context.close();
  return r;
}

async function run(gamePath, planPath, outPath, shotDir) {
  const url = pathToFileURL(gamePath).href;
  const plans = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  fs.mkdirSync(shotDir, { recursive: true });
  const counters = { blocked: 0 };
  const browser = await chromium.launch();
  const results = [];
  for (const plan of plans) results.push(await runOne(browser, url, plan, shotDir, counters));
  await browser.close();
  fs.writeFileSync(outPath, JSON.stringify({ results, blocked: counters.blocked }, null, 1), 'utf8');
}

const [mode, ...rest] = process.argv.slice(2);
const job = mode === 'scan' ? scan(rest[0], rest[1]) : mode === 'run' ? run(rest[0], rest[1], rest[2], rest[3]) : Promise.reject(new Error('scan 또는 run'));
job.catch(e => { console.error('실행기 오류:', String(e.message || e).split('\n')[0].slice(0, 120)); process.exit(1); });
