import { PrismaClient } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  await prisma.user.deleteMany();

  const bos_user = await prisma.user.create({
    data: {
      email: "bos@eriko.ph",
      password: "boseriko",
    },
  });

  const twis_user = await prisma.user.create({
    data: {
      email: "twis@wua.ph",
      password: "twiswua",
    },
  });

  console.log("👤 Users created:", [bos_user.email, twis_user.email]);

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
