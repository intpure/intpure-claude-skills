---
name: github-security-audit
description: 靜態審查 GitHub repo 安全性，作為借用程式碼庫收藏前的安全閘門。輸出安全分數 0-100、風險清單、執行建議。觸發詞：「審查這個 repo」「這個專案安全嗎」「幫我看這個 GitHub 專案」「security audit」「借用前先查一下」「這個 open source 可以用嗎」「先確認安全再借用」時觸發。
---

# github-security-audit

對指定 GitHub repo 做靜態安全審查，作為 `/tech-analysis` 之前的安全閘門。

**不執行目標程式碼。不先 install 依賴。只做靜態讀取與分析。**

---

## 硬性規則

- 不執行 npm install / pip install / cargo build（除非已讀過安裝腳本確認安全）
- 不 clone 目標 repo（用 gh API 或 WebFetch 靜態讀取）
- 所有發現必須附檔案路徑 + 行號
- 不修改原始碼（除非 Jill 明確要求修補）
- 分析結束才給結論，中途不猜測

---

## 三階段工作流

### Phase 1: 探索（Explore）

**1a. 解析基本資訊**

```bash
# 從 URL 取出 owner/repo，查基本 metadata
gh api repos/{owner}/{repo} --jq '{name, description, default_branch, license, stars: .stargazers_count, archived, topics}'
```

**1b. 取完整目錄樹**

```bash
gh api repos/{owner}/{repo}/git/trees/{branch}?recursive=1 --jq '[.tree[].path]'
```

從目錄樹篩選高優先度檔案（詳見 `references/fetch-strategy.md`）：
- **必讀（Pass 1）**：package.json, requirements.txt, go.mod, Cargo.toml, pyproject.toml, Gemfile, composer.json, pom.xml
- **必讀（Pass 1）**：鎖定檔 package-lock.json, pnpm-lock.yaml, yarn.lock, poetry.lock
- **必讀（Pass 1）**：.github/workflows/*.yml, Dockerfile*, docker-compose*.yml
- **必讀（Pass 1）**：README.md, README*, INSTALL*, setup.py, setup.sh, Makefile
- **Pass 2（若 Pass 1 有風險才展開）**：*.sh, *.ps1, *.py, *.js, *.ts 等主要程式碼

上限：每次 audit 最多 30 個檔案。

**1c. 授權偵測（先行）**

從 `gh api` 或 LICENSE 檔確認授權：
- **MIT / Apache-2.0** = 繼續完整審查
- **無 license** = 繼續完整審查（通過條件：score ≥75 **且** 零 🔴 高危命中）
- **AGPL / GPL** = 顯示授權警告並**詢問是否繼續**（預設停止）：

  ```
  ⚠️ 授權：{license}（此 repo 不可收藏入借用庫）
  繼續安全分析仍有用途：設計研究 / 本機測試前評估
  請回「繼續」繼續，或直接 Enter 停止。
  ```

  收到「繼續」才執行 Phase 2-3；否則停在此輸出授權報告結束。

---

### Phase 2: 靜態掃描（Scan）

讀取各檔案，搜尋危險模式（regex 分類清單詳見 `references/patterns.md`）：

**S1 — 供應鏈攻擊**（postinstall/preinstall 下載+執行）
**S2 — RCE / 命令執行**（eval/exec/spawn 接受外部輸入）
**S3 — 資料洩漏 / 硬編碼密鑰**（token/private_key/webhook URL）
**S4 — 敏感本機資料存取**（~/.ssh/, ~/.aws/, 錢包, 瀏覽器資料）
**S5 — 外部資料傳送**（fetch/curl 傳送至外部域名）
**S6 — Container / CI 危險配置**（privileged, secrets in env, 無版本鎖定 action）
**S7 — 常見漏洞模式**（Path Traversal, SSRF, SQL Injection, XSS）

**條件式工具掃描**（偵測後才啟用）：
```bash
# CVE 掃描（不需 install，已有 npm）
npm audit --package-lock-only    # 需 package-lock.json

# pip-audit（WSL venv，已裝）
wsl -d Ubuntu -u intpure-service -- ~/.security-tools-venv/bin/pip-audit -r requirements.txt

# semgrep（WSL venv，已裝）
wsl -d Ubuntu -u intpure-service -- ~/.security-tools-venv/bin/semgrep --config=auto <path>

# 若工具未裝，跳過並在報告標注「未跑工具掃描」
```

---

### Phase 3: 報告（Report）

計算安全分數（評分表詳見 `references/scoring.md`），輸出結構化報告（格式詳見 `references/report-template.md`）。

**最終輸出必須包含**：
1. 安全分數 0-100
2. 是否建議執行（在本機直接 run）
3. 是否建議正式環境使用
4. 各風險等級清單（附路徑+行號）
5. 修補建議
6. 靜態分析的覆蓋限制說明

---

## 典型觸發場景

- 在 `/tech-analysis` 前先做安全把關
- 借用任何無 license repo 前的必要步驟
- 評估是否可接入 Hermes skill 的開源程式碼

## 不要做

- 自動執行 npm install / pip install / docker build
- 不附路徑行號就給結論
- 因「可能安全」而省略警告
- 給「看起來沒問題」這種語義模糊結論（靜態看不到的要明說是盲點）
