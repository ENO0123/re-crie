import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

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
    console.warn('[Vitest Config] Failed to get dirname from import.meta.url, using process.cwd()');
  }
  
  // 最終フォールバック: プロセスカレントディレクトリ（必ず文字列を返す）
  const cwd = process.cwd();
  return cwd && typeof cwd === 'string' ? cwd : '/app';
};

const templateRoot = getDirname();

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
  },
});
