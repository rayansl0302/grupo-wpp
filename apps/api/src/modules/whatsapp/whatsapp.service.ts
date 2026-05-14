import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  WASocket,
  AnyMessageContent,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import pino from 'pino';
import { logger } from '../../config/logger';
import { prisma } from '../../config/database';
import { randomDelay } from '../../shared/utils/anti-ban';

const SESSIONS_DIR = path.resolve('sessions');

interface SessionInstance {
  socket: WASocket;
}

class WhatsAppService extends EventEmitter {
  private sessions = new Map<string, SessionInstance>();

  async initSession(sessionName: string): Promise<void> {
    try {
      console.log(`\n[WhatsApp] Iniciando sessao: ${sessionName}`);

      const sessionDir = path.join(SESSIONS_DIR, sessionName);
      fs.mkdirSync(sessionDir, { recursive: true });

      const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`[WhatsApp] Baileys v${version.join('.')} (latest: ${isLatest})`);

      const socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }) as never,
        generateHighQualityLinkPreview: true,
        browser: ['WPP Bot', 'Chrome', '120.0.0'],
      });

      socket.ev.on('creds.update', saveCreds);

      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log(`\n[WhatsApp] QR Code gerado para "${sessionName}"`);
          console.log('[WhatsApp] Escaneie no app: WhatsApp > Aparelhos conectados\n');
          try {
            await prisma.whatsAppSession.update({
              where: { name: sessionName },
              data: { status: 'qr_pending', qrCode: qr },
            });
          } catch (e) {
            console.error('[WhatsApp] Erro ao salvar QR no DB:', e);
          }
          this.emit('qr', { sessionName, qr });
        }

        if (connection === 'close') {
          const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = reason !== DisconnectReason.loggedOut;

          console.log(`[WhatsApp] Sessao "${sessionName}" desconectada. Reason: ${reason}, reconectar: ${shouldReconnect}`);

          // Atualiza status (sessao pode ter sido deletada do DB - ignora erro)
          const exists = await prisma.whatsAppSession.findUnique({ where: { name: sessionName } });
          if (exists) {
            await prisma.whatsAppSession.update({
              where: { name: sessionName },
              data: { status: 'disconnected', qrCode: null },
            }).catch((e) => console.error('[WhatsApp] Erro ao atualizar status:', e.message));
          } else {
            console.log(`[WhatsApp] Sessao "${sessionName}" foi removida do DB. Encerrando.`);
          }

          this.sessions.delete(sessionName);

          // So reconecta se a sessao ainda existe no DB
          if (shouldReconnect && exists) {
            console.log(`[WhatsApp] Reconectando "${sessionName}" em 5s...`);
            setTimeout(() => this.initSession(sessionName).catch(console.error), 5000);
          }
        }

        if (connection === 'open') {
          const phone = socket.user?.id.split(':')[0] ?? null;
          console.log(`\n[WhatsApp] CONECTADO! Sessao: "${sessionName}" / Numero: ${phone}\n`);
          const exists = await prisma.whatsAppSession.findUnique({ where: { name: sessionName } });
          if (exists) {
            await prisma.whatsAppSession.update({
              where: { name: sessionName },
              data: { status: 'connected', phoneNumber: phone, qrCode: null },
            }).catch((e) => console.error('[WhatsApp] Erro ao salvar status conectado:', e.message));
          }
          this.emit('connected', { sessionName, phone });
        }
      });

      this.sessions.set(sessionName, { socket });
    } catch (err) {
      console.error(`\n[WhatsApp] ERRO ao iniciar sessao "${sessionName}":`, err);
      logger.error({ err, sessionName }, 'Erro fatal no initSession');
      throw err;
    }
  }

  async sendText(sessionName: string, jid: string, text: string): Promise<void> {
    const instance = this.sessions.get(sessionName);
    if (!instance) throw new Error(`Sessao "${sessionName}" nao esta conectada`);
    await randomDelay();
    await instance.socket.sendMessage(jid, { text });
  }

  async sendImageWithCaption(
    sessionName: string,
    jid: string,
    imageUrl: string,
    caption: string,
  ): Promise<void> {
    const instance = this.sessions.get(sessionName);
    if (!instance) throw new Error(`Sessao "${sessionName}" nao esta conectada`);
    await randomDelay();
    const content: AnyMessageContent = { image: { url: imageUrl }, caption };
    await instance.socket.sendMessage(jid, content);
  }

  async getGroups(sessionName: string): Promise<Array<{ jid: string; subject: string }>> {
    const instance = this.sessions.get(sessionName);
    if (!instance) return [];
    const groups = await instance.socket.groupFetchAllParticipating();
    return Object.entries(groups).map(([jid, meta]) => ({ jid, subject: meta.subject }));
  }

  isConnected(sessionName: string): boolean {
    return this.sessions.has(sessionName);
  }
}

export const whatsappService = new WhatsAppService();
