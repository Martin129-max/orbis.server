import { AuthProvider } from '../../../prisma/generated/client';

export type OAuthProfile = {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  avatarUrl: string | null;
};

type ProviderConfig = {
  label: string;
  clientId: () => string | undefined;
  clientSecret: () => string | undefined;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  profile: (accessToken: string, clientId: string) => Promise<OAuthProfile>;
};

export const OAUTH_TIMEOUT_MS = 10_000;

async function getJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.json();
}

export const oauthProviders: Record<AuthProvider, ProviderConfig> = {
  discord: {
    label: 'Discord',
    clientId: () => process.env.DISCORD_CLIENT_ID,
    clientSecret: () => process.env.DISCORD_CLIENT_SECRET,
    authorizeUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    scope: 'identify email',
    profile: async (accessToken) => {
      const user = await getJson('https://discord.com/api/users/@me', {
        Authorization: `Bearer ${accessToken}`,
      });
      return {
        id: String(user.id),
        username: String(user.username),
        displayName: user.global_name ?? null,
        email: user.email ?? null,
        emailVerified: user.verified === true,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=512`
          : null,
      };
    },
  },
  twitch: {
    label: 'Twitch',
    clientId: () => process.env.TWITCH_CLIENT_ID,
    clientSecret: () => process.env.TWITCH_CLIENT_SECRET,
    authorizeUrl: 'https://id.twitch.tv/oauth2/authorize',
    tokenUrl: 'https://id.twitch.tv/oauth2/token',
    scope: 'user:read:email',
    profile: async (accessToken, clientId) => {
      const { data } = await getJson('https://api.twitch.tv/helix/users', {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': clientId,
      });
      const user = data?.[0];
      if (!user) throw new Error('Twitch returned no user');
      const image =
        typeof user.profile_image_url === 'string'
          ? user.profile_image_url
          : '';
      return {
        id: String(user.id),
        username: String(user.login),
        displayName: user.display_name ?? null,
        email: user.email ?? null,
        emailVerified: Boolean(user.email),
        avatarUrl:
          image && !image.includes('user-default-pictures') ? image : null,
      };
    },
  },
};
