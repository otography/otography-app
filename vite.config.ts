import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    // ツールが生成するファイルは整形しない。
    // routeTree.gen.ts は開発サーバーが起動中に書き直すので、整形すると差分が出続ける。
    ignorePatterns: ["**/migrations/**/snapshot.json", "**/routeTree.gen.ts"],
  },
  // run.cache は設定せず、Vite+ の既定（package.json のスクリプトはキャッシュしない）にしている。
  // db:migrate や deploy のようにデータベースや外部のサービスを変更するスクリプトがキャッシュされると、
  // 2 回目以降は実行されず、前回の出力が表示されるだけになるためである。
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
});
