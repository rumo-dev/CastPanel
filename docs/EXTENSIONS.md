# CastPanel拡張仕様 v1

OneCommeのSDKとは別の仕様です。既存のテンプレートやNodeプラグインがそのまま動くものではありません。

## HTMLテンプレート

次のような単体HTMLを用意し、「連携・拡張」→「HTMLファイルを追加」で登録します。表示されたURLをOBSに指定します。外部通信や外部画像はCSPで制限します。

```html
<!doctype html>
<meta charset="utf-8">
<style>
body { margin: 0; background: transparent; color: white; font: 28px sans-serif; }
.comment { background: #152338dd; margin: 8px; padding: 12px; border-radius: 12px; }
</style>
<div id="comments"></div>
<script src="/sdk.js"></script>
<script>
CastPanel.subscribe(state => {
  const root = document.getElementById('comments');
  root.replaceChildren();
  for (const comment of state.comments.slice(-10)) {
    const row = document.createElement('div');
    row.className = 'comment';
    row.textContent = `${comment.nickname || comment.username}: ${comment.text}`;
    root.append(row);
  }
});
</script>
```

SDKは最新状態を受け取るsubscribe(callback)と、その停止関数を提供します。コメントのidで新着を判定してください。削除・ブロック・クリア・OBS除外枠は後続の状態に反映されます。

`GET /api/state`はOBSと同じ公開データ、`GET /api/comments`は公開コメント配列です。名簿・メモ・接続先・操作トークンは含めません。WebSocket `/ws`は同一サーバーOriginからのみ接続できます。

## 操作API・Stream Deckからの操作

「連携・拡張」で起動ごとのトークンと実際のAPI URLを確認します。通常は`POST http://127.0.0.1:11280/api/command`ですが、競合時はポートが自動変更されるため、画面のURLを使ってください。次のヘッダーでJSONを送ります。

```text
Authorization: Bearer <コピーしたトークン>
Content-Type: application/json
```

コマンドの型は `src/shared/studio.ts` のcommandSchemaです。

```json
{"type":"timestamp","label":"ハイライト"}
```

```json
{"type":"poll-toggle","active":false}
```

自由回答と自動締切の例です。省略時は従来の選択式として扱います。

```json
{"type":"poll-create","title":"遊びたいゲームは？","mode":"free","options":[],"correct":-1,"answerPrefix":"!投票","durationSeconds":60}
```

```json
{"type":"poll-merge","source":1,"target":0}
```

統合元・統合先は現在の回答配列の0始まりインデックスです。統合後はインデックスが変わるため最新状態を確認してください。投票者IDや表記ゆれ辞書はOBS／公開APIに出力しません。

セットリスト編集とタイムスタンプ編集の例です。

```json
{"type":"setlist-edit","id":"曲のID","title":"変更後の曲名","artist":"アーティスト"}
```

```json
{"type":"timestamp-edit","id":"記録のID","seconds":120,"label":"ハイライト"}
```

```json
{"type":"effect","id":"演出ルールのID"}
```

Stream DeckではHTTP POST対応アクションを使用してください。ローカル操作APIはLANリモートビュー側では公開しません。

## HTTPプラグイン

自作のローカルHTTPサーバーを起動し、アプリの「連携・拡張」にエンドポイントを登録して有効化します。受信したコメントごとに次のJSONがPOSTされます。

```json
{"type":"comment","version":1,"comment":{"id":"...","platform":"youtube","username":"...","text":"..."}}
```

完全なcomment型は `src/shared/types.ts` を参照。NGとブロックの処理後のデータを送ります。受信側は2xxを速やかに返してください。応答本文は使わず、2秒のタイムアウト、最大8並列、リダイレクト禁止です。混雑時の通知はスキップします。配信を止める同期変換プラグインやNodeコードの直接実行ではありません。

## 翻訳とVTube Studio

- 翻訳: 別途起動したLibreTranslateの`127.0.0.1:5000/translate`へ送信。最大4並列、8秒タイムアウト。ローカル翻訳先言語モデルの導入が必要。ゆかりねっと専用互換ではありません。
- VTube Studio: `127.0.0.1:8001`の公開APIを使用。アプリで接続してVTube Studio側の許可ダイアログを承認します。ホットキー名／IDを手動実行、または演出ルールに紐付けます。トークンはElectron safeStorageが利用可能な場合のみ暗号化保存します。バックアップには含めません。
- 外部製品との疎通は利用者の環境での確認が必要です。

## リモートビュー

「リモート」から開始すると、閲覧専用のHTTPサーバーを`0.0.0.0:11181`で開始します。表示されたLAN IPのURLを別端末で開いてください。URLに含むランダムトークンがアクセス資格です。起動をまたいで有効化状態やトークンを保存しません。信頼できるLAN向けのHTTPであり、インターネットへのポート公開は想定していません。
