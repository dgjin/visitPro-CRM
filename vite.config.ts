import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // Manually map process.env to the loaded environment variables
      // Use JSON.stringify to ensure proper string format. Fallback to empty string if undefined to avoid "undefined" string literal issues.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || ''),
      'process.env.SUPABASE_KEY': JSON.stringify(env.SUPABASE_KEY || ''),
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY || ''),
      'process.env.IFLYTEK_APP_ID': JSON.stringify(env.IFLYTEK_APP_ID || ''),
      'process.env.IFLYTEK_API_SECRET': JSON.stringify(env.IFLYTEK_API_SECRET || ''),
      'process.env.IFLYTEK_API_KEY': JSON.stringify(env.IFLYTEK_API_KEY || ''),
      'process.env.IFLYTEK_DOMAIN': JSON.stringify(env.IFLYTEK_DOMAIN || ''),
      'process.env.IFLYTEK_STT_DOMAIN': JSON.stringify(env.IFLYTEK_STT_DOMAIN || ''),
    },
  };
});