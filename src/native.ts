export type NativeDocumentReference = {
  id: string;
  name: string;
};

const nativeDocumentId = /^[0-9a-f-]{36}$/i;

export function parseNativeDocumentReferences(value: unknown): NativeDocumentReference[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const document = candidate as Partial<NativeDocumentReference>;
    if (typeof document.id !== "string" || !nativeDocumentId.test(document.id)) return [];
    if (typeof document.name !== "string") return [];
    const name = document.name.trim().slice(0, 240);
    if (!name) return [];
    return [{ id: document.id, name }];
  }).slice(0, 100);
}
