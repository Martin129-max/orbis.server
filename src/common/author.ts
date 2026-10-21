export const author = {
  select: { id: true, username: true, name: true, avatarUrl: true },
} as const;

export const communitySummary = {
  select: { id: true, name: true, iconUrl: true },
} as const;
