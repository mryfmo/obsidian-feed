# Directory Restructuring Proposal

## 🎯 推奨案: 目的別の再編成

### 現状の問題点
1. `.mcp`という名前が一般的すぎる（MCPプロトコル全般を想起）
2. `tools`にClaude専用とプロジェクト汎用が混在
3. Claude統合の全体像が見えにくい

### 提案する新構造

```
obsidian-feed/
├── .claude/                       # Claude統合のホームディレクトリ
│   ├── README.md                 # 統合ガイド（既存）
│   ├── config/                   # 設定（既存）
│   ├── docs/                     # ドキュメント（既存）
│   ├── scripts/                  # 実行サイクルスクリプト（既存）
│   ├── workspace/                # 作業領域（既存）
│   ├── runtime/                  # 実行時ファイル（既存）
│   │
│   ├── mcp-integration/          # MCPプロトコル実装（.mcp/から移動）
│   │   ├── README.md            # MCP統合の説明
│   │   ├── index.ts             # エントリーポイント
│   │   ├── operation-guard.ts   # 安全性検証
│   │   ├── bridge.ts            # シェル→TypeScriptブリッジ
│   │   ├── package.json         # 独立したパッケージ
│   │   └── tests/               # MCPテスト
│   │
│   └── validation/               # Claude専用検証ツール
│       ├── turn-guard.sh        # tools/から移動
│       ├── validate-stp.sh      # tools/から移動・改名
│       └── README.md            # 検証ツールの説明
│
└── tools/                        # プロジェクト汎用ツール
    ├── fetch-doc.sh             # 汎用ドキュメント取得
    ├── gen-wbs.sh               # 汎用WBS生成
    ├── gen-wbs.py               # Python版WBS
    └── list-guards.sh           # ガード一覧（汎用）
```

### 移行による利点

1. **明確な所属**
   - Claude関連はすべて`.claude/`配下
   - MCPは「統合」として位置づけ
   - 汎用ツールは`tools/`に残存

2. **発見しやすさ**
   - `.claude/`を見ればClaude統合の全体像が把握可能
   - 各サブディレクトリが明確な役割

3. **保守性向上**
   - Claude固有の変更が`.claude/`に集約
   - 汎用ツールの独立性維持

### 移行計画

#### Phase 1: 準備（非破壊的）
```bash
# 1. 新ディレクトリ作成
mkdir -p .claude/mcp-integration
mkdir -p .claude/validation

# 2. ファイルコピー（gitログ保持）
git mv .mcp/* .claude/mcp-integration/
git mv tools/turn_guard.sh .claude/validation/turn-guard.sh
git mv tools/validate-stp-markers.sh .claude/validation/validate-stp.sh
```

#### Phase 2: 参照更新
1. **GitHub Workflows** (5ファイル)
   ```yaml
   # 変更前
   - run: ./tools/validate-stp-markers.sh
   # 変更後
   - run: ./.claude/validation/validate-stp.sh
   ```

2. **ドキュメント** (40+ファイル)
   - 一括置換スクリプトで対応

3. **ブリッジパターン** (7ファイル)
   ```bash
   # 変更前
   if [ -f ".mcp/bridge.ts" ]
   # 変更後
   if [ -f ".claude/mcp-integration/bridge.ts" ]
   ```

#### Phase 3: 検証
- すべてのGitHub Actionsが成功
- テストがすべてパス
- ドキュメントのリンクが有効

#### Phase 4: クリーンアップ
- 古いディレクトリを削除
- .gitignoreを更新

### リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 外部参照の破損 | 中 | 事前に全参照を検索・リスト化 |
| CI/CDの失敗 | 高 | ブランチでテスト後にマージ |
| 開発者の混乱 | 低 | 明確な移行ガイドを提供 |

### 代替案との比較

| 案 | 利点 | 欠点 |
|----|------|------|
| 現状維持 | 変更不要 | 構造が不明確なまま |
| すべて.claude/へ | 完全統合 | 汎用ツールも巻き込む |
| **目的別再編成** | **明確で発見しやすい** | **移行作業が必要** |

### 実装判断

移行のコストは中程度だが、長期的な保守性とClaude統合の明確化を考慮すると、**目的別再編成を推奨**します。

特に：
- MCPが「Model Context Protocol」の一般実装でなく「Claude MCP統合」であることが明確になる
- 新規開発者がClaude関連機能を探しやすくなる
- 将来的な拡張（新しい検証ツールなど）の配置が明確