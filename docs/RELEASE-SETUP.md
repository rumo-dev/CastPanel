# 配布・自動アップデートの準備

## 今回設定したもの

- Windows ICO／macOS ICNS／Linux PNG、実行中ウィンドウのアイコン、Windows AppUserModelID、アプリ内ロゴ。
- `electron-builder.yml` の配布先を、現在のGit remoteと同じ `rumo-dev/CastPanel` に設定。更新先を変える場合は最初の一般配布前に変更してください。
- GitHub Actionsのタグと `package.json` のバージョン一致確認。成果物は `CastPanel-${version}-${os}-${arch}.${ext}`。
- 生成するGitHub Releaseはdraft。成果物確認後に公開するまで更新対象にはなりません。
- 配布サイトは公開stableリリースの実際のファイルだけを表示します。

## 配布者が用意するもの

1. **公開リリースを置くGitHubリポジトリ**。現在の `rumo-dev/CastPanel` を使うか、バイナリ配布専用の公開リポジトリを指定します。ソースが非公開の場合も、利用者へGitHubトークンを配る構成は避け、公開の配布先を別途用意してください。
2. **GitHub Actionsの有効化と書込み権限**。このワークフローは同じリポジトリの `GITHUB_TOKEN` と `contents: write` を使用します。別リポジトリへ公開する場合は、その配布先に限定したCI用の認証を用意し、Secretsへ登録します。トークンをアプリやサイトへ埋め込みません。
3. **Windows署名（一般配布では推奨）**。現在のelectron-builder v26に合うコード署名証明書または対応するクラウド署名環境を用意します。ファイル証明書を使用できる方式ならGitHub Secretsへ `WIN_CSC_LINK`・`WIN_CSC_KEY_PASSWORD` を登録します。workflowがelectron-builder用の `CSC_LINK`・`CSC_KEY_PASSWORD` へ渡します。クラウド／HSM方式ならそのプロバイダー用のCI設定が必要です。証明書・秘密鍵はチャットやリポジトリに置かずSecretsへ登録してください。
4. **macOS署名・公証（macOS配布・自動更新用）**。Apple Developer Program、Developer ID証明書、GitHub Secretsの `MAC_CSC_LINK`・`MAC_CSC_KEY_PASSWORD`、`APPLE_ID`・`APPLE_APP_SPECIFIC_PASSWORD`・`APPLE_TEAM_ID` を用意します。workflowはOS別の証明書を使います。公証設定は使用する証明書・プロファイルに合わせて追加します。
5. **各OSの実機確認**。Windows NSIS、macOS DMG＋ZIP、Linux AppImageと、それぞれの更新メタデータを確認します。Windowsのwin-unpackedフォルダーは配布インストーラーの代わりにはしません。
6. **配布サイトの公開設定**。GitHubの Settings → Pages → Source を **GitHub Actions** に設定します。mainへサイトをpushすると `.github/workflows/pages.yml` が `website/dist/` を公開します。公開先は `https://rumo-dev.github.io/CastPanel/` です。詳しくは `website/README.md` を参照してください。独自ドメインは任意です。

## リリース手順

1. アプリ内データのバックアップ、`npm ci`、`npm test`、`npm run build`。
2. `package.json` とlockfileのバージョンを上げ、実機で配信・OBS・終了動作を確認。
3. `npm run check:release` を実行。
4. バージョンと同じ `v0.5.0` などのタグをpush（実際のバージョンに置き換える）。
5. Actionsが生成するdraft Releaseを確認。実行ファイル、macOS ZIP、`.blockmap`、`latest.yml`／`latest-mac.yml`／`latest-linux.yml` を、同じビルドで生成された組み合わせのまま保持。
6. 署名・公証・インストール動作を確認してReleaseを公開。
7. **旧版を実際にインストールしたPC**から、更新確認→ダウンロード→再起動適用→バージョンと保存データの保持を検証。開発モードだけの確認では代用できません。

既に配布した版へ更新を届けるには、その旧版が正しい更新先を内蔵している必要があります。古い版に `REPLACE_OWNER` 等が埋め込まれていた場合、最初の一度は新しいインストーラーを手動で導入してください。

## 参考資料

- electron-builder v26自動更新: https://www.electron.build/v26/docs/features/auto-update/
- electron-builder v26署名: https://www.electron.build/v26/docs/features/code-signing/
- HTML-in-Canvas: https://developer.chrome.com/docs/web-platform/html-in-canvas/2d

現時点では実際のGitHub Releaseの作成・公開、証明書の取得、署名済み配布版からの更新試験は行っていません。

## 0.5.0の準備

- リリース本文: `docs/releases/v0.5.0.md`。electron-builderが配布メタデータとdraft Release用に参照します。
- バージョンは `package.json`・lockfile・`website/dist/config.js`・`releaseNotesFile` を揃えます。`npm run check:release` が不一致を検出します。
- Actionsの **Release → Run workflow** は3 OSで `--publish never` を実行する事前ビルドです。成果物は各ジョブのArtifactsから取得できます。手動実行ではタグやGitHub Releaseを作成しません。
- 正式なリリース準備が整ったコミットに `v0.5.0` タグを付けてpushするとdraft Releaseを生成します。`git tag v0.5.0` → `git push origin v0.5.0`。既存のタグを上書きしないでください。
- draftの確認後、GitHub Releaseへこのリリース本文を設定し、Publish releaseで公開します。公開後にGitHub Pagesのダウンロード欄と旧版からの更新を確認します。
- `build.bat` はローカルWindowsビルド専用で、公開しません。既存の実行中ビルドと出力先を分けたい場合は `npm exec -- electron-builder --win --publish never --config.directories.output=release-0.5.0` を使います。
