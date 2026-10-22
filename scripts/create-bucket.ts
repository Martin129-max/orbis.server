import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { createS3Client } from '../src/storage/s3';

const client = createS3Client();
const bucket = process.env.BUCKET_NAME!;

async function main() {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`✅ Bucket "${bucket}" already exists`);
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`✅ Created bucket "${bucket}"`);
  }

  await client.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucket}/*`],
          },
        ],
      }),
    }),
  );
  console.log(`✅ Bucket "${bucket}" is publicly readable`);
}

main().catch((e) => {
  console.error('❌ Bucket error:', e);
  process.exit(1);
});
