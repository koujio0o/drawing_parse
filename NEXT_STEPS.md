# Drawing Parse プロジェクト - 次回作業の引き継ぎメモ

## 現在の進捗 (Phase 1 途中)
- **ブランチ**: `phase-1-hooks-backup` に作業状態をコミット済み。
- **完了した作業**:
  - 共通処理を担う6つのHookを作成完了 (`useUndoStack`, `useDrawingCanvas`, `useZoomControls`, `usePerspectiveCamera`, `useGifExport`, `useCanvasResize`)
  - 共通UIコンポーネント2つを作成完了 (`DrawingToolbar`, `PerspectiveControls`)
  - 上記を使った **`ProliferationMode.tsx` のリファクタリングが完了** (TypeScriptのビルドも通過)
- **中断理由**:
  - LLM APIのリソース制限到達のため、残り7モードの移行処理が中断。

## 次回やること
1. **残り7モードの移行作業（リファクタリング）**:
   `ProliferationMode.tsx` の新しい実装パターンを参考に、以下のコンポーネントを共通Hookを使う形に書き換えます。
   - `DiagonalCubeMode.tsx`
   - `SubtractionMode.tsx` (guideCanvasをextraCanvasRefsに渡す)
   - `RatioCuboidMode.tsx` (専用パレット `['#607d8b', '#ab47bc', '#81c784', '#64b5f6', '#111111']` を指定)
   - `RatioPlaneMode.tsx` (OrthographicCameraを使う特殊モードのため `usePerspectiveCamera` は使わない)
   - `SphereContourMode.tsx`
   - `CircleMode.tsx`
   - `SphereMode.tsx`

2. **モード固有のバグ修正（移行と同時対応）**:
   - `SphereContourMode.tsx`: `orientationType === 0` 時の `axisD` を `new THREE.Vector3(1, 0, 0)` に修正。
   - `SphereContourMode.tsx`: 答え合わせ時の描画キャンバス透過 (`opacity: isAnswerVisible ? 0.35 : 1`) の追加。

3. **検証**:
   すべてのモード移行完了後、 `npm run build` を実行して型エラーがないことを確認します。
