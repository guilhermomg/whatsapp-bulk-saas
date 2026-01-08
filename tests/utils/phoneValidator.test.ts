import {
  validatePhoneNumber,
  validateAndFormatPhoneNumber,
  isPhoneNumberValid,
  toE164,
} from '../../src/validators/phoneValidator';
import { ValidationError } from '../../src/utils/errors';

describe('Phone Validator', () => {
  describe('validatePhoneNumber', () => {
    it('should validate and format US phone numbers', () => {
      const result = validatePhoneNumber('+14155552671');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+14155552671');
      expect(result.country).toBe('US');
    });

    it('should validate and format Brazilian phone numbers', () => {
      const result = validatePhoneNumber('+551199887766');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+551199887766');
      expect(result.country).toBe('BR');
    });

    it('should validate and format UK phone numbers', () => {
      const result = validatePhoneNumber('+447911123456');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+447911123456');
      // Note: This specific number might be identified as Guernsey (GG) which uses UK dialing code
      expect(['GB', 'GG']).toContain(result.country);
    });

    it('should reject invalid phone numbers', () => {
      const result = validatePhoneNumber('123');
      expect(result.isValid).toBe(false);
      expect(result.e164).toBeNull();
      expect(result.error).toBeDefined();
    });

    it('should reject empty phone numbers', () => {
      const result = validatePhoneNumber('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject non-numeric strings', () => {
      const result = validatePhoneNumber('abc');
      expect(result.isValid).toBe(false);
      expect(result.e164).toBeNull();
    });

    it('should handle phone numbers with spaces and dashes', () => {
      const result = validatePhoneNumber('+1 415-555-2671');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+14155552671');
    });

    it('should handle phone numbers without + prefix when given country', () => {
      const result = validatePhoneNumber('4155552671', 'US');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+14155552671');
    });
  });

  describe('validateAndFormatPhoneNumber', () => {
    it('should return E.164 format for valid phone numbers', () => {
      const formatted = validateAndFormatPhoneNumber('+14155552671');
      expect(formatted).toBe('+14155552671');
    });

    it('should throw ValidationError for invalid phone numbers', () => {
      expect(() => {
        validateAndFormatPhoneNumber('123');
      }).toThrow(ValidationError);
    });

    it('should throw ValidationError for empty phone numbers', () => {
      expect(() => {
        validateAndFormatPhoneNumber('');
      }).toThrow(ValidationError);
    });

    it('should format phone numbers with spaces', () => {
      const formatted = validateAndFormatPhoneNumber('+1 (415) 555-2671');
      expect(formatted).toBe('+14155552671');
    });
  });

  describe('isPhoneNumberValid', () => {
    it('should return true for valid phone numbers', () => {
      expect(isPhoneNumberValid('+14155552671')).toBe(true);
      expect(isPhoneNumberValid('+551199887766')).toBe(true);
      expect(isPhoneNumberValid('+447911123456')).toBe(true);
    });

    it('should return false for invalid phone numbers', () => {
      expect(isPhoneNumberValid('123')).toBe(false);
      expect(isPhoneNumberValid('abc')).toBe(false);
      expect(isPhoneNumberValid('')).toBe(false);
    });
  });

  describe('toE164', () => {
    it('should convert valid phone numbers to E.164', () => {
      expect(toE164('+14155552671')).toBe('+14155552671');
      expect(toE164('+1 415 555 2671')).toBe('+14155552671');
    });

    it('should return null for invalid phone numbers', () => {
      expect(toE164('123')).toBeNull();
      expect(toE164('abc')).toBeNull();
    });
  });
});
