import { Logger } from '@nestjs/common';
import { sendEmail } from './email';

describe('sendEmail', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  const email = {
    to: 'naruto@anime.test',
    subject: 'Confirm your email for Orbis',
    html: '<p>Hi</p>',
    text: 'Hi',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.MAILPIT_URL;
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('prints the email instead of sending it when there’s no Resend key', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await sendEmail(email);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('To: naruto@anime.test'),
    );
  });

  it('sends through Resend when there’s a key', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'Orbis <hello@orbis.example>';
    fetchMock.mockResolvedValue({ ok: true });

    await sendEmail(email);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer re_test',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      from: 'Orbis <hello@orbis.example>',
      ...email,
    });
  });

  it('sends to the local Mailpit inbox when there’s no Resend key', async () => {
    process.env.MAILPIT_URL = 'http://localhost:8025/';
    process.env.EMAIL_FROM = 'Orbis <hello@orbis.example>';
    fetchMock.mockResolvedValue({ ok: true });

    await sendEmail(email);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8025/api/v1/send',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      From: { Name: 'Orbis', Email: 'hello@orbis.example' },
      To: [{ Email: 'naruto@anime.test' }],
      Subject: 'Confirm your email for Orbis',
      Text: 'Hi',
      HTML: '<p>Hi</p>',
    });
  });

  it('ignores quotes and spaces around the sender', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = ' "Orbis <hello@orbis.example>"\n';
    fetchMock.mockResolvedValue({ ok: true });

    await sendEmail(email);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toBe(
      'Orbis <hello@orbis.example>',
    );
  });

  it('uses Resend over Mailpit when both are set', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.MAILPIT_URL = 'http://localhost:8025';
    fetchMock.mockResolvedValue({ ok: true });

    await sendEmail(email);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails');
  });

  it('fails when Resend refuses the email', async () => {
    process.env.RESEND_API_KEY = 're_test';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('The domain is not verified'),
    });

    await expect(sendEmail(email)).rejects.toThrow(
      'Resend refused the email with 403: The domain is not verified',
    );
  });
});
