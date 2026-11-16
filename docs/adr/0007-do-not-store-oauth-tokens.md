# Google が発行した OAuth のトークンを DB に保存しない

Google でログインしたときに Google が発行するトークン（アクセストークン、リフレッシュトークン、ID トークン）と、その有効期限を、`accounts` テーブルに保存しない。Better Auth は初期設定ではこれらを暗号化せずに保存するが、このアプリはログインの後に Google の API を使わないので、保存しておく必要が無い。保存しなければ、DB の中身が漏れたときにも、Google のアカウントに使えるトークンが漏れない。

## 前提

- Better Auth は、初期設定では、OAuth のトークンを暗号化せずに `accounts` テーブルに保存する（Better Auth の型定義にある `account.encryptOAuthTokens` の説明による）。2026-11-16 のローカル検証でも、Google でログインした後の `accounts` に、アクセストークンと ID トークンが保存されていた。
- このアプリが Google から必要とする情報は、ログインした人の ID、表示名、メールアドレス、プロフィール画像だけである。これらはログインの処理の中で受け取り、`users` と `accounts` に保存する。ログインの後に、Google の API（カレンダーやドライブなど）を呼ぶ機能は無い。
- Better Auth には、トークンを保存しないための設定項目が無い。

## 理由

- 使わないデータは、保存しなければ漏れることが無い。
- アクセストークンが漏れると、有効期限までの間、そのトークンで Google の API を呼べる。リフレッシュトークンが漏れると、新しいアクセストークンを作れる。

## 実装

- `apps/api/src/auth.ts` の `databaseHooks.account.create.before` と `databaseHooks.account.update.before` で、トークンと有効期限を NULL にしたデータを返す。Better Auth は、`before` が返したデータを元のデータの代わりに保存する。
- `account.updateAccountOnSignIn` を `false` にする。初期設定では、Better Auth はログインのたびに `accounts` の行を Google から受け取った最新のトークンで更新する。トークンを保存しないので、この更新は要らない。

## 検討した他の案

- **`account.encryptOAuthTokens` を有効にして、暗号化して保存する**：Better Auth の設定項目であり、トークンは XChaCha20-Poly1305 で暗号化される。しかし、使わないデータを保存し続けることに変わりはない。また、暗号化の鍵（`BETTER_AUTH_SECRET`）も同時に漏れた場合は、トークンを復号できる。採用しない。

## この決定による影響

- Google の API を使う機能を後で加える場合は、この決定を見直す。そのときは、ユーザーにもう一度ログインしてもらい、トークンを受け取り直す必要がある。
- 2026-11-16 のローカル検証で、次のことを確かめた。
  - ユーザーを作り直してログインすると、`accounts` のトークンと有効期限がすべて NULL になる。ログインとログアウトも動く。
  - 同じユーザーがもう一度ログインしても、`accounts` の行は増えず、更新もされない（`updated_at` が作成時のままであり、トークンも NULL のままである）。
