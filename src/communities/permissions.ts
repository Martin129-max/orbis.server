export const ADMINISTRATOR = BigInt(1);

export type CommunityRole = 'owner' | 'admin' | 'member';

export function isAdministrator(permissions: bigint) {
  return (permissions & ADMINISTRATOR) === ADMINISTRATOR;
}
