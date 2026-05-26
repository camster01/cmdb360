// genId is kept for any legacy use; the server now manages all data
export function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}
