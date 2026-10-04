import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env && (
    import.meta.env.VITE_SUPABASE_URL || 
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
    import.meta.env.SUPABASE_URL
  )) ||
  (typeof window !== 'undefined' && (
    (window as any).VITE_SUPABASE_URL || 
    (window as any).NEXT_PUBLIC_SUPABASE_URL ||
    (window as any).SUPABASE_URL
  )) ||
  'https://placeholder.supabase.co';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && import.meta.env && (
    import.meta.env.VITE_SUPABASE_ANON_KEY || 
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
    import.meta.env.SUPABASE_ANON_KEY
  )) ||
  (typeof window !== 'undefined' && (
    (window as any).VITE_SUPABASE_ANON_KEY || 
    (window as any).NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    (window as any).SUPABASE_ANON_KEY
  )) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 15,
    },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

