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
  // Destructure to exclude sensitive fields (intentionally unused)
  const {
    password: UNUSED_PASSWORD, // eslint-disable-line @typescript-eslint/no-unused-vars
    emailVerificationToken: UNUSED_EVT, // eslint-disable-line @typescript-eslint/no-unused-vars
    passwordResetToken: UNUSED_PRT, // eslint-disable-line @typescript-eslint/no-unused-vars
    passwordResetExpires: UNUSED_PRE, // eslint-disable-line @typescript-eslint/no-unused-vars
    ...safeUser
  } = user;

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
