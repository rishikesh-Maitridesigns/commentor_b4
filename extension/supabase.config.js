const SUPABASE_CONFIG = {
  url: 'https://kfhemlqgwfkbqpoqsjgn.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGVtbHFnd2ZrYnFwb3FzamduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MjY1ODUsImV4cCI6MjA3OTMwMjU4NX0.TGXLn91XAHMtCwAaXjWi3E4Z79OxJnJRZPgGV2SYOhw'
};

const getSupabaseUrl = () => SUPABASE_CONFIG.url;
const getSupabaseAnonKey = () => SUPABASE_CONFIG.anonKey;
const getApiUrl = () => `${SUPABASE_CONFIG.url}/rest/v1`;
const getAuthUrl = () => `${SUPABASE_CONFIG.url}/auth/v1`;
