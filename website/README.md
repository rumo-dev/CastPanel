# CastPanel distribution site — GitHub Pages

公開先: https://rumo-dev.github.io/CastPanel/

GitHubの Settings → Pages → Build and deployment → Source を **GitHub Actions** に設定します。mainへ `website/**` をpushすると `.github/workflows/pages.yml` がサイトを公開します。Actionsから手動実行もできます。

公開するのは `website/dist/` のみです。サイトとアプリのソースはCastPanelリポジトリで直接管理します。相対URLを使っているため `/CastPanel/` 配下でも表示できます。GitHub Pagesへの配置とアプリのRelease公開は独立しています。

Buildless HTML/CSS/JavaScript. `dist/` is the deployable site; no secrets or desktop user data are needed.

```sh
npm run check
npm run dev
```

The preview server uses Express from the adjacent CastPanel checkout and prints its local URL. For a standalone copy, serve `dist/` with any static HTTP server.

The interactive app preview uses the native HTML-in-Canvas API (`content="drawable"`, `drawable`, `drawElementImage`, `paint`, `requestPaint`) and includes the older `layoutsubtree` spelling. Unsupported browsers and failed initial draws retain the same functional DOM. No screenshot polyfill is represented as native HTML-in-Canvas.

Downloads are enabled only for files returned by the public stable GitHub Releases API. Edit `dist/config.js` if using a separate release repository. Draft, missing, inaccessible, or rate-limited releases show a pending state and a link to the release list, never a fake download.

The former Sites repository metadata was backed up to the ignored `.smoke-data/website-sites-git-backup/` in the desktop workspace. The existing private Sites preview is retained, but this workflow updates GitHub Pages only. `.openai/hosting.json` records the previous Site identity and is not part of the deployed artifact. Custom domains are optional.

Official GitHub Pages workflow reference: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

Native API reference: https://developer.chrome.com/docs/web-platform/html-in-canvas/2d
