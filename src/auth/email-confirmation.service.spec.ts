import { JwtService } from '@nestjs/jwt';
import { EmailConfirmationService } from './email-confirmation.service';
import { PrismaService } from '../prisma.service';

jest.mock('../common/email', () => ({ sendEmail: jest.fn() }));

describe('EmailConfirmationService', () => {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
  };
  const jwt = new JwtService({});
  const service = new EmailConfirmationService(
    prisma as unknown as PrismaService,
    jwt,
  );
  const sendEmail = jest.requireMock('../common/email').sendEmail as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  async function emailedToken() {
    await service.send({ id: 7, email: 'naruto@anime.test' });
    const { text } = sendEmail.mock.calls[0][0];
    const link = new URL(text.match(/https?:\/\/\S+/)[0]);
    return link.searchParams.get('token')!;
  }

  it('emails a link to the confirm page', async () => {
    const token = await emailedToken();

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'naruto@anime.test',
        subject: 'Confirm your email for Orbis',
      }),
    );
    expect(sendEmail.mock.calls[0][0].html).toContain(
      `/confirm-email?token=${encodeURIComponent(token)}`,
    );
  });

  it('confirms the email from the link', async () => {
    const token = await emailedToken();
    prisma.user.findUnique.mockResolvedValue({
      email: 'naruto@anime.test',
      emailVerifiedAt: null,
    });

    await expect(service.confirm(token)).resolves.toEqual({ confirmed: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { emailVerifiedAt: expect.any(Date) },
    });
  });

  it('leaves an already confirmed email as it is', async () => {
    const token = await emailedToken();
    prisma.user.findUnique.mockResolvedValue({
      email: 'naruto@anime.test',
      emailVerifiedAt: new Date('2026-10-01T00:00:00Z'),
    });

    await expect(service.confirm(token)).resolves.toEqual({ confirmed: true });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses a link sent to a different email', async () => {
    const token = await emailedToken();
    prisma.user.findUnique.mockResolvedValue({
      email: 'someone.else@anime.test',
      emailVerifiedAt: null,
    });

    await expect(service.confirm(token)).rejects.toThrow('expired');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses a made-up link', async () => {
    const forged = jwt.sign(
      { uid: 7, email: 'naruto@anime.test' },
      {
        secret: 'guess',
      },
    );

    await expect(service.confirm(forged)).rejects.toThrow('expired');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('doesn’t email someone who already confirmed', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      email: 'naruto@anime.test',
      emailVerifiedAt: new Date('2026-10-01T00:00:00Z'),
    });

    await expect(service.resend(7)).resolves.toEqual({ confirmed: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('says so when the email couldn’t be sent', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 7,
      email: 'naruto@anime.test',
      emailVerifiedAt: null,
    });
    sendEmail.mockRejectedValueOnce(new Error('Resend is down'));

    await expect(service.resend(7)).rejects.toThrow(
      'Couldn’t send the email. Please try again in a few minutes',
    );
  });
});
