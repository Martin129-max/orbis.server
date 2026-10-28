import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { sendEmail } from '../common/email';
import { webUrl } from '../common/web-url';

const LINK_INVALID =
  'This link has expired or isn’t valid anymore. Send yourself a new one from Orbis';

type ConfirmClaims = { uid: number; email: string };

function confirmSecret() {
  return `${process.env.JWT_SECRET}:email-confirm`;
}

function confirmationEmail(link: string) {
  return {
    subject: 'Confirm your email for Orbis',
    text: `Welcome to Orbis! Confirm your email by opening this link:\n\n${link}\n\nThe link works for 24 hours. If you didn’t sign up for Orbis, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#1f1f1f;max-width:480px">
<p>Welcome to Orbis!</p>
<p>Confirm your email so we know it’s really you.</p>
<p><a href="${link}" style="display:inline-block;background:#f07357;color:#ffffff;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:8px">Confirm email</a></p>
<p style="color:#6b6b6b;font-size:13px">The link works for 24 hours. If you didn’t sign up for Orbis, you can ignore this email.</p>
</div>`,
  };
}

@Injectable()
export class EmailConfirmationService {
  private readonly logger = new Logger(EmailConfirmationService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async send(user: { id: number; email: string }) {
    const claims: ConfirmClaims = { uid: user.id, email: user.email };
    const token = this.jwt.sign(claims, {
      secret: confirmSecret(),
      expiresIn: '24h',
    });
    const link = `${webUrl()}/confirm-email?token=${encodeURIComponent(token)}`;
    await sendEmail({ to: user.email, ...confirmationEmail(link) });
  }

  sendInBackground(user: { id: number; email: string }) {
    this.send(user).catch((error: Error) =>
      this.logger.error(`Couldn’t send a confirmation email: ${error.message}`),
    );
  }

  async confirm(token: string) {
    let claims: ConfirmClaims;
    try {
      claims = this.jwt.verify<ConfirmClaims>(token, {
        secret: confirmSecret(),
      });
    } catch {
      throw new BadRequestException(LINK_INVALID);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: claims.uid },
      select: { email: true, emailVerifiedAt: true },
    });
    if (!user || user.email.toLowerCase() !== claims.email.toLowerCase()) {
      throw new BadRequestException(LINK_INVALID);
    }
    if (!user.emailVerifiedAt) {
      await this.prisma.user.update({
        where: { id: claims.uid },
        data: { emailVerifiedAt: new Date() },
      });
    }
    return { confirmed: true };
  }

  async resend(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerifiedAt) return { confirmed: true };

    try {
      await this.send(user);
    } catch (error) {
      this.logger.error(
        `Couldn’t send a confirmation email: ${(error as Error).message}`,
      );
      throw new BadGatewayException(
        'Couldn’t send the email. Please try again in a few minutes',
      );
    }
    return { confirmed: false };
  }
}
