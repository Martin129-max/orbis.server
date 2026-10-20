import { PrismaClient } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.community.deleteMany();
  await prisma.user.deleteMany();

  const bos_user = await prisma.user.create({
    data: {
      email: "bos@eriko.ph",
      password: await bcrypt.hash("boseriko", 10),
    },
  });

  const twis_user = await prisma.user.create({
    data: {
      email: "twis@wua.ph",
      password: await bcrypt.hash("twiswua", 10),
    },
  });

  console.log("👤 Users created:", [bos_user.email, twis_user.email]);

  const communities = [];
  for (const [position, name] of ["BosEriko", "TwisWua"].entries()) {
    communities.push(
      await prisma.community.create({
        data: {
          name,
          ownerId: bos_user.id,
          memberships: {
            create: [
              { userId: bos_user.id, position },
              { userId: twis_user.id, position },
            ],
          },
        },
      }),
    );
  }

  console.log("🏘️ Communities created:", communities.map(({ name }) => name));

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
