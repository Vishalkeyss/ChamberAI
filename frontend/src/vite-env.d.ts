/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PLATFORM_DOMAIN?: string;
  readonly VITE_TENANT_ROUTING?: 'subdomain' | 'path';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
