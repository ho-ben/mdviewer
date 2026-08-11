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
      includeAssets: ["icon-192.png", "icon-512.png", "icon-maskable-512.png"],
      manifest: {
        id: "./",
        name: "MD Viewer",
        short_name: "MD Viewer",
        description: "Open Markdown files with tables, math, diagrams, and more — entirely on your device.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone"],
        background_color: "#f6f3ec",
        theme_color: "#f6f3ec",
        categories: ["productivity", "utilities"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
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
                name: "markdown",
                accept: ["text/markdown", "text/plain", ".md", ".markdown", ".mdown", ".mkd", ".txt"]
              }
            ]
          }
        },
        file_handlers: [
          {
            action: "./",
            accept: {
              "text/markdown": [".md", ".markdown", ".mdown", ".mkd"],
              "text/plain": [".md", ".markdown", ".mdown", ".mkd", ".txt"]
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
