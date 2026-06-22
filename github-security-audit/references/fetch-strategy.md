# Fetch Strategy — GitHub 靜態讀取策略

## gh API 讀取指令

```bash
# 1. 基本 metadata（license/stars/archive 狀態）
gh api repos/{owner}/{repo}

# 2. 完整目錄樹
gh api repos/{owner}/{repo}/git/trees/{branch}?recursive=1 --jq '[.tree[].path]'

# 3. 讀取單一檔案（raw text）
gh api -H 'Accept: application/vnd.github.raw' \
  repos/{owner}/{repo}/contents/{path}?ref={branch}

# 4. 大型/binary 檔（透過 blob SHA）
gh api repos/{owner}/{repo}/git/blobs/{sha} --jq '.content' | base64 -d

# 5. WebFetch 備用（gh API 不方便時）
https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}
```

## Pass 1 必讀清單

### 依賴 Manifest
| 檔案 | 語言 | 審查重點 |
|---|---|---|
| `package.json` | Node.js | scripts.postinstall/preinstall/prepare/build |
| `package-lock.json` | Node.js | npm audit --package-lock-only |
| `pnpm-lock.yaml` / `yarn.lock` | Node.js | 鎖定版本確認 |
| `requirements.txt` / `pyproject.toml` | Python | pip-audit，已知 CVE |
| `poetry.lock` | Python | 鎖定版本 |
| `go.mod` / `go.sum` | Go | 依賴完整性 |
| `Cargo.toml` / `Cargo.lock` | Rust | cargo audit |
| `Gemfile` / `Gemfile.lock` | Ruby | bundle audit |
| `composer.json` | PHP | composer audit |
| `pom.xml` / `build.gradle` | Java | OWASP dep check |

### CI / Container
| 路徑 | 審查重點 |
|---|---|
| `.github/workflows/*.yml` | 外部 action 版本未鎖定，secrets 暴露，curl\|bash |
| `Dockerfile*` | RUN curl\|bash，USER root，COPY --chown，ADD 遠端 URL |
| `docker-compose*.yml` | privileged, volumes 敏感掛載, env 密鑰 |

### 安裝/入口
| 路徑 | 審查重點 |
|---|---|
| `README.md` | 是否要求執行高風險指令 |
| `INSTALL*` / `setup.sh` / `install.sh` | 下載+執行模式 |
| `Makefile` | install/build 目標的命令 |
| `setup.py` | cmdclass 覆寫，postinstall hook |

## Pass 2 觸發條件（Pass 1 有風險才展開）

Pass 1 發現以下情況時，展開對應檔案：
- package.json 有 postinstall script → 讀該 script 指向的 JS 檔
- workflow 有 `run: curl` → 讀完整 workflow
- Dockerfile 有 COPY * → 讀 .dockerignore + 主要程式碼

## 速率限制
- 未認證：60 req/hr（公開 repo 夠用）
- 已認證：5000 req/hr
- 單次 audit 上限：30 個檔案
