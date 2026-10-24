export type ReplaceableDocument = {
  name: string;
  source: string;
  kind: string;
  scrollY: number;
};

export function replaceDocumentByName<T extends ReplaceableDocument>(
  documents: T[],
  name: string,
  source: string,
  kind: string
): T | undefined {
  let existing: T | undefined;
  for (let index = documents.length - 1; index >= 0; index -= 1) {
    if (documents[index].name === name) {
      existing = documents[index];
      break;
    }
  }
  if (!existing) return undefined;

  existing.source = source;
  existing.kind = kind;
  existing.scrollY = 0;
  return existing;
}
