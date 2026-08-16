import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cvpjzaiurdpdvgostjqj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_CZbSAgHff0Z_FyJMvoLiPg_Gq-CC30R";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
