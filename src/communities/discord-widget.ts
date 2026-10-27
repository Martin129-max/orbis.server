const CACHE_MS = 2 * 60 * 1000;
const TIMEOUT_MS = 3000;
const SNOWFLAKE = /^\d{1,20}$/;

export type DiscordWidget = { online: number | null; inviteUrl: string | null };

const cache = new Map<string, { value: DiscordWidget; expiresAt: number }>();

export async function discordWidget(guildId: string): Promise<DiscordWidget> {
  const cached = cache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: DiscordWidget = { online: null, inviteUrl: null };
  if (SNOWFLAKE.test(guildId)) {
    try {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/widget.json`,
        { signal: AbortSignal.timeout(TIMEOUT_MS) },
      );
      if (response.ok) {
        const widget = await response.json();
        value = {
          online:
            typeof widget.presence_count === 'number'
              ? widget.presence_count
              : null,
          inviteUrl:
            typeof widget.instant_invite === 'string'
              ? widget.instant_invite
              : null,
        };
      }
    } catch {
      value = { online: null, inviteUrl: null };
    }
  }

  cache.set(guildId, { value, expiresAt: Date.now() + CACHE_MS });
  return value;
}
