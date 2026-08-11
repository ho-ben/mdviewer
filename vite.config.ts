import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["icon-mark-192.png", "icon-mark-512.png", "icon-mark-maskable-512.png"],
      manifest: {
        id: "./",
        name: "MD Viewer",
        short_name: "MD Viewer",
        description: "Open Markdown, logs, and common text files entirely on your device.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        background_color: "#f6f3ec",
        theme_color: "#f6f3ec",
        categories: ["productivity", "utilities"],
        icons: [
          { src: "icon-mark-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-mark-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-mark-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ],
        share_target: {
          action: "share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            title: "title",
            text: "text",
            url: "url",
            files: [
              {
                name: "textFile",
                accept: ["text/*", "application/json", "application/xml", "application/x-yaml", ".md", ".markdown", ".mdown", ".mkd", ".txt", ".text", ".log", ".out", ".err", ".csv", ".tsv", ".json", ".jsonl", ".yaml", ".yml", ".toml", ".ini", ".conf", ".cfg", ".xml"]
              }
            ]
          }
        },
        file_handlers: [
          {
            action: "./",
            accept: {
              "text/markdown": [".md", ".markdown", ".mdown", ".mkd"],
              "text/plain": [".txt", ".text", ".log", ".out", ".err", ".csv", ".tsv", ".toml", ".ini", ".conf", ".cfg", ".properties", ".html", ".css", ".js", ".ts", ".py", ".rb", ".go", ".rs", ".java", ".kt", ".c", ".h", ".cpp", ".hpp", ".sh", ".sql", ".tex", ".diff", ".patch"],
              "application/json": [".json", ".jsonl", ".ndjson"],
              "application/xml": [".xml"],
              "application/x-yaml": [".yaml", ".yml"]
            }
          }
        ],
        launch_handler: {
          client_mode: ["focus-existing", "auto"]
        }
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,woff2}"],
        globIgnores: ["og.png"]
      },
      devOptions: {
        enabled: true,
        type: "module"
      }
    })
  ],
  test: {
    environment: "jsdom"
  }
});
