import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it('constructs PrismaClient with the runtime database adapter', async () => {
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/salonai?schema=public';

    const prisma = new PrismaService();

    await prisma.$disconnect();
  });
});
