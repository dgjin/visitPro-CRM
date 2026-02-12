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
      // Use logical OR to ensure undefined values don't become string "undefined" if using JSON.stringify incorrectly elsewhere,
      // though JSON.stringify(undefined) returns undefined which is valid for omitting the key in define sometimes,
      // but explicitly setting to undefined works best.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL),
      'process.env.SUPABASE_KEY': JSON.stringify(env.SUPABASE_KEY),
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY),
      'process.env.IFLYTEK_APP_ID': JSON.stringify(env.IFLYTEK_APP_ID),
      'process.env.IFLYTEK_API_SECRET': JSON.stringify(env.IFLYTEK_API_SECRET),
      'process.env.IFLYTEK_API_KEY': JSON.stringify(env.IFLYTEK_API_KEY),
      'process.env.IFLYTEK_DOMAIN': JSON.stringify(env.IFLYTEK_DOMAIN),
      'process.env.IFLYTEK_STT_DOMAIN': JSON.stringify(env.IFLYTEK_STT_DOMAIN),
    },
  };
});