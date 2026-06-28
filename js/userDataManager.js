import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://dcdcuzfvnafvqazbjcor.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Dc7d2wJF_UK_n6qtz_uUvw_FnYb5s_W";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== AUTH =====================

async function requireAuth() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ===================== EVENT BUS =====================

const listeners = {};

function emit(event, payload) {
  (listeners[event] || []).forEach(fn => fn(payload));
}

export function on(event, fn) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
  return () => { listeners[event] = listeners[event].filter(f => f !== fn); };
}

// ===================== GENERIC READ =====================

/**
 * Fetches all rows from a table for the current user.
 * RLS handles user isolation — no manual user_id filter needed.
 *
 * @param {string} tableName - 'favorites' | 'played_games' | 'lists' | 'reviews'
 * @param {object} [opts] - Optional: { select, order, ascending, filters }
 * @returns {{ data: Array, error?: string }}
 */
export async function fetch(tableName, opts = {}) {
  const user = await requireAuth();
  if (!user) return { data: [], error: "You must be signed in." };

  let query = supabase.from(tableName).select(opts.select || "*");

  if (opts.filters) {
    for (const [col, val] of Object.entries(opts.filters)) {
      query = query.eq(col, val);
    }
  }

  const orderCol = opts.order || "created_at";
  query = query.order(orderCol, { ascending: opts.ascending ?? false });

  const { data, error } = await query;

  if (error) {
    console.error(`fetch(${tableName}) error:`, error.message);
    return { data: [], error: `Failed to load ${tableName}.` };
  }

  return { data: data || [] };
}

// ===================== GENERIC INSERT =====================

/**
 * Inserts a row into any table. RLS and user_id default are handled server-side.
 *
 * @param {string} tableName
 * @param {object} payload - Column values to insert (game_id, rating, etc.)
 * @returns {{ data: object|null, error?: string }}
 */
export async function save(tableName, payload) {
  const user = await requireAuth();
  if (!user) return { data: null, error: "You must be signed in." };

  const { data, error } = await supabase
    .from(tableName)
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error(`save(${tableName}) error:`, error.message);
    return { data: null, error: `Failed to save to ${tableName}.` };
  }

  emit("change", { table: tableName, action: "insert", data });
  return { data, error: null };
}

// ===================== GENERIC UPSERT =====================

/**
 * Upserts a row (inserts or updates on conflict).
 * Useful for reviews where one user = one review per game.
 *
 * @param {string} tableName
 * @param {object} payload - Must include the conflict column (e.g. game_id + user_id)
 * @param {string[]} onConflict - Columns that define uniqueness
 * @returns {{ data: object|null, error?: string }}
 */
export async function upsert(tableName, payload, onConflict) {
  const user = await requireAuth();
  if (!user) return { data: null, error: "You must be signed in." };

  let query = supabase.from(tableName).upsert(payload);
  if (onConflict) query = query.select().single();
  else query = query.select().single();

  const { data, error } = await query;

  if (error) {
    console.error(`upsert(${tableName}) error:`, error.message);
    return { data: null, error: `Failed to upsert to ${tableName}.` };
  }

  emit("change", { table: tableName, action: "upsert", data });
  return { data, error: null };
}

// ===================== GENERIC UPDATE =====================

/**
 * Updates rows matching a filter condition.
 *
 * @param {string} tableName
 * @param {object} payload - Columns to update
 * @param {object} match - { column: value } to identify which row(s)
 * @returns {{ data: object|null, error?: string }}
 */
export async function update(tableName, payload, match) {
  const user = await requireAuth();
  if (!user) return { data: null, error: "You must be signed in." };

  let query = supabase.from(tableName).update(payload);
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val);
  }
  query = query.select().single();

  const { data, error } = await query;

  if (error) {
    console.error(`update(${tableName}) error:`, error.message);
    return { data: null, error: `Failed to update ${tableName}.` };
  }

  emit("change", { table: tableName, action: "update", data });
  return { data, error: null };
}

// ===================== GENERIC DELETE =====================

/**
 * Deletes rows matching a filter condition.
 *
 * @param {string} tableName
 * @param {object} match - { column: value } to identify which row(s)
 * @returns {{ success: boolean, error?: string }}
 */
export async function remove(tableName, match) {
  const user = await requireAuth();
  if (!user) return { success: false, error: "You must be signed in." };

  let query = supabase.from(tableName).delete();
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val);
  }

  const { error } = await query;

  if (error) {
    console.error(`remove(${tableName}) error:`, error.message);
    return { success: false, error: `Failed to delete from ${tableName}.` };
  }

  emit("change", { table: tableName, action: "delete", match });
  return { success: true, error: null };
}

// ===================== SINGLE ROW LOOKUP =====================

/**
 * Finds one row by a match condition.
 *
 * @param {string} tableName
 * @param {object} match - { column: value }
 * @returns {{ data: object|null, error?: string }}
 */
export async function findOne(tableName, match) {
  const user = await requireAuth();
  if (!user) return { data: null, error: "You must be signed in." };

  let query = supabase.from(tableName).select("*");
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val);
  }
  query = query.maybeSingle();

  const { data, error } = await query;

  if (error) {
    console.error(`findOne(${tableName}) error:`, error.message);
    return { data: null, error: `Failed to query ${tableName}.` };
  }

  return { data, error: null };
}

// ===================== EXPORTS =====================

export { supabase };
