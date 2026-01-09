/**
 * Constants for template validation
 */

/**
 * Valid language codes for WhatsApp templates (ISO 639-1 with locale)
 * These are the most commonly used language codes supported by WhatsApp
 */
export const SUPPORTED_LANGUAGE_CODES = [
  'en_US', // English (US)
  'en_GB', // English (UK)
  'es_ES', // Spanish (Spain)
  'es_MX', // Spanish (Mexico)
  'pt_BR', // Portuguese (Brazil)
  'pt_PT', // Portuguese (Portugal)
  'fr_FR', // French (France)
  'de_DE', // German (Germany)
  'it_IT', // Italian (Italy)
  'nl_NL', // Dutch (Netherlands)
  'ru_RU', // Russian (Russia)
  'ar_AR', // Arabic
  'hi_IN', // Hindi (India)
  'id_ID', // Indonesian (Indonesia)
  'ja_JP', // Japanese (Japan)
  'ko_KR', // Korean (Korea)
  'zh_CN', // Chinese (Simplified)
  'zh_TW', // Chinese (Traditional)
];

/**
 * Template component limits as per WhatsApp API
 */
export const TEMPLATE_LIMITS = {
  BODY_MAX_LENGTH: 1024,
  HEADER_TEXT_MAX_LENGTH: 60,
  FOOTER_MAX_LENGTH: 60,
  BUTTON_TEXT_MAX_LENGTH: 25,
  MAX_BUTTONS: 3,
  NAME_MAX_LENGTH: 512,
};
