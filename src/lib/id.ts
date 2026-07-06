/** Small unique-id generator for client-created entities (temporary until DB ids in Fase 5). */
export function uid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
