---
name: playwright-e2e-testing
description: "使用 Playwright 設計、撰寫、執行與除錯 Web 應用程式端對端測試。當需要跨瀏覽器測試、使用者流程驗證、表單互動、登入狀態、網路攔截、視覺回歸、CI 測試或修復不穩定 E2E 測試時使用。"
---

# Playwright E2E Testing

使用 Playwright 建立可靠、可維護、可在本機與 CI 執行的端對端測試。這份技能適用於任何 AI 助手或模型；不要假設特定 IDE、代理框架、CLI 外掛或模型能力存在。先根據專案現況判斷，再採取最小必要變更。

## 使用時機

在以下情境使用：

- 需要為 Web 應用程式撰寫端對端測試。
- 需要驗證登入、註冊、購物車、結帳、儀表板、管理後台等使用者流程。
- 需要跨 Chromium、Firefox、WebKit 或手機裝置測試。
- 需要測試表單、導覽、彈窗、檔案上傳、鍵盤操作或拖放。
- 需要攔截、模擬或等待 API 請求。
- 需要截圖比對、錄影、trace viewer 或 UI mode 協助除錯。
- 需要修復 flaky test、改善 selector、建立 Page Object Model 或整合 CI。

## 工作流程

1. 先檢查專案是否已安裝 Playwright、測試目錄、設定檔與 package scripts。
2. 確認啟動開發伺服器的指令、base URL、測試帳號與必要環境變數。
3. 優先補上高價值使用者流程測試，而不是只測單一靜態元素。
4. 使用可存取性 locator，例如 getByRole、getByLabel、getByText，少用脆弱 CSS 或 XPath。
5. 依賴 Playwright auto-wait 與 web-first assertions，不使用固定等待時間解決同步問題。
6. 讓測試彼此隔離，可以平行執行；避免共用會互相污染的帳號、資料或瀏覽器狀態。
7. 執行目標測試，若失敗，使用 trace、影片、截圖與錯誤訊息定位原因。
8. 完成後回報新增或修改的測試、執行指令、結果，以及任何無法驗證的前提。

## 安裝與初始化

若專案尚未使用 Playwright：

~~~bash
npm init playwright@latest
~~~

若要加入既有專案：

~~~bash
npm install -D @playwright/test
npx playwright install
~~~

在 CI 或 Linux 容器中通常需要：

~~~bash
npx playwright install --with-deps
~~~

若專案使用 pnpm、yarn 或 bun，依照既有 lockfile 與 scripts 改用相同套件管理器，不要混用。

## 基本設定

~~~ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],

  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
~~~

調整設定時要符合專案：

- 若開發指令是 npm run dev、pnpm dev 或其他名稱，使用專案現有 script。
- 若應用程式需要 build 後啟動，CI 可使用 npm run build 加 npm run start。
- 若後端或資料庫也要啟動，確認測試環境可重現，不要依賴開發者本機隱性狀態。

## 測試結構

~~~ts
import { test, expect } from '@playwright/test';

test.describe('登入流程', () => {
  test('使用正確帳密可以登入並看到儀表板', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(//dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('使用錯誤帳密會顯示錯誤訊息', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('bad-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByRole('alert')).toContainText('Invalid credentials');
  });
});
~~~

## Locator 策略

優先順序：

1. page.getByRole：最接近使用者與無障礙語意，通常最穩定。
2. page.getByLabel：表單欄位首選。
3. page.getByText：適合穩定且使用者可見的文字。
4. page.getByTestId：適合動態內容、重複元件或文字會被翻譯的介面。
5. page.locator：用於結構性選取或專案已有穩定 selector。
6. XPath：只有在沒有更好選擇時才使用。

~~~ts
await page.getByRole('button', { name: 'Submit' }).click();
await page.getByLabel('Email').fill('user@example.com');
await page.getByPlaceholder('Search').fill('invoice');
await page.getByTestId('user-menu').click();
~~~

避免：

~~~ts
await page.click('div > form > div:nth-child(3) > button');
await page.locator('.btn.primary.large').click();
await page.waitForTimeout(2000);
~~~

## Page Object Model

當同一組頁面操作在多個測試中重複，使用 Page Object Model。不要為只用一次的小流程過度抽象。

~~~ts
// tests/pages/LoginPage.ts
import { expect, type Locator, type Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Log in' });
    this.errorAlert = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string) {
    await expect(this.errorAlert).toContainText(message);
  }
}
~~~

~~~ts
// tests/auth.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

test('可以登入', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login('user@example.com', 'password123');

  await expect(page).toHaveURL(//dashboard$/);
});
~~~

## 使用者互動

~~~ts
test('表單互動', async ({ page }) => {
  await page.goto('/settings');

  await page.getByLabel('Display name').fill('Ada Lovelace');
  await page.getByLabel('Subscribe').check();
  await page.getByRole('radio', { name: 'Public' }).check();
  await page.getByLabel('Country').selectOption('TW');
  await page.getByLabel('Avatar').setInputFiles('fixtures/avatar.png');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('status')).toContainText('Saved');
});
~~~

鍵盤與滑鼠互動：

~~~ts
await page.getByRole('textbox', { name: 'Search' }).press('Control+A');
await page.keyboard.type('playwright');
await page.getByText('More options').hover();
await page.dragAndDrop('[data-testid="card-a"]', '[data-testid="column-done"]');
~~~

## 等待與斷言

優先使用 Playwright 的 web-first assertions：

~~~ts
await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
await expect(page.getByTestId('order-row')).toHaveCount(3);
await expect(page).toHaveURL(//orders$/);
await expect(page).toHaveTitle(/Orders/);
~~~

只在必要時明確等待：

~~~ts
await page.waitForURL('**/dashboard');
await page.waitForLoadState('domcontentloaded');

const responsePromise = page.waitForResponse('**/api/orders');
await page.getByRole('button', { name: 'Load orders' }).click();
const response = await responsePromise;
expect(response.ok()).toBeTruthy();
~~~

避免以 waitForTimeout 掩蓋競態問題。若必須使用，註明原因並保持極小範圍。

## 登入與狀態管理

對需要登入的測試，優先使用 storage state，避免每個測試重複登入。

~~~ts
// tests/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('建立登入狀態', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL ?? 'user@example.com');
  await page.getByLabel('Password').fill(process.env.E2E_USER_PASSWORD ?? 'password123');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page).toHaveURL(//dashboard$/);
  await page.context().storageState({ path: authFile });
});
~~~

安全要求：

- 不要把真實密碼、token 或 production 帳號寫進測試。
- 使用測試專用帳號與環境變數。
- CI 的 secrets 必須由平台管理。
- 測試資料要可重建、可清除、可平行。

## 網路攔截與 API 模擬

~~~ts
test('模擬使用者清單 API', async ({ page }) => {
  await page.route('**/api/users', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        users: [
          { id: 1, name: 'Ada Lovelace' },
          { id: 2, name: 'Grace Hopper' },
        ],
      }),
    });
  });

  await page.goto('/users');
  await expect(page.getByText('Ada Lovelace')).toBeVisible();
});
~~~

模擬錯誤狀態：

~~~ts
await page.route('**/api/report', route => route.abort('failed'));
await page.goto('/report');
await expect(page.getByRole('alert')).toContainText('Unable to load report');
~~~

使用原則：

- E2E 測試應保留少量真正整合測試，驗證前後端合約。
- 對第三方 API、慢速服務、不穩定服務可使用 mock。
- mock 要貼近實際 response schema，避免測出不存在的世界。

## 視覺回歸測試

~~~ts
test('儀表板畫面沒有意外變化', async ({ page }) => {
  await page.goto('/dashboard');

  await expect(page).toHaveScreenshot('dashboard.png', {
    fullPage: true,
    mask: [page.getByTestId('current-time')],
  });
});
~~~

視覺測試注意事項：

- 遮罩時間、亂數、動畫、個人頭像等動態元素。
- 固定 viewport、字體、測試資料與瀏覽器版本。
- 不要把大範圍截圖比對用在高度動態頁面。
- 更新 snapshot 前先確認差異是預期變更。

## 測試組織

建議結構：

~~~text
tests/
  auth.setup.ts
  auth.spec.ts
  checkout.spec.ts
  pages/
    LoginPage.ts
    CheckoutPage.ts
  fixtures/
    users.ts
    test-data.ts
playwright.config.ts
~~~

標籤與篩選：

~~~ts
test('首頁 smoke test', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
});
~~~

~~~bash
npx playwright test --grep @smoke
npx playwright test --grep-invert @slow
~~~

## Flaky Test 處理

優先檢查：

- selector 是否依賴樣式或 DOM 結構。
- 是否用了固定等待時間。
- 是否測試資料被其他測試污染。
- 是否多個測試共用同一帳號或同一筆資料。
- 是否沒有等待導航、API 回應或 UI 狀態完成。
- 是否 animation、timestamp、timezone、localStorage 或 cache 造成不穩定。

修復策略：

- 改用 role、label、test id 等穩定 locator。
- 用 expect(...).toBeVisible、toHaveURL、waitForResponse 表達等待條件。
- 產生唯一測試資料，例如 user-[timestamp]@example.test。
- 每個測試清理自己建立的資料。
- 只對已知外部不穩定因素使用 retry，不用 retry 掩蓋真實 bug。

## 除錯

常用指令：

~~~bash
npx playwright test
npx playwright test tests/auth.spec.ts
npx playwright test --headed
npx playwright test --debug
npx playwright test --ui
npx playwright show-report
npx playwright show-trace trace.zip
~~~

## CI 整合

GitHub Actions 範例：

~~~yaml
name: Playwright Tests

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Run Playwright tests
        run: npx playwright test

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
~~~

## 最佳實務

- 測使用者看得見、做得到的行為，不測框架內部實作。
- 優先使用 semantic locator，讓測試同時推動無障礙品質。
- 對核心路徑寫完整 E2E，對細節邏輯交給單元測試或整合測試。
- 不把每個測試都寫成長劇本；共用流程抽成 Page Object 或 fixture。
- 測試名稱描述使用者行為與期望結果。
- 保持測試可平行、可重跑、可在乾淨環境成功。
- 失敗時保留 trace、截圖、影片與 HTML report。
- CI 先跑 smoke 或核心流程，完整矩陣可放在 nightly 或 release gate。

## 反模式

避免：

- 用 waitForTimeout 當作同步機制。
- 用 CSS class、DOM 深層結構或 nth-child 當主要 selector。
- 測試依賴 production 資料或真實第三方服務。
- 多個測試共用會互相修改的帳號或資料。
- 每個測試都從 UI 登入，導致慢且不穩。
- 為了通過測試而降低產品可用性或可存取性。
- 大量 snapshot 卻沒有審查差異。
- 只在本機跑得過，CI 缺少瀏覽器、字體、環境變數或服務啟動步驟。

## 完成前檢查

交付前確認：

- 已使用專案既有套件管理器與測試慣例。
- 測試涵蓋真實高價值流程。
- locator 穩定且接近使用者語意。
- 測試可以單獨執行，也可以與其他測試平行執行。
- 沒有硬編碼秘密、production 帳號或脆弱時間假設。
- 本機或可用環境已執行相關測試。
- 若無法執行，已清楚說明原因與建議指令。

## 回覆格式

完成任務後簡短回報：

- 新增或修改了哪些測試與設定。
- 執行了哪些 Playwright 指令。
- 測試結果是通過、失敗或未能執行。
- 若有失敗，列出最可能原因與下一步。