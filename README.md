# Intpure Claude Code Skills

Intpure 自研 Claude Code skill 技能庫。每個 skill 可以直接複製到任何專案的 `.claude/skills/` 或全域 `~/.claude/skills/` 使用。

---

## 安裝方式

```bash
# 安裝單一 skill（以 github-security-audit 為例）
cp -r github-security-audit ~/.claude/skills/

# 或安裝到特定專案
cp -r github-security-audit /path/to/your-project/.claude/skills/
```

Claude Code 重新啟動後即可使用。

---

## 技能清單

### github-security-audit

靜態審查 GitHub repo 安全性，作為借用開源程式碼前的安全閘門。

**功能**：
- 靜態讀取（不執行程式碼、不安裝依賴）
- 10 步驟系統性分析：依賴 manifest、CI/CD、Container、危險關鍵字
- 輸出安全分數 0-100 + 分級風險清單（高/中/低/待確認）
- 支援條件式工具掃描（semgrep / pip-audit / npm audit）

**觸發詞**：「審查這個 repo」「這個專案安全嗎」「幫我看這個 GitHub 專案」「security audit」「借用前先查一下」「這個 open source 可以用嗎」

---

## License

MIT — 保留出處標註即可自由使用、修改、商用。
