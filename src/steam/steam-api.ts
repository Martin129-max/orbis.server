const STEAM_API = 'https://api.steampowered.com';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const IDENTIFIER_SELECT = `${OPENID_NS}/identifier_select`;
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
const TIMEOUT_MS = 8_000;

export const STEAM_OPENID = 'https://steamcommunity.com/openid/login';

export type SteamOwnedGame = {
  appId: string;
  minutes: number;
  lastPlayedAt: Date | null;
};

export function steamApiKey() {
  return process.env.STEAM_API_KEY;
}

async function getJson<T>(path: string, params: Record<string, string>) {
  const query = new URLSearchParams({ key: steamApiKey() ?? '', ...params });
  const response = await fetch(`${STEAM_API}${path}?${query}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Steam request failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export function openIdUrl(returnTo: string, realm: string) {
  const params = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': realm,
    'openid.identity': IDENTIFIER_SELECT,
    'openid.claimed_id': IDENTIFIER_SELECT,
  });
  return `${STEAM_OPENID}?${params}`;
}

export async function verifyOpenId(
  params: Record<string, string>,
  returnTo: string,
): Promise<string | null> {
  const openId = Object.fromEntries(
    Object.entries(params).filter(
      ([key, value]) => key.startsWith('openid.') && typeof value === 'string',
    ),
  );
  const steamId = CLAIMED_ID.exec(openId['openid.claimed_id'] ?? '')?.[1];
  if (
    openId['openid.mode'] !== 'id_res' ||
    openId['openid.op_endpoint'] !== STEAM_OPENID ||
    !openId['openid.return_to']?.startsWith(returnTo) ||
    openId['openid.identity'] !== openId['openid.claimed_id'] ||
    !steamId
  ) {
    return null;
  }

  const response = await fetch(STEAM_OPENID, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...openId,
      'openid.mode': 'check_authentication',
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Steam check failed with ${response.status}`);
  }
  return /^is_valid:true$/m.test(await response.text()) ? steamId : null;
}

export async function getPersonaName(steamId: string) {
  const data = await getJson<{
    response: { players: { personaname?: string }[] };
  }>('/ISteamUser/GetPlayerSummaries/v2/', { steamids: steamId });
  return data.response.players[0]?.personaname ?? steamId;
}

export async function getOwnedGames(
  steamId: string,
): Promise<SteamOwnedGame[] | null> {
  const data = await getJson<{
    response: {
      game_count?: number;
      games?: {
        appid: number;
        playtime_forever: number;
        rtime_last_played?: number;
      }[];
    };
  }>('/IPlayerService/GetOwnedGames/v1/', {
    steamid: steamId,
    include_played_free_games: '1',
    format: 'json',
  });
  if (data.response.game_count === undefined) return null;

  return (data.response.games ?? []).map((game) => ({
    appId: String(game.appid),
    minutes: game.playtime_forever,
    lastPlayedAt: game.rtime_last_played
      ? new Date(game.rtime_last_played * 1000)
      : null,
  }));
}
