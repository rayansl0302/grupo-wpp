import { Router } from 'express';
import { prisma } from '../../config/database';
import { whatsappService } from './whatsapp.service';
import { z } from 'zod';

export const whatsappRouter = Router();

// POST /whatsapp/sessions — cria e conecta uma sessão
whatsappRouter.post('/sessions', async (req, res) => {
  const body = z.object({ name: z.string().min(2) }).parse(req.body);

  const session = await prisma.whatsAppSession.upsert({
    where: { name: body.name },
    update: {},
    create: { name: body.name, status: 'disconnected' },
  });

  // inicia conexão em background (não bloqueia response)
  whatsappService.initSession(session.name).catch((err) => {
    console.error(`\n[ROUTE] Falha ao iniciar sessao "${session.name}":`, err);
  });

  res.json({ sessionId: session.id, name: session.name, status: 'connecting' });
});

// GET /whatsapp/sessions — lista sessões
whatsappRouter.get('/sessions', async (_req, res) => {
  const sessions = await prisma.whatsAppSession.findMany({
    select: { id: true, name: true, status: true, phoneNumber: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(sessions);
});

// GET /whatsapp/sessions/:id/qr — retorna QR code da sessão
whatsappRouter.get('/sessions/:id/qr', async (req, res) => {
  const session = await prisma.whatsAppSession.findUniqueOrThrow({
    where: { id: req.params.id },
    select: { qrCode: true, status: true },
  });
  res.json({ qrCode: session.qrCode, status: session.status });
});

// GET /whatsapp/sessions/:name/groups — lista grupos da sessão
whatsappRouter.get('/sessions/:name/groups', async (req, res) => {
  const groups = await whatsappService.getGroups(req.params.name);
  res.json(groups);
});

// POST /whatsapp/groups — registra grupo para receber campanhas
whatsappRouter.post('/groups', async (req, res) => {
  const body = z
    .object({ jid: z.string(), name: z.string(), sessionId: z.string(), dailyLimit: z.number().default(10) })
    .parse(req.body);

  const group = await prisma.whatsAppGroup.upsert({
    where: { jid_sessionId: { jid: body.jid, sessionId: body.sessionId } },
    update: { name: body.name, dailyLimit: body.dailyLimit },
    create: body,
  });
  res.json(group);
});

// GET /whatsapp/groups — lista grupos ativos
whatsappRouter.get('/groups', async (_req, res) => {
  const groups = await prisma.whatsAppGroup.findMany({
    include: { session: { select: { name: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(groups);
});

// PATCH /whatsapp/groups/:id/toggle — ativa/pausa grupo
whatsappRouter.patch('/groups/:id/toggle', async (req, res) => {
  const group = await prisma.whatsAppGroup.findUniqueOrThrow({ where: { id: req.params.id } });
  const updated = await prisma.whatsAppGroup.update({
    where: { id: req.params.id },
    data: { active: !group.active },
  });
  res.json(updated);
});

// DELETE /whatsapp/groups/:id — remove grupo
whatsappRouter.delete('/groups/:id', async (req, res) => {
  await prisma.whatsAppGroup.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// DELETE /whatsapp/sessions/:id — remove sessão
whatsappRouter.delete('/sessions/:id', async (req, res) => {
  await prisma.whatsAppSession.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
