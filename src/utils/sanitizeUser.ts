import { User } from '@prisma/client';

/**
 * Sanitizes user data by removing sensitive fields
 * @param user - User object from database
 * @returns Sanitized user object without sensitive data
 */
export function sanitizeUser(
  user: User,
): Omit<
  User,
  'password' | 'emailVerificationToken' | 'passwordResetToken' | 'passwordResetExpires'
> {
  // Destructure to exclude sensitive fields
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, emailVerificationToken, passwordResetToken, passwordResetExpires, ...safeUser } =
    user;

  return safeUser;
}

/**
 * Sanitizes multiple user objects
 * @param users - Array of user objects
 * @returns Array of sanitized user objects
 */
export function sanitizeUsers(users: User[]): ReturnType<typeof sanitizeUser>[] {
  return users.map(sanitizeUser);
}
