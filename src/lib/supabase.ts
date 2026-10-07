import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const TARGET_SUPABASE_PROJECT_URL = 'https://yigwabbmjvzjajtwjkho.supabase.co';

export const getSupabaseUrl = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_SUPABASE_URL) return import.meta.env.VITE_SUPABASE_URL;
    if (import.meta.env.NEXT_PUBLIC_SUPABASE_URL) return import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
    if (import.meta.env.SUPABASE_URL) return import.meta.env.SUPABASE_URL;
  }
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('bmf4_supabase_url');
    if (customUrl) return customUrl;
    if ((window as any).VITE_SUPABASE_URL) return (window as any).VITE_SUPABASE_URL;
    if ((window as any).NEXT_PUBLIC_SUPABASE_URL) return (window as any).NEXT_PUBLIC_SUPABASE_URL;
    if ((window as any).SUPABASE_URL) return (window as any).SUPABASE_URL;
  }
  return TARGET_SUPABASE_PROJECT_URL;
};

export const getSupabaseAnonKey = (): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_SUPABASE_ANON_KEY) return import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (import.meta.env.SUPABASE_ANON_KEY) return import.meta.env.SUPABASE_ANON_KEY;
  }
  if (typeof window !== 'undefined') {
    const customKey = localStorage.getItem('bmf4_supabase_anon_key');
    if (customKey) return customKey;
    if ((window as any).VITE_SUPABASE_ANON_KEY) return (window as any).VITE_SUPABASE_ANON_KEY;
    if ((window as any).NEXT_PUBLIC_SUPABASE_ANON_KEY) return (window as any).NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if ((window as any).SUPABASE_ANON_KEY) return (window as any).SUPABASE_ANON_KEY;
  }
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';
};

export const isSupabaseConfigured = (): boolean => {
  const key = getSupabaseAnonKey();
  return Boolean(key && key !== 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder' && key.length > 20);
};

export const createSupabaseInstance = (url?: string, key?: string): SupabaseClient => {
  const finalUrl = url || getSupabaseUrl();
  const finalKey = key || getSupabaseAnonKey();
  return createClient(finalUrl, finalKey, {
    realtime: {
      params: {
        eventsPerSecond: 25,
      },
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
};

export const supabase = createSupabaseInstance();

export const saveSupabaseConfig = (url: string, anonKey: string) => {
  if (typeof window !== 'undefined') {
    if (url) localStorage.setItem('bmf4_supabase_url', url.trim());
    if (anonKey) localStorage.setItem('bmf4_supabase_anon_key', anonKey.trim());
  }
};

