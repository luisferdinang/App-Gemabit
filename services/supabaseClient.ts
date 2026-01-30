import { createClient } from '@supabase/supabase-js';

// Configuration from user prompt
const SUPABASE_URL = 'https://rbnzludkrwgnajwymvza.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jTrkhkh4hgJWyzVtgRrTsg_oKUMvgan';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);