/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly QUESTIONS_CSV_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
