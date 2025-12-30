# Vector DB Test Application

TypeScript + OpenAI Embedding + pgvector を使用したベクトルデータベースのテストアプリケーション

## クイックスタート

### 1. 環境変数の設定

```bash
cp .env.example .env
# .env を編集して OPENAI_API_KEY を設定
```

### 2. Docker コンテナの起動

```bash
docker-compose up -d --build
```

### 3. 動作確認

```bash
# ヘルスチェック
curl http://localhost:3000/health

# ドキュメント追加
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{"content": "これはテストドキュメントです"}'

# 類似検索
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "テスト", "limit": 5}'
```

---

## 🛠 技術スタック

| コンポーネント | 技術                                |
| -------------- | ----------------------------------- |
| Backend        | TypeScript, Node.js, Express        |
| Validation     | Zod                                 |
| Embedding      | OpenAI API (text-embedding-3-small) |
| Database       | PostgreSQL + pgvector               |
| Testing        | Vitest, Supertest                   |
| Container      | Docker, Docker Compose              |

---

## 📁 プロジェクト構成

```
test-vector/
├── docker-compose.yml           # 本番用Docker設定
├── docker-compose.test.yml      # テスト用Docker設定
├── .env.example                 # 環境変数テンプレート
├── backend/                     # TypeScriptアプリケーション
│   ├── src/
│   │   ├── index.ts             # エントリーポイント
│   │   ├── config/              # DB接続設定
│   │   ├── middleware/          # Zodバリデーション
│   │   ├── schemas/             # Zodスキーマ定義
│   │   ├── services/            # ビジネスロジック
│   │   ├── models/              # 型定義
│   │   └── routes/              # APIルート
│   ├── tests/                   # テストコード
│   └── vitest.config.ts
├── db/                          # PostgreSQL + pgvector
│   └── init/                    # DB初期化SQL
└── docs/                        # ドキュメント
```

---

## 📚 API エンドポイント

| メソッド | エンドポイント       | 説明               |
| -------- | -------------------- | ------------------ |
| GET      | `/health`            | ヘルスチェック     |
| POST     | `/api/documents`     | ドキュメント追加   |
| GET      | `/api/documents`     | 全ドキュメント取得 |
| DELETE   | `/api/documents/:id` | ドキュメント削除   |
| POST     | `/api/search`        | 類似検索           |

---

## 🧪 テスト

```bash
# テスト用DBを起動
docker compose -f docker-compose.test.yml up -d

# テスト実行
cd backend && npm test

# テスト用DBを停止
docker compose -f docker-compose.test.yml down
```

詳細は [docs/testing.md](docs/testing.md) を参照してください。

---

## 🔧 開発コマンド

```bash
# コンテナ起動
docker-compose up -d --build

# コンテナ停止
docker-compose down

# DBデータも含めて完全削除
docker-compose down -v

# ログ確認
docker-compose logs -f backend

# DBに直接接続
docker-compose exec db psql -U vectoruser -d vectordb
```

---

## 📖 ドキュメント

| ドキュメント                                                 | 内容                   |
| ------------------------------------------------------------ | ---------------------- |
| [docs/testing.md](docs/testing.md)                           | テスト環境・実行方法   |
| [docs/test-plan.md](docs/test-plan.md)                       | テスト計画・CI/CD 連携 |
| [docs/implementation-guide.md](docs/implementation-guide.md) | 実装手順書             |

---

## ☁️ 本番環境 (AWS)

| 環境         | Database          | Backend          |
| ------------ | ----------------- | ---------------- |
| ローカル開発 | Docker (pgvector) | Docker (Node.js) |
| 本番 (AWS)   | RDS PostgreSQL    | ECS Fargate      |

**RDS PostgreSQL は pgvector をサポート**しています（PostgreSQL 15.2+）。
接続先の切り替えは環境変数のみで対応可能です。

---

## ⚠️ 注意事項

- OpenAI API の利用には料金が発生します
- `.env` ファイルは Git 管理外にしてください
- 本番環境では強固なパスワードと Secrets Manager を使用してください

---

## 📄 ライセンス

MIT License
