import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@wppbot.com' },
    update: {},
    create: { email: 'admin@wppbot.com', password: hashed, name: 'Admin', role: 'admin' },
  });

  const session = await prisma.whatsAppSession.upsert({
    where: { name: 'principal' },
    update: {},
    create: { name: 'principal', status: 'disconnected' },
  });

  const group = await prisma.whatsAppGroup.upsert({
    where: { jid_sessionId: { jid: '120363000000000001@g.us', sessionId: session.id } },
    update: {},
    create: {
      jid: '120363000000000001@g.us',
      name: 'Grupo Promoções Teste',
      sessionId: session.id,
      dailyLimit: 20,
    },
  });

  const campaign = await prisma.campaign.upsert({
    where: { id: 'seed-campaign-1' },
    update: {},
    create: {
      id: 'seed-campaign-1',
      name: 'Eletrônicos com Desconto',
      keywords: JSON.stringify(['smart tv', 'notebook', 'celular', 'fone bluetooth']),
      categories: JSON.stringify(['MLB1000', 'MLB1648']),
      minDiscount: 15,
      freeShipping: true,
      cronExpr: '0 9,12,18,21 * * *',
      templateType: 'hype',
      useAI: false,
    },
  });

  await prisma.campaignGroup.upsert({
    where: { campaignId_groupId: { campaignId: campaign.id, groupId: group.id } },
    update: {},
    create: { campaignId: campaign.id, groupId: group.id },
  });

  console.log('✅ Seed concluído');
}

main().catch(console.error).finally(() => prisma.$disconnect());
