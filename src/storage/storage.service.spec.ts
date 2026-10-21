import { BadRequestException } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import sharp = require('sharp');
import { IMAGE_MAX_BYTES, StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;
  let send: jest.Mock;

  beforeEach(() => {
    process.env.STORAGE_BUCKET = 'orbis';
    process.env.STORAGE_PUBLIC_URL = 'https://cdn.test';
    service = new StorageService();
    send = jest.fn().mockResolvedValue({});
    (service as any).client.send = send;
  });

  it('converts the image to webp, fits it within the max size, and returns its url', async () => {
    const png = await sharp({
      create: { width: 4000, height: 1000, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();

    const stored = await service.uploadImage(png, 'avatars', 512);

    expect(stored.key).toMatch(/^avatars\/[0-9a-f-]{36}\.webp$/);
    expect(stored.url).toBe(`https://cdn.test/${stored.key}`);

    const command: PutObjectCommand = send.mock.calls[0][0];
    expect(command.input.Bucket).toBe('orbis');
    expect(command.input.ContentType).toBe('image/webp');

    const metadata = await sharp(command.input.Body as Buffer).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(128);
  });

  it('rejects files that are not images', async () => {
    await expect(
      service.uploadImage(Buffer.from('not an image'), 'avatars'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects images over the size limit', async () => {
    await expect(
      service.uploadImage(Buffer.alloc(IMAGE_MAX_BYTES + 1), 'avatars'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(send).not.toHaveBeenCalled();
  });
});
