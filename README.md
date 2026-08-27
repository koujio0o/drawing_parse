# concept
空間感覚を養うためのアプリです。
最も大事なことは、問題として与えられたお題に対してユーザーが空間感覚を使って図形を描きます。その際にどのように間違っていたかユーザーが把握できて自分の空間感覚の歪みを修正するためのフィードバックを返すことです。正しいパースに則った線を弾けるかが最も大事な訓練内容です。
正解と比較するためには、ユーザーにここに線を描けというガイドが必要なのを理解してほしいです。完全に答えを見せては意味がないけど、ここを起点にパースを推測して描けというガイドは必要です。ここは難しいと思いますが伝わりますか。

どのようなアプリが適切かわかっていません。よりよいアイデアを提案してほしいです。

空間感覚を推測するには、お題に対して、これと同じ大きさとか、2倍というわかりやすい指標が役に立ちます。3.2倍とか、6倍とか曖昧すぎて推測には不適切なお題です。
45度の線をひくとかは適切なお題です。



# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Deploy (デプロイ方法)

このプロジェクトは GitHub Actions を使用して GitHub Pages に自動デプロイされるよう設定されています。
変更をコミットし、以下のコマンドで GitHub にプッシュすることでデプロイが実行されます。

```bash
git add .
git commit -m "コミットメッセージ"
git push origin phase-2-strokes-orbit
```
※ `main` ブランチへプッシュした場合も同様にデプロイされます。
