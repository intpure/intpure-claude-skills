# Scoring Rubric — 安全評分表

## 評分邏輯

從 **100 分**開始扣。最低 0 分。

---

## 扣分規則

### 🔴 S1 供應鏈攻擊（最高 -30）

| 發現 | 扣分 |
|---|---|
| postinstall/preinstall 執行 curl\|bash（明確惡意） | -30 |
| postinstall/preinstall 有網路下載 + 執行（含混淆） | -20 |
| postinstall/preinstall 存在但內容無害 | -5 |
| install script 下載遠端二進位執行 | -20 |
| git+ssh 或 tarball 依賴（非 registry） | -10 |
| lifecycle script 指向外部 URL | -15 |

### 🔴 S2 RCE / 命令執行（最高 -25）

| 發現 | 扣分 |
|---|---|
| eval/exec 接受外部輸入（user/network/file） | -25 |
| eval/exec 使用固定字串（無外部輸入） | -5 |
| subprocess.run/os.system 含外部輸入 | -20 |
| spawn 接受外部參數 | -15 |
| child_process 用於 shell injection 可能路徑 | -15 |
| vm.runInThisContext 用於動態執行 | -10 |

### 🔴 S3 資料洩漏 / 硬編碼密鑰（最高 -20）

| 發現 | 扣分 |
|---|---|
| 硬編碼 API token/private key（明文） | -20 |
| BEGIN PRIVATE KEY block 存在 | -20 |
| AWS AKIA* key 硬編碼 | -20 |
| Webhook URL 內含 token（Discord/Slack/TG） | -15 |
| 變數名含 secret/token 但值是 placeholder | -2 |
| 從 env 讀密鑰（正常做法，但需確認無外傳） | 0 |

### 🟠 S4 敏感本機資料存取（最高 -15）

| 發現 | 扣分 |
|---|---|
| 讀取 ~/.ssh/id_rsa 或同類 SSH key | -15 |
| 讀取 ~/.aws/credentials | -15 |
| 讀取瀏覽器 Cookies/Login Data | -15 |
| 讀取加密錢包檔案 | -15 |
| 讀取 ~/.npmrc / ~/.pypirc（含 token） | -10 |
| 讀取後加傳送至外部（組合漏洞） | 額外 -10 |

### 🟠 S5 外部資料傳送（最高 -15）

| 發現 | 扣分 |
|---|---|
| fetch/axios 傳送至未知非官方域名 | -15 |
| 含遙測/analytics 追蹤（Sentry/Datadog/Mixpanel）但有 opt-out | -5 |
| 含遙測無 opt-out | -10 |
| DNS lookup 至外部（可能 C2） | -10 |

### 🟠 S6 Container / CI（最高 -15）

| 發現 | 扣分 |
|---|---|
| GitHub Actions 外部 action 無版本鎖定 | -10 |
| Docker RUN curl\|bash | -15 |
| docker-compose privileged: true | -10 |
| 掛載 /var/run/docker.sock | -10 |
| secrets 直接傳入 ENV（明文） | -15 |
| USER root 無後續切換 | -5 |

### 🟡 S7 常見漏洞（最高 -10）

| 發現 | 扣分 |
|---|---|
| SQL Injection 可能（動態拼 SQL + 外部輸入） | -10 |
| Path Traversal 可能（../） | -8 |
| XSS 可能（innerHTML = user input） | -8 |
| SSRF 可能（fetch user-controlled URL） | -8 |
| 任意檔案上傳無驗證 | -8 |

---

## 加分項目

| 發現 | 加分 |
|---|---|
| 有 SECURITY.md + vulnerability disclosure policy | +5 |
| 依賴鎖定（package-lock.json / poetry.lock 等） | +3 |
| 有 CI 安全掃描（CodeQL / Dependabot / OSSF Scorecard） | +3 |
| 有活躍維護信號（近 6 個月有 commit） | +2 |

---

## 閾值與建議

| 分數 | 判定 | 對借用規則的建議 |
|---|---|---|
| ≥ 75 | ✅ 可收藏 | 正常流程進 tech-analysis |
| 60–74 | ⚠️ 有條件收藏 | 需修補高/中風險問題後再收，或限定使用範圍 |
| < 60 | ❌ 不建議收藏 | 風險過高，除非 Jill 明確裁量 |

**無 license repo 額外規則（雙重閘門）**：
- 可收的前提：**score ≥ 75** 且 **零 🔴 高危命中**（包含輕微的 🔴 項目，例如 postinstall 存在但無害 -5 也算命中）
- 只達到其中一個條件不夠：score ≥ 75 但有任何 🔴 命中 → 降為「有條件收藏」
- 零 🔴 命中但 score < 75 → 依分數區間判定（60-74 = 有條件，<60 = 不收）

---

## 計算範例

初始：100
- postinstall 存在但內容無害：-5 → 95
- eval 用於固定字串模板：-5 → 90
- fetch 至官方 CDN：0 → 90
- 無 SECURITY.md：0（非加分）
- 有 package-lock.json：+3 → 93

**結果：93/100 ✅ 可收藏**
