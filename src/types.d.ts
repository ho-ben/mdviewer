declare module "markdown-it-abbr" {
  const plugin: (md: import("markdown-it").default, ...options: unknown[]) => void;
  export default plugin;
}

declare module "markdown-it-deflist" {
  const plugin: (md: import("markdown-it").default, ...options: unknown[]) => void;
  export default plugin;
}

declare module "markdown-it-emoji" {
  export const full: (md: import("markdown-it").default, ...options: unknown[]) => void;
}

declare module "markdown-it-footnote" {
  const plugin: (md: import("markdown-it").default, ...options: unknown[]) => void;
  export default plugin;
}

declare module "markdown-it-ins" {
  const plugin: (md: import("markdown-it").default, ...options: unknown[]) => void;
  export default plugin;
}

declare module "markdown-it-mark" {
  const plugin: (md: import("markdown-it").default, ...options: unknown[]) => void;
  export default plugin;
}

declare module "markdown-it-sub" {
  const plugin: (md: import("markdown-it").default, ...options: unknown[]) => void;
  export default plugin;
}

declare module "markdown-it-sup" {
  const plugin: (md: import("markdown-it").default, ...options: unknown[]) => void;
  export default plugin;
}

declare module "markdown-it-task-lists" {
  const plugin: (md: import("markdown-it").default, ...options: unknown[]) => void;
  export default plugin;
}
