/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Figma file or prototype URL (Share → Copy link). Shown in the header when set. */
  readonly VITE_FIGMA_REFERENCE_URL?: string;
  /** Main title on the assessment page (default: AI Adoption Assessment). */
  readonly VITE_ASSESSMENT_TITLE?: string;
  /** Subtitle under the title. */
  readonly VITE_ASSESSMENT_SUBTITLE?: string;
  /** Year shown next to the title (default: current calendar year). */
  readonly VITE_ASSESSMENT_YEAR?: string;
  /** Prefill "Name of respondent" when session storage is empty. */
  readonly VITE_DEFAULT_RESPONDENT_NAME?: string;
  /** Prefill "Account name" when session storage is empty. */
  readonly VITE_DEFAULT_ACCOUNT_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
