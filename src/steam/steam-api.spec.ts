import { getOwnedGames, STEAM_OPENID, verifyOpenId } from './steam-api';

const RETURN_TO = 'http://localhost:3000/auth/steam/callback';
const STEAM_ID = '76561198000000001';

describe('Steam API', () => {
  const fetchMock = jest.fn();

  beforeAll(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  beforeEach(() => jest.clearAllMocks());

  function signIn(overrides: Record<string, string> = {}) {
    const id = `https://steamcommunity.com/openid/id/${STEAM_ID}`;
    return {
      'openid.mode': 'id_res',
      'openid.op_endpoint': STEAM_OPENID,
      'openid.return_to': `${RETURN_TO}?state=abc`,
      'openid.claimed_id': id,
      'openid.identity': id,
      'openid.sig': 'signature',
      ...overrides,
    };
  }

  it('accepts a sign-in that Steam confirms', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => 'ns:http://specs.openid.net/auth/2.0\nis_valid:true\n',
    });

    await expect(verifyOpenId(signIn(), RETURN_TO)).resolves.toBe(STEAM_ID);
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('openid.mode')).toBe('check_authentication');
  });

  it('rejects a sign-in Steam does not confirm', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => 'is_valid:false',
    });

    await expect(verifyOpenId(signIn(), RETURN_TO)).resolves.toBeNull();
  });

  it('never asks Steam about a sign-in meant for somewhere else', async () => {
    await expect(
      verifyOpenId(
        signIn({ 'openid.return_to': 'https://evil.test/auth/steam/callback' }),
        RETURN_TO,
      ),
    ).resolves.toBeNull();
    await expect(
      verifyOpenId(
        signIn({ 'openid.op_endpoint': 'https://evil.test' }),
        RETURN_TO,
      ),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads owned games and their playtime', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        response: {
          game_count: 2,
          games: [
            {
              appid: 367520,
              playtime_forever: 754,
              rtime_last_played: 1_700_000_000,
            },
            { appid: 413150, playtime_forever: 0 },
          ],
        },
      }),
    });

    await expect(getOwnedGames(STEAM_ID)).resolves.toEqual([
      {
        appId: '367520',
        minutes: 754,
        lastPlayedAt: new Date(1_700_000_000_000),
      },
      { appId: '413150', minutes: 0, lastPlayedAt: null },
    ]);
  });

  it('treats hidden game details as private', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ response: {} }),
    });

    await expect(getOwnedGames(STEAM_ID)).resolves.toBeNull();
  });
});
