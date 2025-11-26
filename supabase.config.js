export const SUPABASE_CONFIG = {
  url: 'https://evpskuhskpmrbbihdihd.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2cHNrdWhza3BtcmJiaWhkaWhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2MTk3MTQsImV4cCI6MjA3OTE5NTcxNH0.1TFjxV7csnWm6cZTFIoreeEctFF799fruxGJByyV1kQ'
};

export const getSupabaseUrl = () => SUPABASE_CONFIG.url;
export const getSupabaseAnonKey = () => SUPABASE_CONFIG.anonKey;
export const getApiUrl = () => `${SUPABASE_CONFIG.url}/rest/v1`;
export const getAuthUrl = () => `${SUPABASE_CONFIG.url}/auth/v1`;

export default SUPABASE_CONFIG;
