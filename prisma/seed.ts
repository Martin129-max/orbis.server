import { PrismaClient } from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { ADMINISTRATOR } from '../src/communities/permissions';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const CHARACTER_PASSWORD = 'password';

const characters = {
  naruto: 'Naruto Uzumaki',
  sasuke: 'Sasuke Uchiha',
  sakura: 'Sakura Haruno',
  luffy: 'Monkey D. Luffy',
  zoro: 'Roronoa Zoro',
  nami: 'Nami',
  goku: 'Son Goku',
  vegeta: 'Vegeta',
  tanjiro: 'Tanjiro Kamado',
  nezuko: 'Nezuko Kamado',
  gojo: 'Satoru Gojo',
  itadori: 'Yuji Itadori',
  levi: 'Levi Ackerman',
  mikasa: 'Mikasa Ackerman',
  anya: 'Anya Forger',
  spike: 'Spike Spiegel',
};

type Character = keyof typeof characters;
type UserKey = Character | 'admin';

type SeedCommunity = {
  name: string;
  owner: UserKey;
  isPublic: boolean;
  members: [UserKey, string?][];
  admins?: UserKey[];
  posts: [UserKey, number, string][];
};

const hours = (count: number) => count * 60;
const days = (count: number) => count * 24 * 60;

const communities: SeedCommunity[] = [
  {
    name: 'Seasonal Anime Club',
    owner: 'admin',
    isPublic: true,
    members: [
      ['admin', 'Club President'],
      ['anya'],
      ['spike'],
      ['itadori'],
      ['nami'],
      ['tanjiro'],
      ['naruto'],
    ],
    posts: [
      [
        'admin',
        days(3),
        `<p>Welcome to the <strong>Seasonal Anime Club</strong>! 🎉</p><p>Post what you're watching this season, drop recommendations, and keep spoilers out of titles. A few ground rules:</p><ul><li>Be kind</li><li>Tag spoilers clearly</li><li>Hot takes are welcome, flame wars are not</li></ul>`,
      ],
      [
        'anya',
        days(2) + hours(5),
        `<p>Anya watched a spy anime with Papa. Anya already knew the ending. Anya did not say anything. <em>Heh.</em></p>`,
      ],
      [
        'spike',
        days(1) + hours(9),
        `<p>Hot take: if the soundtrack isn't jazz, I'm not watching it.</p><blockquote>See you, space cowboy...</blockquote>`,
      ],
      [
        'itadori',
        hours(20),
        `<p>Just finished a movie marathon for "training". Ranking so far:</p><ol><li>Anything with a good fight scene</li><li>Anything that made me cry</li><li>Anything Gojo-sensei didn't pick</li></ol>`,
      ],
      [
        'nami',
        hours(6),
        `<p>Reminder that the club's watch-party snacks are <strong>not free</strong>. I keep a ledger. 💰</p>`,
      ],
      [
        'tanjiro',
        hours(2),
        `<p>What's everyone's comfort anime? Mine is anything about family. Recommendations very welcome!</p>`,
      ],
    ],
  },
  {
    name: 'Hidden Leaf Village',
    owner: 'naruto',
    isPublic: true,
    admins: ['admin', 'sakura'],
    members: [
      ['naruto', 'Future Hokage'],
      ['sasuke'],
      ['sakura'],
      ['admin'],
      ['itadori'],
    ],
    posts: [
      [
        'naruto',
        days(4),
        `<p>Believe it! The Hidden Leaf Village is officially on Orbis! Ramen at Ichiraku after training, <strong>my treat</strong>... probably.</p>`,
      ],
      [
        'sakura',
        days(3) + hours(2),
        `<p>Naruto, you said "your treat" last time and I paid. Again.</p>`,
      ],
      ['sasuke', days(2), `<p>Hn.</p>`],
      [
        'naruto',
        days(1) + hours(3),
        `<p>Training schedule for the week:</p><ul><li><strong>Mon</strong>: Shadow clone drills</li><li><strong>Wed</strong>: Rasengan practice</li><li><strong>Fri</strong>: Beat Sasuke</li></ul>`,
      ],
      [
        'itadori',
        hours(10),
        `<p>Visiting from Jujutsu High. Is it true you all run on walls? Asking for a friend (me).</p>`,
      ],
      [
        'sakura',
        hours(1),
        `<p>Medical ninja tip: <em>hydrate</em>. Especially you, Naruto.</p>`,
      ],
    ],
  },
  {
    name: 'Straw Hat Pirates',
    owner: 'luffy',
    isPublic: true,
    admins: ['zoro'],
    members: [
      ['luffy', 'Captain'],
      ['zoro', 'Pirate Hunter'],
      ['nami', 'Navigator'],
      ['admin'],
      ['goku'],
    ],
    posts: [
      [
        'luffy',
        days(5),
        `<p>I'm gonna be King of the Pirates!! Also, who ate the meat I was saving?</p>`,
      ],
      [
        'nami',
        days(4) + hours(6),
        `<p>New course is set for the next island. <strong>Zoro</strong>, the ship is the big wooden thing. Please stay on it.</p>`,
      ],
      ['zoro', days(3), `<p>I didn't get lost. The island moved.</p>`],
      [
        'goku',
        days(1) + hours(12),
        `<p>Hey Luffy! You eat as much as me? We should have a contest. Winner gets a spar!</p>`,
      ],
      ['luffy', days(1) + hours(11), `<p>YES!! Meat contest!! 🍖🍖🍖</p>`],
      [
        'nami',
        hours(4),
        `<p>The meat contest will be funded from the crew's treasury. With <strong>interest</strong>.</p>`,
      ],
    ],
  },
  {
    name: 'Saiyan Training Grounds',
    owner: 'goku',
    isPublic: true,
    members: [['goku'], ['vegeta', 'Prince of All Saiyans'], ['luffy']],
    posts: [
      [
        'goku',
        days(6),
        `<p>Hi, I'm Goku! This is a place to train, eat, and get stronger. Everyone's welcome!</p>`,
      ],
      [
        'vegeta',
        days(5) + hours(4),
        `<p>Hmph. <strong>Kakarot</strong>, a "community" will not close the gap between us. I'll surpass you by myself.</p>`,
      ],
      [
        'goku',
        days(2) + hours(7),
        `<p>Gravity room is open 24/7! Current setting: <code>300x</code>. Bring snacks.</p>`,
      ],
      [
        'vegeta',
        hours(15),
        `<p>I have increased the gravity room setting. You're welcome.</p>`,
      ],
      [
        'luffy',
        hours(3),
        `<p>Is the meat contest happening here or on the ship?</p>`,
      ],
    ],
  },
  {
    name: 'Demon Slayer Corps',
    owner: 'tanjiro',
    isPublic: true,
    admins: ['admin'],
    members: [['tanjiro'], ['nezuko'], ['admin'], ['mikasa']],
    posts: [
      [
        'tanjiro',
        days(4) + hours(8),
        `<p>Breathing technique reminder: <em>Total Concentration</em>, all day, every day. Even while sleeping!</p>`,
      ],
      ['nezuko', days(3) + hours(1), `<p>Mmmph! 🎋</p>`],
      [
        'mikasa',
        days(2) + hours(5),
        `<p>Your swordsmanship is impressive. The Survey Corps could use you.</p>`,
      ],
      [
        'tanjiro',
        hours(18),
        `<p>Thank you, Mikasa! Let's train together sometime. Nezuko says hi too.</p>`,
      ],
      [
        'admin',
        hours(5),
        `<p>Just caught up on the latest arc. That animation budget is <strong>unreal</strong>.</p>`,
      ],
    ],
  },
  {
    name: 'Jujutsu High',
    owner: 'gojo',
    isPublic: true,
    members: [['gojo', 'The Strongest'], ['itadori']],
    posts: [
      [
        'gojo',
        days(5) + hours(2),
        `<p>Welcome to Jujutsu High, students! Don't worry. I'm the strongest, after all. 😎</p>`,
      ],
      [
        'itadori',
        days(3) + hours(9),
        `<p>Sensei, can we do a lesson on something other than "be strong"?</p>`,
      ],
      [
        'gojo',
        days(3) + hours(8),
        `<p>Lesson plan:</p><ol><li>Be strong</li><li>Be stronger</li><li>Get Kikufuku mochi for sensei</li></ol>`,
      ],
      ['itadori', hours(12), `<p>Bought the mochi. Where do I leave it?</p>`],
      [
        'gojo',
        45,
        `<p>Good student. ⭐ Extra credit for remembering the <em>Kikufuku</em>.</p>`,
      ],
    ],
  },
  {
    name: 'Survey Corps',
    owner: 'levi',
    isPublic: false,
    members: [['levi', 'Captain'], ['mikasa'], ['admin']],
    posts: [
      [
        'levi',
        days(6) + hours(3),
        `<p>Private channel for the squad. Keep your gear clean and your reports short.</p>`,
      ],
      [
        'mikasa',
        days(2) + hours(10),
        `<p>Expedition report filed. All maneuvering gear accounted for.</p>`,
      ],
      [
        'levi',
        hours(9),
        `<p>Cleaning duty rotation is posted. If I find dust on a single shelf, you're redoing the whole floor.</p>`,
      ],
    ],
  },
  {
    name: 'Bebop Lounge',
    owner: 'spike',
    isPublic: false,
    members: [['spike'], ['admin']],
    posts: [
      [
        'spike',
        days(3) + hours(4),
        `<p>Whatever happens, happens. Bounties, jazz, and bell peppers with no beef.</p>`,
      ],
      [
        'admin',
        days(1) + hours(2),
        `<p>Added this to the club's all-time favorites list. Nothing beats that opening.</p>`,
      ],
    ],
  },
];

const friendships: [UserKey, UserKey, 'accepted' | 'pending'][] = [
  ['admin', 'naruto', 'accepted'],
  ['admin', 'luffy', 'accepted'],
  ['goku', 'admin', 'accepted'],
  ['tanjiro', 'admin', 'accepted'],
  ['admin', 'gojo', 'accepted'],
  ['admin', 'levi', 'accepted'],
  ['anya', 'admin', 'pending'],
  ['itadori', 'admin', 'pending'],
  ['admin', 'spike', 'pending'],
  ['naruto', 'sasuke', 'accepted'],
  ['naruto', 'sakura', 'accepted'],
  ['luffy', 'zoro', 'accepted'],
  ['luffy', 'nami', 'accepted'],
  ['goku', 'vegeta', 'accepted'],
  ['goku', 'luffy', 'accepted'],
  ['tanjiro', 'nezuko', 'accepted'],
  ['gojo', 'itadori', 'accepted'],
  ['levi', 'mikasa', 'accepted'],
];

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.community.deleteMany();
  await prisma.user.deleteMany();

  const characterPassword = await bcrypt.hash(CHARACTER_PASSWORD, 10);
  const userIds = {} as Record<UserKey, number>;

  const admin = await prisma.user.create({
    data: {
      email: 'admin@user.com',
      name: 'Admin',
      password: await bcrypt.hash('1234', 10),
      createdAt: minutesAgo(days(30)),
    },
  });
  userIds.admin = admin.id;

  for (const [key, name] of Object.entries(characters)) {
    const user = await prisma.user.create({
      data: {
        email: `${key}@anime.test`,
        name,
        password: characterPassword,
        createdAt: minutesAgo(days(30)),
      },
    });
    userIds[key as Character] = user.id;
  }

  console.log('👤 Users created:', Object.keys(userIds).length);

  const positions = {} as Record<UserKey, number>;

  for (const community of communities) {
    const memberKeys = new Set(community.members.map(([key]) => key));
    const outsider = [
      community.owner,
      ...(community.admins ?? []),
      ...community.posts.map(([key]) => key),
    ].find((key) => !memberKeys.has(key));
    if (outsider) {
      throw new Error(`"${community.name}": ${outsider} isn't a member`);
    }

    const created = await prisma.community.create({
      data: {
        name: community.name,
        ownerId: userIds[community.owner],
        isPublic: community.isPublic,
        createdAt: minutesAgo(days(14)),
        memberships: {
          create: community.members.map(([key, nickname], index) => {
            const position = positions[key] ?? 0;
            positions[key] = position + 1;
            return {
              userId: userIds[key],
              nickname,
              position,
              joinedAt: minutesAgo(days(14) - index * 60),
            };
          }),
        },
        posts: {
          create: community.posts.map(([key, ago, content]) => ({
            authorId: userIds[key],
            content,
            createdAt: minutesAgo(ago),
          })),
        },
      },
    });

    if (community.admins?.length) {
      const role = await prisma.role.create({
        data: {
          communityId: created.id,
          name: 'Admin',
          permissions: ADMINISTRATOR,
        },
      });
      await prisma.membershipRole.createMany({
        data: community.admins.map((key) => ({
          userId: userIds[key],
          communityId: created.id,
          roleId: role.id,
        })),
      });
    }
  }

  console.log(
    '🏘️ Communities created:',
    communities.map(({ name }) => name),
  );

  await prisma.friendship.createMany({
    data: friendships.map(([requester, addressee, status]) => ({
      requesterId: userIds[requester],
      addresseeId: userIds[addressee],
      status,
    })),
  });

  console.log('🤝 Friendships created:', friendships.length);

  console.log('✅ Seeding complete!');
  console.log('🔑 admin@user.com / 1234');
  console.log(
    `🔑 <character>@anime.test / ${CHARACTER_PASSWORD} (e.g. naruto@anime.test)`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
