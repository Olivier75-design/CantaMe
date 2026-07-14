import { getSupabaseBrowser } from './supabase';

// Client helper: build an Authorization header from the current Supabase
// session so API routes can verify the caller and derive their user id from the
// token (never trust a userId sent in the body).
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await getSupabaseBrowser().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
