/**
 * Shared password policy for registration, invites, and password changes.
 */

export const MIN_PASSWORD_LENGTH = Number(process.env.MIN_PASSWORD_LENGTH || 8);
export const MAX_PASSWORD_LENGTH = 128;

export function assertPasswordPolicy(password) {
  if (password == null || typeof password !== 'string') {
    const err = new Error('Password is required');
    err.status = 400;
    throw err;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    const err = new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
    err.status = 400;
    throw err;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    const err = new Error(
      `Password must be at most ${MAX_PASSWORD_LENGTH} characters`
    );
    err.status = 400;
    throw err;
  }
  return true;
}
