const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SEED_USERS = [
  {
    email: 'admin@worktonix.io',
    password: 'Admin@1234',
    displayName: 'Admin',
    role: 'ADMIN',
  },
  {
    email: 'tech@worktonix.io',
    password: 'Tech@1234',
    displayName: 'Tech Team',
    role: 'TECH',
  },
  {
    email: 'manager@worktonix.io',
    password: 'Manager@1234',
    displayName: 'Manager',
    role: 'MANAGER',
  },
];

async function main() {
  console.log('Seeding database...');

  for (const userData of SEED_USERS) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {
        displayName: userData.displayName,
        role: userData.role,
        password: hashedPassword,
      },
      create: {
        email: userData.email,
        password: hashedPassword,
        displayName: userData.displayName,
        role: userData.role,
      },
    });

    console.log(`Seeded user: ${user.email} (${user.role})`);
  }

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
