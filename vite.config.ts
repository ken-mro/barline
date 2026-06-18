/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// GitHub Pages はリポジトリ名配下で配信されるため base を設定する。
// （ユーザー/組織ページや独自ドメインの場合は "/" に変更する）
export default defineConfig({
  base: "/barline/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // 大きめのベンダーを分割してキャッシュ効率を上げる。
        manualChunks: {
          tone: ["tone"],
          vexflow: ["vexflow"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
