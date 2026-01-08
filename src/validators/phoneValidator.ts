import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';
import { ValidationError } from '../utils/errors';

/**
 * Phone number validator utility using libphonenumber-js
 * Validates and formats phone numbers to E.164 format
 */

export interface PhoneValidationResult {
  isValid: boolean;
  e164: string | null;
  country: string | null;
  isMobile: boolean | null;
  error?: string;
}

/**
 * Validate and parse a phone number to E.164 format
 * @param phoneNumber - Phone number string (can be in various formats)
 * @param defaultCountry - Optional default country code for parsing
 * @returns PhoneValidationResult with validation details
 */
export function validatePhoneNumber(
  phoneNumber: string,
  defaultCountry?: CountryCode,
): PhoneValidationResult {
  try {
    // Check if phone number is empty
    if (!phoneNumber || phoneNumber.trim().length === 0) {
      return {
        isValid: false,
        e164: null,
        country: null,
        isMobile: null,
        error: 'Phone number is required',
      };
    }

    const trimmedPhone = phoneNumber.trim();

    // First check if it's a valid phone number
    const isValid = isValidPhoneNumber(trimmedPhone, defaultCountry);

    if (!isValid) {
      return {
        isValid: false,
        e164: null,
        country: null,
        isMobile: null,
        error: 'Invalid phone number format',
      };
    }

    // Parse the phone number
    const phoneNumberObj = parsePhoneNumber(trimmedPhone, defaultCountry);

    if (!phoneNumberObj) {
      return {
        isValid: false,
        e164: null,
        country: null,
        isMobile: null,
        error: 'Could not parse phone number',
      };
    }

    // Get E.164 format
    const e164 = phoneNumberObj.format('E.164');

    // Check if it's a mobile number
    const phoneType = phoneNumberObj.getType();
    const isMobile = phoneType === 'MOBILE'
                     || phoneType === 'FIXED_LINE_OR_MOBILE';

    return {
      isValid: true,
      e164,
      country: phoneNumberObj.country || null,
      isMobile,
    };
  } catch (error) {
    return {
      isValid: false,
      e164: null,
      country: null,
      isMobile: null,
      error: error instanceof Error ? error.message : 'Phone number validation failed',
    };
  }
}

/**
 * Validate phone number and return E.164 format or throw ValidationError
 * @param phoneNumber - Phone number string
 * @param defaultCountry - Optional default country code
 * @returns E.164 formatted phone number
 * @throws ValidationError if phone number is invalid
 */
export function validateAndFormatPhoneNumber(
  phoneNumber: string,
  defaultCountry?: CountryCode,
): string {
  const result = validatePhoneNumber(phoneNumber, defaultCountry);

  if (!result.isValid || !result.e164) {
    throw new ValidationError(result.error || 'Invalid phone number');
  }

  return result.e164;
}

/**
 * Check if a phone number is valid (boolean check)
 * @param phoneNumber - Phone number string
 * @param defaultCountry - Optional default country code
 * @returns true if valid, false otherwise
 */
export function isPhoneNumberValid(
  phoneNumber: string,
  defaultCountry?: CountryCode,
): boolean {
  const result = validatePhoneNumber(phoneNumber, defaultCountry);
  return result.isValid;
}

/**
 * Convert phone number to E.164 format without validation
 * @param phoneNumber - Phone number string
 * @param defaultCountry - Optional default country code
 * @returns E.164 format or null if parsing fails
 */
export function toE164(phoneNumber: string, defaultCountry?: CountryCode): string | null {
  try {
    const phoneNumberObj = parsePhoneNumber(phoneNumber, defaultCountry);
    return phoneNumberObj ? phoneNumberObj.format('E.164') : null;
  } catch (error) {
    return null;
  }
}

/**
 * Custom Joi validator for phone numbers
 * Can be used in Joi schemas with .custom() method
 */
export function joiPhoneValidator(value: string, helpers: any) {
  const result = validatePhoneNumber(value);

  if (!result.isValid) {
    return helpers.error('any.invalid', {
      message: result.error || 'Invalid phone number format. Must be in E.164 format (e.g., +14155552671)',
    });
  }

  // Return the E.164 formatted number
  return result.e164;
}
