import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// import.meta.dirnameの代替（ビルド後でも動作する）
const getDirname = (): string => {
  // 開発環境ではimport.meta.dirnameを使用
  if (import.meta.dirname && typeof import.meta.dirname === 'string') {
    return import.meta.dirname;
  }
  
  // 本番環境（esbuildでバンドル後）では、import.meta.urlから取得を試みる
  try {
    const url = import.meta.url;
    if (url && typeof url === 'string' && url.startsWith('file://')) {
      const filePath = fileURLToPath(url);
      const dir = path.dirname(filePath);
      if (dir && typeof dir === 'string') {
        return dir;
      }
    }
  } catch (e) {
    // フォールバック: プロセスカレントディレクトリを使用
    console.warn('[Vite Config] Failed to get dirname from import.meta.url, using process.cwd()');
  }
  
  // 最終フォールバック: プロセスカレントディレクトリ（必ず文字列を返す）
  const cwd = process.cwd();
  return cwd && typeof cwd === 'string' ? cwd : '/app';
};

const templateRoot = getDirname();

const plugins = [react(), tailwindcss(), jsxLocPlugin(), vitePluginManusRuntime()];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  envDir: path.resolve(templateRoot),
  root: path.resolve(templateRoot, "client"),
  publicDir: path.resolve(templateRoot, "client", "public"),
  build: {
    outDir: path.resolve(templateRoot, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 4000, // middlewareModeでは実際には使われません（Expressサーバーのポートが使用されます）
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
