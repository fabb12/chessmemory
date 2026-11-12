import type { SupabaseClient } from '@supabase/supabase-js';

/** Client Supabase finto: tabelle in memoria, solo le chiamate usate dall'app. */
export function fakeSupabase(tables: Record<string, Record<string, unknown>[]> = {}) {
  const calls: { table: string; op: string; payload?: unknown }[] = [];
  const client = {
    from(table: string) {
      const rows = (tables[table] ??= []);
      return {
        select(columns: string) {
          return {
            eq(column: string, value: unknown) {
              return {
                async maybeSingle() {
                  calls.push({ table, op: 'select', payload: columns });
                  const row = rows.find((r) => r[column] === value);
                  return { data: row ?? null, error: null };
                },
              };
            },
          };
        },
        async upsert(row: Record<string, unknown>) {
          calls.push({ table, op: 'upsert', payload: row });
          const index = rows.findIndex((r) => r.user_id === row.user_id);
          if (index >= 0) rows[index] = { ...rows[index], ...row };
          else rows.push(row);
          return { error: null };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls, tables };
}
