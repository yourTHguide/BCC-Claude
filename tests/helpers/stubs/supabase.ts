// Stub: hands the route the in-memory test database.
export function getServiceSupabase() {
  return (globalThis as any).__db
}
