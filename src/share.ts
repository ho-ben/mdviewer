export const maximumSharedFileSize = 20 * 1024 * 1024;

export type SharedPayload = {
  name: string;
  source: string;
};

function isFileLike(value: FormDataEntryValue): value is File {
  return typeof value !== "string"
    && typeof value.size === "number"
    && typeof value.arrayBuffer === "function";
}

function safeMarkdownName(title: string): string {
  const safeTitle = title.replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 80) || "Shared";
  return `${safeTitle}.md`;
}

export async function parseSharedFormData(data: FormData): Promise<SharedPayload> {
  const title = String(data.get("title") ?? "").trim();
  const text = String(data.get("text") ?? "").trim();
  const url = String(data.get("url") ?? "").trim();

  const preferredKeys = ["textFile", "markdown", "file", "files", "sharedFile"];
  const preferred = preferredKeys.flatMap((key) => data.getAll(key));
  const everyValue = [...data.values()];
  const sharedFile = [...preferred, ...everyValue].find(isFileLike);

  if (sharedFile) {
    if (sharedFile.size > maximumSharedFileSize) throw new Error("size");
    if (!sharedFile.size) throw new Error("empty");

    const source = new TextDecoder().decode(await sharedFile.arrayBuffer());
    if (!source.length) throw new Error("empty");
    return {
      source,
      name: sharedFile.name?.trim() || safeMarkdownName(title)
    };
  }

  const source = [title && `# ${title}`, text, url].filter(Boolean).join("\n\n");
  if (!source) throw new Error("missing");
  return { source, name: title ? safeMarkdownName(title) : "Shared.md" };
}
