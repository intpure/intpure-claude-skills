# Patterns — 危險 Regex 分類清單

## S1 供應鏈攻擊（Supply Chain）

### package.json lifecycle scripts
```regex
(?i)\b(postinstall|preinstall|prepare|prepack|postpack|prepublish|prepublishOnly)\b
(?i)"scripts"\s*:\s*\{
```

### Install 時下載+執行
```regex
(?i)curl\s+.+\|\s*(sh|bash|zsh|fish)
(?i)wget\s+.+\|\s*(sh|bash|zsh|fish)
(?i)powershell\s+-.*(enc|encodedcommand|DownloadString|IEX)
(?i)Invoke-Expression\s+\(
(?i)node\s+-e\s+['"]\s*require
(?i)python\s+-c\s+['"]
(?i)ruby\s+-e\s+['"]
```

### 可疑 chmod + 執行
```regex
(?i)chmod\s+\+x\s+
(?i)\./.*\s+(install|setup|run)
```

### 非官方來源依賴（git/tarball）
```regex
(?i)"[^"]+"\s*:\s*"git\+(ssh|http)
(?i)"[^"]+"\s*:\s*"(https?|github):
```

---

## S2 RCE / 命令執行

```regex
(?i)\beval\s*\(
(?i)\bnew\s+Function\s*\(
(?i)\bexec\s*\(
(?i)\bspawn\s*\(
(?i)\bspawnSync\s*\(
(?i)\bexecSync\s*\(
(?i)\bpopen\s*\(
(?i)\bos\.system\s*\(
(?i)\bsubprocess\.(run|Popen|call|check_output)\s*\(
(?i)\bchild_process\.(exec|execSync|spawn|spawnSync)\s*\(
(?i)\bvm\.(runInThisContext|runInNewContext)\s*\(
(?i)\bProcess\.Start\b
(?i)\bRuntime\.getRuntime\(\)\.exec\b
(?i)\bshell_exec\s*\(
(?i)\bpassthru\s*\(
(?i)\bproc_open\s*\(
```

⚠️ 優先級：指令字串包含外部輸入（user input / env / file content / network）時嚴重度提升

---

## S3 資料洩漏 / 硬編碼密鑰

### API token / secret 模式
```regex
(?i)\b(api[_-]?key|api[_-]?secret|access[_-]?token|private[_-]?key|client[_-]?secret|bearer[_-]?token)\s*[=:]\s*['"][^'"]{8,}
(?i)AKIA[0-9A-Z]{16}
(?i)ASIA[0-9A-Z]{16}
(?i)gh[pousr]_[A-Za-z0-9_]{20,}
(?i)xox[baprs]-[A-Za-z0-9-]+
(?i)sk-[A-Za-z0-9]{20,}
(?i)ya29\.[A-Za-z0-9_-]+
(?i)-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----
```

### Webhook 外傳端點
```regex
(?i)discord(app)?\.com/api/webhooks/
(?i)hooks\.slack\.com/services/
(?i)hooks\.teams\.microsoft\.com/
(?i)api\.telegram\.org/bot[0-9]+:
(?i)ntfy\.sh/
(?i)(webhook|callback)[^a-z].{0,30}https?://
```

### 遙測 / 錯誤回報
```regex
(?i)(sentry|bugsnag|datadog|logrocket|segment|mixpanel|amplitude)\.(io|com|init|capture)
(?i)telemetry.*true
(?i)analytics.*enabled
```

---

## S4 敏感本機資料存取

### SSH / 憑證路徑
```regex
(?i)(~|/home/[^/]+|/Users/[^/]+|%USERPROFILE%)[/\\]\.ssh[/\\]
(?i)(~|/home/[^/]+)[/\\]\.(aws|config|gnupg)[/\\]
(?i)(id_rsa|id_ed25519|known_hosts|authorized_keys|ssh_config)\b
(?i)\.aws[/\\]credentials
(?i)\.npmrc
(?i)\.pypirc
```

### 瀏覽器 / 錢包資料
```regex
(?i)(chrome|firefox|edge)[/\\](Default|Profiles)[/\\](Cookies|Login\s?Data|Local\s?State)
(?i)(keychain|Keychain Access|SecKeychainFind)
(?i)(wallet\.dat|keystore|seed\.txt|mnemonic)
(?i)(localStorage|sessionStorage|IndexedDB)\b
```

### 環境變數 + 外傳組合（高危）
```regex
(?i)process\.env\.[A-Z_]+.{0,100}(fetch|axios|curl|request)
(?i)os\.environ.{0,100}(requests|urllib|httpx)
```

---

## S5 外部資料傳送

```regex
(?i)\bfetch\s*\(\s*['"`][^'"`)]+['"`]
(?i)axios\.(post|put|patch|delete)\s*\(
(?i)request(s)?\.(post|put|patch|delete)\s*\(
(?i)XMLHttpRequest\b
(?i)curl\b.{0,100}https?://
(?i)Invoke-WebRequest\b
(?i)Invoke-RestMethod\b
(?i)nc\s+.+-e\b
(?i)scp\b.{0,100}@
(?i)socket\.(connect|send|sendall)\s*\(
(?i)dns\.(lookup|resolve)\s*\(
```

---

## S6 Container / CI 危險配置

### GitHub Actions
```regex
(?i)uses:\s+[^/]+/[^@\n]+@(?!v[0-9]+\.[0-9]+\.[0-9]+|[a-f0-9]{40})
```
（外部 action 未用語意版本鎖定或完整 commit SHA 鎖定）

```regex
(?i)run:\s+.*(curl|wget).{0,100}\|\s*(sh|bash)
(?i)\$\{\{\s*secrets\.\w+\s*\}\}\s*==
(?i)continue-on-error:\s*true
```

### Dockerfile
```regex
(?i)^RUN.{0,100}(curl|wget).{0,100}\|\s*(sh|bash)
(?i)--privileged
(?i)^USER\s+root\s*$
(?i)^ADD\s+https?://
```

### docker-compose
```regex
(?i)privileged:\s*true
(?i)-\s+/var/run/docker\.sock
(?i)-\s+/:/
```

---

## S7 常見漏洞模式

### Path Traversal
```regex
(?i)(\.\.\/|\.\.\\|%2e%2e%2f|%252e)
(?i)(readFile|readFileSync|open)\s*\([^)]*req\.(params|query|body)
```

### SQL Injection
```regex
(?i)(query|execute)\s*\(\s*[`'"]\s*(SELECT|INSERT|UPDATE|DELETE|DROP).{0,100}\+
(?i)(query|execute)\s*\(.{0,100}(req\.(params|query|body)|userInput)
```

### XSS
```regex
(?i)(innerHTML|outerHTML|document\.write|insertAdjacentHTML)\s*=
(?i)(dangerouslySetInnerHTML)\s*=
(?i)res\.send\s*\(.{0,100}(req\.(params|query|body))
```

### SSRF
```regex
(?i)(fetch|axios|request|urllib)\s*\(.{0,100}(req\.(params|query|body)|userInput)
(?i)http\.get\s*\(.{0,100}(req\.(params|query|body))
```

### 任意檔案上傳
```regex
(?i)(multer|busboy|formidable)\b
(?i)(originalname|filename)\s*[+].{0,50}(\.|\bpath\b)
(?i)move_uploaded_file\s*\(
```

---

## 使用方式

用 `Grep` 工具搜尋：

```python
# 範例：搜尋 eval
Grep(pattern=r"(?i)\beval\s*\(", path=<repo_root>, output_mode="content")
```

每個匹配結果記錄：
- 檔案路徑
- 行號
- 匹配行的完整內容（含前後 2 行 context）
- 判斷：高危 / 中危 / 低危 / 誤報
