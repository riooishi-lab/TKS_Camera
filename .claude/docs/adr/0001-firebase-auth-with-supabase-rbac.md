# 0001. Firebase Authentication とSupabase による権限管理の導入

## Status

Proposed

## Date

2026-04-03

## Context

レシートスキャナーアプリは複数ユーザーでの利用を想定しているが、これまで認証・認可の仕組みがなく、誰でもすべての機能にアクセスできる状態だった。チームでの利用に向けて以下の要件が発生した：

- ユーザーのログイン/ログアウト機能
- ロールベースのアクセス制御（admin / editor / viewer）
- 管理者によるユーザー招待フロー
- 既存のSupabaseデータベースとの統合

認証基盤の選択肢として以下を検討した：
1. **Supabase Auth** — Supabaseの組み込み認証。DBとの統合が自然だが、招待フローのカスタマイズ性に制約がある
2. **Firebase Authentication** — Google のマネージド認証サービス。メール/パスワード認証が即座に利用可能で、将来のソーシャルログイン拡張も容易
3. **NextAuth.js** — Next.js向けの認証ライブラリ。セルフホストだが設定が複雑

## Decision

**Firebase Authentication を認証基盤として採用し、権限管理はSupabaseの `tks_users` テーブルで行う**ハイブリッド構成を選択した。

具体的な設計：
- **認証**: Firebase Authentication（メール/パスワード）でユーザー認証を行う
- **権限管理**: Supabaseの `tks_users` テーブルに `role`（admin/editor/viewer）と `status`（pending/active）カラムを持たせ、権限情報を管理する
- **ユーザー紐付け**: Firebase UID と `tks_users.firebase_uid` で紐付け
- **招待フロー**: 管理者がメールアドレスとロールを指定して招待コード（UUID）を生成 → 招待リンクで新規登録
- **フロントエンド認可**: `AuthContext` で認証状態とユーザー情報を一元管理し、ロールに基づいてUI要素の表示/非表示を制御
- **Firebase設定**: 環境変数（`NEXT_PUBLIC_FIREBASE_*`）で管理

## Consequences

### Positive

- Firebase の安定した認証基盤を活用でき、パスワードハッシュ管理やセッション管理を自前で実装する必要がない
- 既存のSupabaseテーブル構造を大きく変更せず、`tks_users` テーブルの追加のみで済む
- 招待制によりアカウント作成を管理者が制御でき、不正アカウントの作成を防げる
- 将来的にGoogleログイン等のソーシャル認証を追加しやすい
- ロールが3段階（admin/editor/viewer）で、レシート登録・編集・閲覧のアクセス制御が明確

### Negative

- Firebase と Supabase の2つの外部サービスに依存するため、運用の複雑性が増す
- 現時点では権限チェックがクライアントサイドのみであり、Supabase RLS（Row Level Security）の設定が別途必要
- ユーザー削除時にFirebase Auth側のアカウントが残る（Firebase Admin SDK によるサーバーサイド処理が必要）
- 招待コードに有効期限がなく、セキュリティ上の改善が必要

## Compliance

- Firebase設定値はソースコードにハードコードせず、環境変数で管理する（`.env.example` にテンプレートを用意）
- 認証が必要なページは `(authenticated)` レイアウトグループ配下に配置し、`AuthContext` で認証チェックを行う
- ロールチェックは `useAuth()` フックから `tksUser.role` を参照する
- **TODO**: Supabase RLS を設定し、サーバーサイドでの認可を実装する
- **TODO**: 招待コードに有効期限を追加する
- **TODO**: ユーザー削除時のFirebase Auth アカウント削除をサーバーサイドで実装する

## Notes

- Author: Claude Code
- Version: 0.1
- Changelog:
  - 0.1: Initial proposed version
