export const meta = {
  name: 'tech-analysis-manager',
  description: '技術分析經理：查重 → 安全審查 → 批量分析 GitHub 專案 → 寫入借用紀錄 → 摘要回報',
  phases: [
    { title: '查重', detail: '讀 借用紀錄.md，過濾已收錄的 URL' },
    { title: '安全審查', detail: '靜態掃描授權/供應鏈/密鑰風險，score<60 或 GPL/AGPL 不進分析' },
    { title: '分析', detail: '並行抓每個 repo 的授權、stars、技術棧' },
    { title: '寫入', detail: '將新條目寫入 借用紀錄.md 並 git commit + push' },
  ],
}

// ─── 輸入格式 ───────────────────────────────────────────────────────────────
// args: 字串陣列（GitHub URLs）
//   或: [{url, note}] 帶備註的物件陣列
// ─────────────────────────────────────────────────────────────────────────────
const rawInputs = Array.isArray(args) ? args : (args ? [args] : [])
const inputs = rawInputs.map(i => typeof i === 'string' ? { url: i.trim(), note: '' } : i)

if (!inputs.length) {
  log('未傳入 URL，用法：Workflow({name:"tech-analysis-manager", args:["https://github.com/..."]})')
  return { error: '未傳入 URL' }
}

const BORROWED_RECORD_PATH = 'C:\\Users\\intpu\\00_AI員工\\05_借用程式碼庫\\借用紀錄.md'

// ─── Phase 1：查重 ──────────────────────────────────────────────────────────
phase('查重')

const existingRecord = await agent(
  `讀取這個檔案的內容：${BORROWED_RECORD_PATH}
   請列出檔案中所有出現過的 GitHub URL（格式 https://github.com/...），每行一個。
   若沒有找到任何 URL，回傳空字串。`,
  { label: '讀借用紀錄', phase: '查重' }
)

const existingUrls = (existingRecord || '').split('\n')
  .map(l => l.trim().toLowerCase())
  .filter(l => l.includes('github.com'))

const newInputs = inputs.filter(i => {
  const normalized = i.url.toLowerCase().replace(/\/$/, '')
  return !existingUrls.some(existing => existing.includes(normalized.split('github.com/')[1] || normalized))
})

const skipped = inputs.length - newInputs.length
if (skipped > 0) log(`已收錄跳過：${skipped} 個`)
if (!newInputs.length) {
  log('所有輸入均已收錄，無需重複分析')
  return { skipped: inputs.map(i => i.url), new_entries: [] }
}
log(`待分析：${newInputs.length} 個`)

// ─── Phase 0：安全審查 ─────────────────────────────────────────────────────
phase('安全審查')

const SECURITY_SCHEMA = {
  type: 'object',
  properties: {
    url: { type: 'string' },
    license: { type: 'string' },
    license_type: { type: 'string', enum: ['MIT', 'Apache-2.0', 'GPL', 'AGPL', 'none', 'other'] },
    license_ok: { type: 'boolean', description: 'MIT/Apache=true, GPL/AGPL=false, none=true(但需雙重閘門)' },
    score: { type: 'number', description: '0-100 靜態安全分數' },
    verdict: { type: 'string', enum: ['pass', 'conditional', 'fail'] },
    has_high_risk: { type: 'boolean', description: '是否有任何 S1-S4 高危命中' },
    findings_summary: { type: 'string', description: '最重要發現，一行內' },
  },
  required: ['url', 'license', 'license_type', 'license_ok', 'score', 'verdict', 'has_high_risk', 'findings_summary'],
}

const securityResults = await parallel(newInputs.map(input => async () =>
  agent(
    `你是 Intpure 安全審查員。對以下 GitHub repo 做靜態安全快速評估（不執行程式碼，只讀取）。

目標：${input.url}

步驟：
1. 從 URL 解析 owner/repo
2. WebFetch https://api.github.com/repos/{owner}/{repo} 取 license spdx_id 和 default_branch
3. WebFetch 讀 raw package.json（若有）— 看 scripts.postinstall/preinstall/prepare
4. WebFetch 讀 README.md 前 100 行 — 看有無 curl|bash 安裝指令
5. 搜尋危險模式（任一命中 has_high_risk=true）：
   - postinstall/preinstall 含 curl|bash/wget|bash → 扣 30 分
   - eval()/exec() + 外部輸入 → 扣 25 分
   - 硬編碼 token/BEGIN PRIVATE KEY/AKIA[A-Z0-9]{16} → 扣 20 分
   - 讀取 ~/.ssh 或 ~/.aws → 扣 15 分
   - fetch/curl 傳至外部未知域名 → 扣 10 分

授權：MIT/Apache-2.0 → license_ok=true；GPL/AGPL → license_ok=false；無 license → license_ok=true（雙重閘門：pass 需 score≥75 且 has_high_risk=false）

verdict：score≥75 且 has_high_risk=false = pass；60-74 = conditional；<60 = fail
無 license 特別規則：即使 score≥75，has_high_risk=true → verdict=conditional`,
    { label: `sec:${input.url.split('/').slice(-2).join('/')}`, phase: '安全審查', schema: SECURITY_SCHEMA }
  )
))

const secPassed = securityResults.filter(Boolean).filter(r => r.verdict !== 'fail' && r.license_ok !== false)
const secFailed = securityResults.filter(Boolean).filter(r => r.verdict === 'fail')
const licBlocked = securityResults.filter(Boolean).filter(r => r.license_ok === false)

if (licBlocked.length) log(`⚠️ 授權不符(GPL/AGPL)跳過：${licBlocked.map(r => r.url.split('/').slice(-2).join('/')).join(', ')}`)
if (secFailed.length) log(`❌ 安全不通過：${secFailed.map(r => r.url.split('/').slice(-2).join('/') + '(' + r.score + '分)').join(', ')}`)
if (!secPassed.length) {
  log('無 repo 通過安全審查，流程結束')
  return {
    security_failed: secFailed.map(r => ({ repo: r.url, score: r.score, findings: r.findings_summary })),
    license_blocked: licBlocked.map(r => r.url),
    written: [],
  }
}
log(`✅ 安全通過：${secPassed.length} 個`)

const secPassedUrls = new Set(secPassed.map(r => r.url))
const safeInputs = newInputs.filter(i => secPassedUrls.has(i.url))

// 安全審查摘要（附入後續條目）
const securityNotes = Object.fromEntries(securityResults.filter(Boolean).map(r => [r.url, `安全：${r.score}/100 ${r.verdict === 'pass' ? '✅' : '⚠️'}通過 | ${r.findings_summary || '無重大發現'}`]))

// ─── Phase 2：分析 ──────────────────────────────────────────────────────────
phase('分析')

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    url: { type: 'string' },
    repo_name: { type: 'string', description: 'owner/repo 格式' },
    license: { type: 'string' },
    license_ok: { type: 'boolean', description: 'MIT 或 Apache-2.0 = true' },
    stars: { type: 'number', description: '查不到填 -1' },
    tech_stack: { type: 'string' },
    summary: { type: 'string', description: '2 句以內' },
    category: {
      type: 'string',
      enum: ['收藏待用', '設計研究', '情報觀察', '工具推薦', '不收'],
    },
    use_for: { type: 'string', description: '對 Intpure 具體價值（哪個 bot/技能/客戶場景）' },
    risks: { type: 'string' },
    record_entry: { type: 'string', description: '完整 Markdown 條目，可直接貼入 借用紀錄.md' },
  },
  required: ['url', 'repo_name', 'license', 'license_ok', 'stars', 'tech_stack', 'summary', 'category', 'use_for', 'risks', 'record_entry'],
}

const results = await parallel(safeInputs.map(input => async () => {
  const noteHint = input.note ? `\n使用者備註：${input.note}` : ''
  const secNote = securityNotes[input.url] ? `\n安全審查結果：${securityNotes[input.url]}` : ''
  return agent(
    `你是 Intpure 的技術分析經理。Intpure 運營一套 Hermes AI 助理系統（ada 行政助理 + fin 財務助理），基於 WSL2 + Telegram + n8n 架構。

分析這個 GitHub 專案：${input.url}${noteHint}${secNote}

請用 WebFetch 查 README 和 LICENSE，確認：
1. 授權（MIT/Apache-2.0 = 可收；AGPL/GPL = 不收）
2. Stars 數
3. 主要功能 + 技術棧
4. 對 Intpure Hermes 系統的用途分類（只選一個）：
   - 收藏待用：MIT/Apache，有技術複用價值，可抽片段進技能庫
   - 設計研究：學設計模式，不直接複用程式碼
   - 情報觀察：授權不符但有競品/生態情報價值
   - 工具推薦：推薦給 Intpure 或客戶直接使用
   - 不收：無關聯或授權有毒
5. 具體用途（哪個 bot、哪個技能、或哪類客戶）
6. 風險限制

最後輸出完整的 借用紀錄.md Markdown 條目（含標題表格說明風險）。`,
    { label: input.url, phase: '分析', schema: ANALYSIS_SCHEMA }
  )
}))

const valid = results.filter(Boolean)
const toWrite = valid.filter(r => r.category !== '不收')
const notCollected = valid.filter(r => r.category === '不收')

log(`分析完成：${valid.length}/${safeInputs.length} 個`)
log(`寫入：${toWrite.length} 個 ／ 不收：${notCollected.length} 個`)

// ─── Phase 3：寫入 ──────────────────────────────────────────────────────────
phase('寫入')

if (toWrite.length === 0) {
  log('無新條目需寫入')
} else {
  const entries = toWrite.map(r => r.record_entry).join('\n\n---\n\n')

  await agent(
    `請將以下 Markdown 內容追加到這個檔案的末尾：
檔案路徑：${BORROWED_RECORD_PATH}

要追加的內容（每個條目之間已有分隔線）：

---

${entries}

操作方式：
1. 用 Read 工具讀取現有檔案內容
2. 用 Edit 工具在檔案最後一行後追加上面的內容
3. 完成後確認檔案更新成功

只做追加，不改動現有內容。`,
    { label: '寫入借用紀錄', phase: '寫入' }
  )

  await agent(
    `請在 borrowed-library repo 執行 git commit + push：
工作目錄：C:\\Users\\intpu\\00_AI員工\\05_借用程式碼庫

指令：
1. git add 借用紀錄.md
2. git commit -m "feat: 新增 ${toWrite.length} 個專案分析（技術分析經理）"
3. git push origin main

請用 PowerShell 執行（不是 bash）。回報結果。`,
    { label: 'git commit + push', phase: '寫入' }
  )
}

// ─── 摘要 ────────────────────────────────────────────────────────────────────
const summaryTable = valid.map(r =>
  `| ${r.repo_name} | ${r.license}${r.license_ok ? ' ✅' : ' ❌'} | ${r.stars >= 0 ? r.stars : '?'} | ${r.category} | ${r.use_for.slice(0, 35)} |`
).join('\n')

const secSummary = securityResults.filter(Boolean).map(r =>
  `| ${r.url.split('/').slice(-2).join('/')} | ${r.score}/100 | ${r.verdict === 'pass' ? '✅' : r.verdict === 'conditional' ? '⚠️' : '❌'} ${r.verdict} | ${r.findings_summary} |`
).join('\n')

return {
  summary: `## 技術分析經理 — 本次結果\n\n### 安全審查\n\n| Repo | 分數 | 判定 | 主要發現 |\n|---|---|---|---|\n${secSummary}\n\n### 技術分析\n\n| Repo | 授權 | Stars | 分類 | 用途 |\n|---|---|---|---|---|\n${summaryTable}`,
  written: toWrite.map(r => r.repo_name),
  skipped_duplicate: inputs.slice(0, skipped).map(i => i.url),
  security_blocked: [...secFailed.map(r => r.url), ...licBlocked.map(r => r.url)],
  not_collected: notCollected.map(r => r.repo_name),
}
