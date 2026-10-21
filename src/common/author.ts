export const author = {
  select: { id: true, username: true, name: true },
} as const;

export const communitySummary = { select: { id: true, name: true } } as const;
