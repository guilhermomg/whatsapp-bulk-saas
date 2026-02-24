import {
  validatePhoneNumber,
  validateAndFormatPhoneNumber,
} from '../../src/validators/phoneValidator';
import { ValidationError } from '../../src/utils/errors';

describe('Phone Validator', () => {
  describe('validatePhoneNumber', () => {
    it('should validate and format international phone numbers', () => {
      const result = validatePhoneNumber('+14155552671');
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe('+14155552671');
    });

    it('should reject invalid phone numbers', () => {
      const result = validatePhoneNumber('123');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle phone numbers with formatting', () => {
      const result = validatePhoneNumber('+1 (415) 555-2671');
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
        validateAndFormatPhoneNumber('invalid');
      }).toThrow(ValidationError);
    });
  });
});

