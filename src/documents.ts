export type ReplaceableDocument = {
  name: string;
  source: string;
  kind: string;
  scrollY: number;
};

type NamedDocument = Pick<ReplaceableDocument, "kind" | "name">;

export function removeWelcomeDemoDocuments<T extends NamedDocument>(documents: T[]): boolean {
  let removed = false;
  for (let index = documents.length - 1; index >= 0; index -= 1) {
    const document = documents[index];
    if (document.kind === "Demo document" && document.name === "Welcome.md") {
      documents.splice(index, 1);
      removed = true;
    }
  }
  return removed;
}

export function isCloseTabShortcut(
  event: Pick<KeyboardEvent, "altKey" | "code" | "ctrlKey" | "metaKey" | "repeat">
): boolean {
  return event.altKey && !event.ctrlKey && !event.metaKey && !event.repeat && event.code === "KeyW";
}

export function replaceDocumentByName<T extends ReplaceableDocument>(
  documents: T[],
  name: string,
  source: string,
  kind: string
): T | undefined {
  let existing: T | undefined;
  let existingIndex = -1;
  for (let index = documents.length - 1; index >= 0; index -= 1) {
    if (documents[index].name === name) {
      existing = documents[index];
      existingIndex = index;
      break;
    }
  }
  if (!existing) return undefined;

  for (let index = existingIndex - 1; index >= 0; index -= 1) {
    if (documents[index].name === name) documents.splice(index, 1);
  }

  existing.source = source;
  existing.kind = kind;
  existing.scrollY = 0;
  return existing;
}
