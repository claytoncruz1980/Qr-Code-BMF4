import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof window !== 'undefined' && (window as any).VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = (typeof window !== 'undefined' && (window as any).VITE_SUPABASE_ANON_KEY) || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 15,
    },
  },
});
