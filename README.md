# PWA Rescue —— 主域被封后的逃生方案

让已经安装 PWA 的存量用户,在推广域 `a.com` 被举报封禁后,**自动迁移**到备份域 `b.com`。

## 它怎么工作

```
[正常时]
  用户访问 a.com → SW 安装 → 后台静默缓存 rescue.html(托管在 GitHub Pages)
                                ↓
                        用户无感,但"降落伞"已就位

[a.com 被封]
  桌面 PWA 启动 → 请求 a.com → 失败
                  ↓
              本地 SW fetch.catch 触发
                  ↓
              从 cache 取出 rescue.html 返回
                  ↓
          rescue.html 在 a.com 域下渲染
                  ↓
          JS 从多个 CDN 拉最新备份域名清单
                  ↓
          依次探活 b.com → b2.com → b3.com
                  ↓
          location.replace 跳到第一个通的域
                  ↓
          用户看到内容(虽然 PWA 上下文仍是 a.com)
                  ↓
          在 b.com 引导重新「添加到主屏」 → 真正迁移
```

## 项目结构

```
pwa-rescue/
├─ public/                          ← 部署到 GitHub Pages / Cloudflare Pages
│  ├─ rescue.html                   ← 逃生页面(用户最终会看到)
│  └─ pwa-domains.json              ← 动态备份域名清单
├─ integration/                     ← 集成片段(merge 到主项目)
│  ├─ rescue-sw-snippet.js          ← 加到主项目 service-worker.js
│  └─ rescue-client-snippet.js      ← 加到主项目 index.html
└─ README.md
```

## 部署步骤

### Step 1:把 `public/` 部署到第三方稳定域

**推荐 GitHub Pages**(免费、几乎不会被针对性封禁):

```bash
# 1. 在 GitHub 新建一个仓库,例如 your-org/pwa-rescue
# 2. 把 public/ 下的内容推上去
cd /Users/xsp/Sites/pwa-rescue/public
git init && git add . && git commit -m "init rescue page"
git remote add origin https://github.com/YOUR-ORG/pwa-rescue.git
git push -u origin main
# 3. 仓库 Settings → Pages → Source 选 main 分支
# 4. 等几分钟,访问 https://YOUR-ORG.github.io/pwa-rescue/rescue.html 验证
```

**额外保险**:同时部署到 Cloudflare Pages、Vercel,得到 3 个独立 URL。把它们都加到 SW snippet 的备份列表里(略改 snippet 即可)。

### Step 2:配置备份域名清单

编辑 `public/pwa-domains.json`,填入真实的备份域:

```json
{
  "version": 1,
  "updated_at": "2026-05-12",
  "domains": [
    "https://b.com",
    "https://b2.com",
    "https://b3.com"
  ]
}
```

**重要**:把这个 JSON 同时上传到多个独立 CDN(S3、阿里云 OSS、R2、GitHub),然后修改 `public/rescue.html` 中的 `DOMAIN_SOURCES` 数组,列出所有 URL。任一存活即可拉到最新清单。

### Step 3:改 `rescue.html` 的配置

打开 `public/rescue.html`,修改顶部配置区:

```js
var DOMAIN_SOURCES = [
  'https://YOUR-CDN-1.example.com/pwa-domains.json',
  'https://YOUR-CDN-2.example.com/pwa-domains.json',
  'https://raw.githubusercontent.com/YOUR-ORG/pwa-rescue/main/pwa-domains.json'
];

var FALLBACK_DOMAINS = [
  'https://b.com',
  'https://b2.com'
];

var LATEST_INFO_URL = 'https://t.me/your_channel';  // 用户问询入口
```

### Step 4:集成到主项目

**4.1 SW 集成**

打开主项目的 [service-worker.js](../game002_vue/service-worker.js),把 `integration/rescue-sw-snippet.js` 的内容**追加到文件末尾**。

修改顶部配置:

```js
var RESCUE_URL = 'https://YOUR-ORG.github.io/pwa-rescue/rescue.html';
var HARDCODED_FALLBACK = 'https://b.com';
```

**4.2 主线程集成**

打开主项目 [index.html](../game002_vue/index.html),在 `navigator.serviceWorker.register` 那段之后(约 [index.html:57](../game002_vue/index.html#L57))加入 `integration/rescue-client-snippet.js` 的内容。

### Step 5:验证

**A. 验证逃生页本身能跑**

直接浏览器访问:
```
https://YOUR-ORG.github.io/pwa-rescue/rescue.html?ch=test#/?sdmode=2
```
应该自动跳到 `https://b.com/?ch=test#/?sdmode=2`。

**B. 验证 SW 已缓存逃生页**

1. Chrome 打开你的 a.com
2. F12 → Application → Cache Storage → 应该看到 `pwa-rescue-v1`,里面有 rescue.html
3. F12 → Application → Service Workers → 确认状态是 activated

**C. 验证逃生流程**

模拟 a.com 不可用:
1. F12 → Network → 勾选 "Offline"
2. 刷新页面
3. 应该看到 rescue.html 闪现,然后跳到 b.com

**D. 真实演练(谨慎)**

测试环境:把 a.com 的 nginx 暂时 502。已安装 PWA 的设备启动后,应自动跳到 b.com。

## 备份域名更新流程

发现 b.com 也被封时:

1. 在 `pwa-domains.json` 把 `b.com` 删掉,加上 `b4.com`、`b5.com`
2. 同步推送到所有 CDN(GitHub / S3 / R2 等)
3. 用户下次启动 PWA 时,客户端会触发 `refresh-rescue` 消息,SW 重新拉 rescue.html(里面会读最新的 JSON)
4. 由于 rescue.html 启动时也会重新拉 `pwa-domains.json`,所以**只要 JSON 推得及时,用户基本无感**

## 关键限制(必须知道)

| 限制 | 说明 |
|------|------|
| **必须先访问过 a.com** | 用户第一次访问时如果 a.com 已经被封,SW 装不上,没救 |
| **iOS 缓存不稳定** | iOS Safari 可能在系统重启 / 长期不用后清掉 SW 缓存,逃生失败率高于 Android |
| **逃生 ≠ 迁移** | 跳到 b.com 后,桌面图标仍归属 a.com 的 PWA。要彻底迁移必须在 b.com 引导用户重新「添加到主屏」并删旧图标 |
| **opaque 响应** | `mode: 'no-cors'` 缓存的逃生页是 opaque 的,能用但 SW 看不到内容/header,这是设计预期 |
| **总耗时** | 备份域探活 + 跳转大约 1-3 秒,期间用户看到 spinner |

## 故障排查

| 现象 | 原因 |
|------|------|
| Cache Storage 里没有 rescue.html | `RESCUE_URL` 拼错,或 GitHub Pages 还没生效 |
| 离线模拟时没跳走 | SW 还没 activate,关掉重开浏览器或在 DevTools 强制 update |
| 跳到 b.com 后 404 | b.com 的路由没处理 query/hash,检查 b.com 入口逻辑 |
| iOS 不工作 | 检查 PWA 是否真的从主屏图标启动,而不是 Safari 内打开 |

## 相关项目

主项目集成位置:
- [game002_vue/service-worker.js](../game002_vue/service-worker.js)
- [game002_vue/index.html](../game002_vue/index.html#L42-L58)
- [game002/api/controllers/IndexController.php](../game002/api/controllers/IndexController.php) (302 中转,与逃生方案互补)
