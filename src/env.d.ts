/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_MODEL_BASE_URL?: string;
  readonly PUBLIC_ORT_BASE_URL?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_CONTACT_EMAIL?: string;
  readonly PUBLIC_ALLOW_INFERENCE_MOCK?: string;
}
