export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export const USERNAME_MESSAGE =
  'username must be 3-20 characters: letters, numbers, or underscores';

export function normalizeUsername(username: string) {
  return username.toLowerCase();
}
