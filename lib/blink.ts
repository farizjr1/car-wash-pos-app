import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://vuihxmrcfrrzggdaaxxn.supabase.co';
const supabaseAnonKey = 'sb_publishable_Cir8_aax6wvEtInFv8Uicw_kMB6F6Fj';

export const blink = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
