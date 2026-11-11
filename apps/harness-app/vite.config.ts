import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));
const OUTPUT_HTML = "harness-app.html";

/** MCP Apps hosts load one HTML string, so inline every JS chunk and stylesheet into it. */
function inlineIntoHtml(): Plugin {
  return {
    name: "harness-inline-html",
    enforce: "post",
    generateBundle(_options, bundle) {
      const htmlFile = Object.values(bundle).find((file) => file.type === "asset" && file.fileName.endsWith(".html"));
      if (!htmlFile || htmlFile.type !== "asset") return;
      let html = String(htmlFile.source);

      for (const [fileName, file] of Object.entries(bundle)) {
        if (file.type === "chunk") {
          const code = file.code.replace(/<\/script/gi, "<\\/script");
          html = html.replace(
            new RegExp(`<script[^>]*src="[^"]*${escapeRegExp(fileName)}"[^>]*></script>`),
            () => `<script type="module">${code}</script>`,
          );
          delete bundle[fileName];
        } else if (fileName.endsWith(".css")) {
          const css = String(file.source).replace(/<\/style/gi, "<\\/style");
          html = html.replace(
            new RegExp(`<link[^>]*href="[^"]*${escapeRegExp(fileName)}"[^>]*>`),
            () => `<style>${css}</style>`,
          );
          delete bundle[fileName];
        }
      }

      htmlFile.source = html;
      htmlFile.fileName = OUTPUT_HTML;
    },
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default defineConfig({
  root,
  base: "./",
  logLevel: "warn",
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  plugins: [inlineIntoHtml()],
  build: {
    outDir: fileURLToPath(new URL("../../build/ui", import.meta.url)),
    emptyOutDir: true,
    target: "es2022",
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    reportCompressedSize: false,
    rollupOptions: {
      input: fileURLToPath(new URL("./index.html", import.meta.url)),
      output: { inlineDynamicImports: true },
      onwarn(warning, warn) {
        if (warning.code === "INVALID_ANNOTATION" && warning.id?.includes("node_modules")) return;
        warn(warning);
      },
    },
  },
});
