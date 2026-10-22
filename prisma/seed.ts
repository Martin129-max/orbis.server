import {
  LibraryStatus,
  MediaType,
  NotificationType,
  PrismaClient,
  ReportCategory,
  ReportStatus,
} from './generated/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { ADMINISTRATOR } from '../src/communities/permissions';
import { ticketNumber } from '../src/reports/ticket';

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
type UserKey = Character | 'admin' | 'user';

type SeedCommunity = {
  name: string;
  owner: UserKey;
  isPublic: boolean;
  members: [UserKey, string?][];
  admins?: UserKey[];
  posts: [UserKey, number, string][];
};

type Votes = { up?: UserKey[]; down?: UserKey[] };

type SeedComment = Votes & {
  author: UserKey;
  ago: number;
  content: string;
  replies?: SeedComment[];
};

type SeedThread = Votes & {
  author: UserKey;
  ago: number;
  title: string;
  content: string;
  comments?: SeedComment[];
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
      ['user'],
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
      ['user'],
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

const forums: Record<string, SeedThread[]> = {
  'Seasonal Anime Club': [
    {
      author: 'admin',
      ago: days(2),
      title: 'What are you watching this season? 📺',
      content: `<p>Drop your current lineup below. Bonus points for hidden gems nobody else is talking about.</p>`,
      up: ['anya', 'spike', 'itadori', 'nami', 'tanjiro', 'naruto'],
      comments: [
        {
          author: 'naruto',
          ago: days(2) - hours(1),
          content: `<p>Anything with ninjas. Obviously.</p>`,
          up: ['admin', 'tanjiro'],
          replies: [
            {
              author: 'spike',
              ago: days(2) - hours(3),
              content: `<p>Ninjas are fine. Needs more jazz.</p>`,
              up: ['naruto'],
              replies: [
                {
                  author: 'naruto',
                  ago: days(2) - hours(4),
                  content: `<p>Ninja jazz?! I'd watch that!</p>`,
                },
              ],
            },
          ],
        },
        {
          author: 'tanjiro',
          ago: days(1) + hours(20),
          content: `<p>A slice-of-life about a family bakery. It's <strong>so</strong> wholesome!</p>`,
          up: ['admin', 'nami', 'anya'],
          replies: [
            {
              author: 'nami',
              ago: days(1) + hours(18),
              content: `<p>Is the bread expensive? Asking for budget reasons.</p>`,
              replies: [
                {
                  author: 'tanjiro',
                  ago: days(1) + hours(17),
                  content: `<p>Very affordable! 😊</p>`,
                  up: ['nami'],
                },
              ],
            },
          ],
        },
        {
          author: 'anya',
          ago: days(1) + hours(6),
          content: `<p>Anya is watching a spy show. Anya will not tell Papa.</p>`,
          up: ['spike', 'itadori'],
        },
      ],
    },
    {
      author: 'spike',
      ago: days(1) + hours(4),
      title: 'Unpopular opinion: dubs are fine',
      content: `<p>Some dubs are genuinely great. Fight me.</p>`,
      up: ['admin', 'nami'],
      down: ['naruto', 'itadori'],
      comments: [
        {
          author: 'itadori',
          ago: days(1) + hours(2),
          content: `<p>Subs for life, but respect.</p>`,
          up: ['spike'],
          replies: [
            {
              author: 'admin',
              ago: days(1),
              content: `<p>Depends on the show for me. Some voice casts absolutely nail it.</p>`,
              up: ['spike', 'itadori'],
            },
          ],
        },
        {
          author: 'naruto',
          ago: hours(22),
          content: `<p>Believe it! Subs!</p>`,
          down: ['spike'],
        },
      ],
    },
    {
      author: 'itadori',
      ago: hours(8),
      title: 'Best fight scene of all time?',
      content: `<p>Asking for science. And training.</p>`,
      up: ['naruto', 'tanjiro', 'spike'],
      comments: [
        {
          author: 'naruto',
          ago: hours(7),
          content: `<p>Rasengan vs. Chidori. Nothing else comes close.</p>`,
          up: ['itadori'],
          replies: [
            {
              author: 'itadori',
              ago: hours(6),
              content: `<p>Classic.</p>`,
            },
          ],
        },
        {
          author: 'tanjiro',
          ago: hours(5),
          content: `<p>Any fight where the hero is protecting someone they love.</p>`,
          up: ['admin', 'anya'],
        },
      ],
    },
  ],
  'Hidden Leaf Village': [
    {
      author: 'naruto',
      ago: days(2) + hours(6),
      title: 'Ramen rankings: Ichiraku is #1, change my mind',
      content: `<ol><li>Ichiraku</li><li>Ichiraku (again)</li><li>Instant ramen</li></ol>`,
      up: ['sakura', 'admin', 'itadori'],
      down: ['sasuke'],
      comments: [
        {
          author: 'sasuke',
          ago: days(2) + hours(4),
          content: `<p>Hn. Instant ramen shouldn't be on the list.</p>`,
          up: ['sakura'],
          replies: [
            {
              author: 'naruto',
              ago: days(2) + hours(3),
              content: `<p>It's on the list because it's on <strong>my</strong> list!</p>`,
              up: ['itadori'],
              replies: [
                {
                  author: 'sakura',
                  ago: days(2) + hours(2),
                  content: `<p>Both of you, eat a vegetable.</p>`,
                  up: ['admin', 'sasuke'],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      author: 'sakura',
      ago: hours(14),
      title: 'Team 7 training schedule (please read)',
      content: `<p>Training ground 3, every morning at 6. <strong>No excuses.</strong></p>`,
      up: ['admin', 'sasuke', 'naruto'],
      comments: [
        {
          author: 'naruto',
          ago: hours(13),
          content: `<p>6 AM?! That's so early!</p>`,
          replies: [
            {
              author: 'sakura',
              ago: hours(12),
              content: `<p>Kakashi-sensei will be late anyway.</p>`,
              up: ['naruto', 'sasuke'],
            },
          ],
        },
      ],
    },
  ],
  'Straw Hat Pirates': [
    {
      author: 'nami',
      ago: days(3),
      title: 'Ship budget: where did the meat money go?',
      content: `<p>Someone spent 80% of the food budget on meat. <em>I wonder who.</em></p>`,
      up: ['zoro', 'admin', 'goku'],
      comments: [
        {
          author: 'luffy',
          ago: days(3) - hours(1),
          content: `<p>Not me!! (it was me)</p>`,
          up: ['goku', 'zoro', 'admin'],
          replies: [
            {
              author: 'nami',
              ago: days(3) - hours(2),
              content: `<p>I'm adding interest.</p>`,
              up: ['zoro'],
            },
          ],
        },
        {
          author: 'zoro',
          ago: days(2) + hours(20),
          content: `<p>Spent mine on sake. Worth it.</p>`,
          down: ['nami'],
        },
      ],
    },
    {
      author: 'zoro',
      ago: hours(20),
      title: 'Directions to the training deck?',
      content: `<p>Asking for a friend. The friend is me. The deck keeps moving.</p>`,
      up: ['luffy', 'goku'],
      comments: [
        {
          author: 'nami',
          ago: hours(19),
          content: `<p>It's literally the deck you're standing on.</p>`,
          up: ['luffy', 'admin'],
          replies: [
            {
              author: 'zoro',
              ago: hours(18),
              content: `<p>...I knew that.</p>`,
              up: ['luffy'],
            },
          ],
        },
      ],
    },
  ],
  'Saiyan Training Grounds': [
    {
      author: 'vegeta',
      ago: days(1),
      title: 'Gravity room etiquette',
      content: `<ol><li>Do not touch my settings.</li><li>Kakarot, that includes you.</li></ol>`,
      up: ['goku'],
      down: ['luffy'],
      comments: [
        {
          author: 'goku',
          ago: hours(20),
          content: `<p>Sorry Vegeta! I turned it up to 500x.</p>`,
          replies: [
            {
              author: 'vegeta',
              ago: hours(19),
              content: `<p><strong>KAKAROT.</strong></p>`,
              up: ['luffy', 'goku'],
            },
          ],
        },
      ],
    },
  ],
  'Demon Slayer Corps': [
    {
      author: 'tanjiro',
      ago: days(2),
      title: 'Breathing technique tips for beginners',
      content: `<p>Start with Total Concentration while walking, then while running, then while sleeping. Small steps!</p>`,
      up: ['mikasa', 'admin', 'nezuko'],
      comments: [
        {
          author: 'mikasa',
          ago: days(1) + hours(22),
          content: `<p>Similar to maneuvering gear balance training. Consistency is everything.</p>`,
          up: ['tanjiro'],
          replies: [
            {
              author: 'tanjiro',
              ago: days(1) + hours(21),
              content: `<p>Thank you, Mikasa! I'll try that.</p>`,
            },
          ],
        },
        {
          author: 'nezuko',
          ago: days(1) + hours(10),
          content: `<p>Mmmph! 🎋</p>`,
          up: ['tanjiro', 'admin'],
        },
      ],
    },
  ],
  'Jujutsu High': [
    {
      author: 'gojo',
      ago: hours(30),
      title: "Pop quiz: who's the strongest?",
      content: `<p>Trick question. It's me. 😎</p>`,
      up: ['itadori'],
      comments: [
        {
          author: 'itadori',
          ago: hours(29),
          content: `<p>Sensei, that's not a quiz.</p>`,
          up: ['gojo'],
          replies: [
            {
              author: 'gojo',
              ago: hours(28),
              content: `<p>Correct answer, full marks! 💯</p>`,
            },
          ],
        },
      ],
    },
  ],
};

const postComments: Record<string, Record<number, SeedComment[]>> = {
  'Seasonal Anime Club': {
    0: [
      {
        author: 'anya',
        ago: days(3) - hours(2),
        content: `<p>Anya will follow the rules. Mostly.</p>`,
        up: ['admin', 'spike'],
      },
      {
        author: 'tanjiro',
        ago: days(3) - hours(5),
        content: `<p>Thank you for making this club!</p>`,
        replies: [
          {
            author: 'admin',
            ago: days(3) - hours(6),
            content: `<p>Glad to have you, Tanjiro!</p>`,
            up: ['tanjiro'],
          },
        ],
      },
    ],
  },
  'Hidden Leaf Village': {
    2: [
      {
        author: 'naruto',
        ago: days(2) - hours(1),
        content: `<p>Is that a yes or a no?!</p>`,
        replies: [
          {
            author: 'sakura',
            ago: days(2) - hours(2),
            content: `<p>It's a yes.</p>`,
            up: ['naruto'],
            replies: [
              {
                author: 'sasuke',
                ago: days(2) - hours(3),
                content: `<p>Hn.</p>`,
                up: ['sakura', 'naruto'],
              },
            ],
          },
        ],
      },
    ],
  },
  'Straw Hat Pirates': {
    0: [
      {
        author: 'zoro',
        ago: days(5) - hours(1),
        content: `<p>It was you, Luffy.</p>`,
        up: ['nami', 'admin'],
        replies: [
          {
            author: 'luffy',
            ago: days(5) - hours(2),
            content: `<p>Oh yeah! Shishishi!</p>`,
          },
        ],
      },
      {
        author: 'nami',
        ago: days(4) + hours(20),
        content: `<p>Meat is now 3,000 berries per piece.</p>`,
        up: ['zoro'],
      },
    ],
  },
};

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
  ['naruto', 'user', 'pending'],
];

function voters({ up = [], down = [] }: Votes) {
  return [...up, ...down];
}

function participants(comments: SeedComment[] = []): UserKey[] {
  return comments.flatMap((comment) => [
    comment.author,
    ...voters(comment),
    ...participants(comment.replies),
  ]);
}

async function createVotes(
  communityId: number,
  votableType: 'thread' | 'comment',
  votableId: number,
  { up = [], down = [] }: Votes,
) {
  await prisma.vote.createMany({
    data: [
      ...up.map((key) => ({ key, value: 1 })),
      ...down.map((key) => ({ key, value: -1 })),
    ].map(({ key, value }) => ({
      userId: userIds[key],
      votableType,
      votableId,
      communityId,
      value,
    })),
  });
}

function scoreOf({ up = [], down = [] }: Votes) {
  return up.length - down.length;
}

async function createComments(
  communityId: number,
  commentableType: 'post' | 'thread',
  commentableId: number,
  comments: SeedComment[] = [],
  parentId?: number,
): Promise<number> {
  let count = 0;

  for (const comment of comments) {
    const created = await prisma.comment.create({
      data: {
        communityId,
        commentableType,
        commentableId,
        parentId,
        authorId: userIds[comment.author],
        content: comment.content,
        score: scoreOf(comment),
        createdAt: minutesAgo(comment.ago),
      },
    });
    await createVotes(communityId, 'comment', created.id, comment);
    count +=
      1 +
      (await createComments(
        communityId,
        commentableType,
        commentableId,
        comment.replies,
        created.id,
      ));
  }

  return count;
}

const userIds = {} as Record<UserKey, number>;

function communityImage(folder: string, name: string) {
  return `/images/${folder}/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.webp`;
}

const reports: [
  UserKey,
  ReportCategory,
  ReportStatus,
  number,
  string,
  string,
][] = [
  [
    'naruto',
    'bug',
    'todo',
    25,
    'The post button stayed greyed out after I pasted a long message. Had to type a letter to wake it up.',
    '/explore',
  ],
  [
    'anya',
    'idea',
    'todo',
    90,
    'Anya wants stickers in comments. Peanut sticker. Please.',
    '/',
  ],
  [
    'levi',
    'bug',
    'in_progress',
    240,
    'Thread list jumped back to the top after I voted. Clean that up.',
    '/explore',
  ],
  [
    'nami',
    'idea',
    'todo',
    600,
    'Let community owners pin a thread so the rules stay at the top of the forum.',
    '/explore',
  ],
  [
    'spike',
    'other',
    'done',
    1440,
    'Dark mode is easy on the eyes at 3am. That is all.',
    '/profile',
  ],
  [
    'gojo',
    'bug',
    'in_progress',
    2880,
    'Uploaded a new cover and the old one showed for a second before switching.',
    '/explore',
  ],
];

const reportStatusLabels: Record<ReportStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

async function createNotifications() {
  const day = 24 * 60 * 60 * 1000;
  const readAt = (createdAt: Date) =>
    Date.now() - createdAt.getTime() > day ? createdAt : null;
  const notifications: {
    userId: number;
    actorId: number;
    type: NotificationType;
    message: string;
    link: string;
    createdAt: Date;
    readAt: Date | null;
  }[] = [];

  const [posts, threads, comments] = await Promise.all([
    prisma.post.findMany({ select: { id: true, authorId: true } }),
    prisma.thread.findMany({
      select: { id: true, authorId: true, title: true },
    }),
    prisma.comment.findMany({
      select: {
        authorId: true,
        communityId: true,
        commentableType: true,
        commentableId: true,
        createdAt: true,
        parent: { select: { authorId: true } },
      },
    }),
  ]);
  const postAuthors = new Map(posts.map((post) => [post.id, post.authorId]));
  const threadsById = new Map(threads.map((thread) => [thread.id, thread]));

  for (const comment of comments) {
    const isThread = comment.commentableType === 'thread';
    const thread = threadsById.get(comment.commentableId);
    const ownerId = isThread
      ? thread?.authorId
      : postAuthors.get(comment.commentableId);
    const base = {
      actorId: comment.authorId,
      link: `/communities/${comment.communityId}${isThread ? '?tab=forum' : ''}`,
      createdAt: comment.createdAt,
      readAt: readAt(comment.createdAt),
    };

    if (comment.parent && comment.parent.authorId !== comment.authorId) {
      notifications.push({
        ...base,
        userId: comment.parent.authorId,
        type: 'comment_reply',
        message: 'replied to your comment',
      });
    }
    if (
      ownerId !== undefined &&
      ownerId !== comment.authorId &&
      ownerId !== comment.parent?.authorId
    ) {
      notifications.push({
        ...base,
        userId: ownerId,
        type: isThread ? 'thread_comment' : 'post_comment',
        message: isThread
          ? `commented on your thread “${thread!.title}”`
          : 'commented on your post',
      });
    }
  }

  const friendships = await prisma.friendship.findMany();
  for (const friendship of friendships) {
    const pending = friendship.status === 'pending';
    notifications.push({
      userId: pending ? friendship.addresseeId : friendship.requesterId,
      actorId: pending ? friendship.requesterId : friendship.addresseeId,
      type: pending ? 'friend_request' : 'friend_accepted',
      message: pending
        ? 'sent you a friend request'
        : 'accepted your friend request',
      link: '/',
      createdAt: friendship.createdAt,
      readAt: pending ? null : friendship.createdAt,
    });
  }

  const movedReports = await prisma.report.findMany({
    where: { status: { not: 'todo' } },
    select: { id: true, authorId: true, status: true, createdAt: true },
  });
  for (const report of movedReports) {
    notifications.push({
      userId: report.authorId,
      actorId: userIds.admin,
      type: 'report_status',
      message: `moved your report ${ticketNumber(report.id)} to ${reportStatusLabels[report.status]}`,
      link: '/reports',
      createdAt: new Date(
        Math.min(Date.now(), report.createdAt.getTime() + 20 * 60 * 1000),
      ),
      readAt: null,
    });
  }

  await prisma.notification.createMany({ data: notifications });
  return notifications.length;
}

const media = {
  frieren: [
    'anime',
    '154587',
    'Sousou no Frieren',
    'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-qQTzQnEJJ3oB.jpg',
    2023,
    28,
  ],
  bebop: [
    'anime',
    '1',
    'Cowboy Bebop',
    'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1-GCsPm7waJ4kS.png',
    1998,
    26,
  ],
  demonSlayer: [
    'anime',
    '101922',
    'Kimetsu no Yaiba',
    'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx101922-WBsBl0ClmgYL.jpg',
    2019,
    26,
  ],
  jujutsu: [
    'anime',
    '113415',
    'Jujutsu Kaisen',
    'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-LHBAeoZDIsnF.jpg',
    2020,
    24,
  ],
  spyFamily: [
    'anime',
    '140960',
    'SPY×FAMILY',
    'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx140960-Kb6R5nYQfjmP.jpg',
    2022,
    12,
  ],
  titan: [
    'anime',
    '16498',
    'Shingeki no Kyojin',
    'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx16498-buvcRTBx4NSm.jpg',
    2013,
    25,
  ],
  dbz: [
    'anime',
    '813',
    'Dragon Ball Z',
    'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx813-ZhnFNOeCU5dQ.png',
    1989,
    291,
  ],
  onePiece: [
    'manga',
    '30013',
    'ONE PIECE',
    'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx30013-BeslEMqiPhlk.jpg',
    1997,
    null,
  ],
  naruto: [
    'manga',
    '30011',
    'NARUTO',
    'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/nx30011-9yUF1dXWgDOx.jpg',
    1999,
    700,
  ],
  chainsaw: [
    'manga',
    '105778',
    'Chainsaw Man',
    'https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/bx105778-euxXZEIfDY2u.png',
    2018,
    null,
  ],
  persona: [
    'game',
    '117731',
    'Persona 5 Strikers',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co2zoq.jpg',
    2020,
    null,
  ],
  hollowKnight: [
    'game',
    '365702',
    'Hollow Knight',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/cocpbl.jpg',
    2023,
    null,
  ],
  stardew: [
    'game',
    '17000',
    'Stardew Valley',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/coa93h.jpg',
    2016,
    null,
  ],
  eldenRing: [
    'game',
    '325591',
    'Elden Ring Nightreign',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/co95gk.jpg',
    2025,
    null,
  ],
} as const satisfies Record<
  string,
  [MediaType, string, string, string, number, number | null]
>;

const library: [UserKey, keyof typeof media, LibraryStatus, boolean, number][] =
  [
    ['admin', 'frieren', 'completed', true, hours(3)],
    ['admin', 'hollowKnight', 'current', false, days(2)],
    ['admin', 'stardew', 'on_hold', true, days(5)],
    ['naruto', 'naruto', 'completed', true, hours(5)],
    ['naruto', 'demonSlayer', 'current', true, days(3)],
    ['luffy', 'onePiece', 'current', true, hours(8)],
    ['spike', 'bebop', 'completed', true, hours(14)],
    ['tanjiro', 'demonSlayer', 'completed', true, days(1)],
    ['gojo', 'jujutsu', 'current', true, hours(20)],
    ['itadori', 'jujutsu', 'planned', true, days(2)],
    ['itadori', 'chainsaw', 'dropped', false, days(4)],
    ['anya', 'spyFamily', 'current', true, hours(2)],
    ['levi', 'titan', 'completed', true, days(6)],
    ['mikasa', 'titan', 'planned', true, days(3)],
    ['goku', 'dbz', 'current', true, hours(30)],
    ['nami', 'stardew', 'planned', true, days(1)],
    ['vegeta', 'eldenRing', 'dropped', true, hours(12)],
    ['zoro', 'persona', 'current', false, days(2)],
  ];

const earlierStatuses: Record<LibraryStatus, LibraryStatus[]> = {
  planned: [],
  current: ['planned'],
  completed: ['planned', 'current'],
  on_hold: ['current'],
  dropped: ['current'],
};

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.community.deleteMany();
  await prisma.user.deleteMany();

  const characterPassword = await bcrypt.hash(CHARACTER_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@user.com',
      username: 'admin',
      name: 'Admin',
      avatarUrl: '/images/avatars/admin.webp',
      coverUrl: '/images/user-covers/admin.webp',
      isAdmin: true,
      tourCompletedAt: minutesAgo(days(30)),
      password: await bcrypt.hash('123456', 10),
      createdAt: minutesAgo(days(30)),
    },
  });
  userIds.admin = admin.id;

  const user = await prisma.user.create({
    data: {
      email: 'user@user.com',
      username: 'user',
      name: 'User',
      avatarUrl: '/images/avatars/user.webp',
      coverUrl: '/images/user-covers/user.webp',
      password: await bcrypt.hash('123456', 10),
      createdAt: minutesAgo(days(2)),
    },
  });
  userIds.user = user.id;

  for (const [key, name] of Object.entries(characters)) {
    const user = await prisma.user.create({
      data: {
        email: `${key}@anime.test`,
        username: key,
        name,
        avatarUrl: `/images/avatars/${key}.webp`,
        coverUrl: `/images/user-covers/${key}.webp`,
        tourCompletedAt: minutesAgo(days(30)),
        checklistDismissedAt: minutesAgo(days(29)),
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
    const threads = forums[community.name] ?? [];
    const commentsByPost = postComments[community.name] ?? {};
    const outsider = [
      community.owner,
      ...(community.admins ?? []),
      ...community.posts.map(([key]) => key),
      ...threads.flatMap((thread) => [
        thread.author,
        ...voters(thread),
        ...participants(thread.comments),
      ]),
      ...Object.values(commentsByPost).flatMap((comments) =>
        participants(comments),
      ),
    ].find((key) => !memberKeys.has(key));
    if (outsider) {
      throw new Error(`"${community.name}": ${outsider} isn't a member`);
    }

    const created = await prisma.community.create({
      data: {
        name: community.name,
        iconUrl: communityImage('communities', community.name),
        coverUrl: communityImage('covers', community.name),
        backgroundUrl: communityImage('backgrounds', community.name),
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
      },
    });

    for (const [index, [key, ago, content]] of community.posts.entries()) {
      const post = await prisma.post.create({
        data: {
          communityId: created.id,
          authorId: userIds[key],
          content,
          createdAt: minutesAgo(ago),
        },
      });
      const commentCount = await createComments(
        created.id,
        'post',
        post.id,
        commentsByPost[index],
      );
      await prisma.post.update({
        where: { id: post.id },
        data: { commentCount },
      });
    }

    for (const thread of threads) {
      const createdThread = await prisma.thread.create({
        data: {
          communityId: created.id,
          authorId: userIds[thread.author],
          title: thread.title,
          content: thread.content,
          score: scoreOf(thread),
          createdAt: minutesAgo(thread.ago),
        },
      });
      await createVotes(created.id, 'thread', createdThread.id, thread);
      const commentCount = await createComments(
        created.id,
        'thread',
        createdThread.id,
        thread.comments,
      );
      await prisma.thread.update({
        where: { id: createdThread.id },
        data: { commentCount },
      });
    }

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

  await prisma.report.createMany({
    data: reports.map(([author, category, status, ago, message, pageUrl]) => ({
      authorId: userIds[author],
      category,
      status,
      message,
      pageUrl,
      createdAt: minutesAgo(ago),
    })),
  });

  console.log('📣 Reports created:', reports.length);

  for (const [user, key, status, isPublic, ago] of library) {
    const [mediaType, sourceId, title, coverImage, year, total] = media[key];
    const share = {
      completed: 1,
      current: 0.45,
      on_hold: 0.3,
      dropped: 0.15,
      planned: 0,
    }[status];
    const progress =
      mediaType === 'game'
        ? 0
        : total
          ? Math.round(total * share)
          : status === 'planned'
            ? 0
            : { current: 1100, dropped: 40, completed: 1, on_hold: 20 }[status];
    const history = [...earlierStatuses[status], status];
    const at = (step: number) =>
      minutesAgo(ago + (history.length - 1 - step) * days(3));

    await prisma.libraryEntry.create({
      data: {
        userId: userIds[user],
        mediaId: `${mediaType.toUpperCase()}_${sourceId}`,
        mediaType,
        sourceId,
        title,
        coverImage,
        year,
        status,
        progress,
        total,
        isPublic,
        createdAt: at(0),
        updatedAt: at(history.length - 1),
        activities: {
          create: [
            ...history.map((step, index) => ({
              status: step,
              createdAt: at(index),
            })),
            ...(status === 'current' && total && progress > 1
              ? [
                  {
                    status,
                    progressFrom: Math.max(1, progress - 2),
                    progressTo: progress,
                    createdAt: minutesAgo(Math.max(0, ago - 45)),
                  },
                ]
              : []),
          ],
        },
      },
    });
  }

  console.log('📚 Library entries created:', library.length);

  console.log('🔔 Notifications created:', await createNotifications());

  console.log('✅ Seeding complete!');
  console.log('🔑 admin (or admin@user.com) / 123456');
  console.log('🔑 user (or user@user.com) / 123456');
  console.log(
    `🔑 <character> (or <character>@anime.test) / ${CHARACTER_PASSWORD} (e.g. naruto)`,
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
