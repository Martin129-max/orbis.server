import { discordWidget } from './discord-widget';

describe('discordWidget', () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;

  beforeAll(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('reads the online count and invite link from the server widget', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        presence_count: 128,
        instant_invite: 'https://discord.com/invite/abc',
      }),
    });

    await expect(discordWidget('1001')).resolves.toEqual({
      online: 128,
      inviteUrl: 'https://discord.com/invite/abc',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/v10/guilds/1001/widget.json',
      expect.anything(),
    );
  });

  it('remembers the answer for a couple of minutes', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ presence_count: 5, instant_invite: null }),
    });

    await discordWidget('1002');
    await expect(discordWidget('1002')).resolves.toEqual({
      online: 5,
      inviteUrl: null,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows nothing when the server widget is turned off', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 });

    await expect(discordWidget('1003')).resolves.toEqual({
      online: null,
      inviteUrl: null,
    });
  });

  it('shows nothing when Discord can’t be reached', async () => {
    fetchMock.mockRejectedValueOnce(new Error('timeout'));

    await expect(discordWidget('1004')).resolves.toEqual({
      online: null,
      inviteUrl: null,
    });
  });

  it('never requests anything for an ID that isn’t a Discord ID', async () => {
    await expect(discordWidget('../users/@me')).resolves.toEqual({
      online: null,
      inviteUrl: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
