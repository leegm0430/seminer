// Playwright 설정 — 무료 오픈소스, 로컬 크로미움으로만 실행한다.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  outputDir: './out/test-results',     // 실패 스크린샷·영상 (git에 올리지 않음)
  timeout: 90_000,                     // 게임오버까지 쌓는 테스트가 있어 넉넉히
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,                          // 물리 엔진이 실제 시간으로 돌아서 한 번에 하나씩
  retries: 0,                          // 재시도로 실패를 숨기지 않는다
  reporter: [
    ['list'],
    ['json', { outputFile: 'out/results.json' }],
    ['html', { outputFolder: 'out/playwright-report', open: 'never' }],
  ],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
