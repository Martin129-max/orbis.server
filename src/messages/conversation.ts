export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_LIMIT = 1000;
export const MESSAGE_PAGE_SIZE = 30;
export const GROUP_MAX_MEMBERS = 20;
export const GROUP_NAME_MAX_LENGTH = 60;

export function pair(userId: number, otherId: number) {
  return userId < otherId
    ? { userAId: userId, userBId: otherId }
    : { userAId: otherId, userBId: userId };
}
