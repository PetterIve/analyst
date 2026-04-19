import type { Bot, Context } from 'grammy'
import { prisma } from '#/server/db'
import { logger } from '#/lib/logger.server'

const HELP_BODY = [
  '<b>Analyst bot — commands</b>',
  '',
  '/start — subscribe to alerts',
  '/help — show this message',
  '/mute — pause alerts for this chat',
  '/unmute — resume alerts',
  '/performance — weekly performance summary (lands in T15)',
].join('\n')

export function registerCommands(bot: Bot): void {
  bot.command('start', handleStart)
  bot.command('help', handleHelp)
  bot.command('mute', (ctx) => toggleActive(ctx, false))
  bot.command('unmute', (ctx) => toggleActive(ctx, true))
  bot.command('performance', handlePerformance)
}

async function handleStart(ctx: Context): Promise<void> {
  const chat = ctx.chat
  if (!chat) return
  const chatId = String(chat.id)
  const username = 'username' in chat ? chat.username : undefined

  const { created } = await upsertSubscriber(chatId, username)
  logger.info({ chatId, username, created }, 'telegram /start')

  await ctx.reply(
    created
      ? "You're subscribed to tanker alerts. Use /help to see commands."
      : 'Already subscribed — nothing to do. /help for commands.',
  )
}

async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(HELP_BODY, { parse_mode: 'HTML' })
}

async function handlePerformance(ctx: Context): Promise<void> {
  await ctx.reply(
    'Weekly performance summary will appear here once T15 lands.',
  )
}

async function toggleActive(ctx: Context, active: boolean): Promise<void> {
  const chat = ctx.chat
  if (!chat) return
  const chatId = String(chat.id)

  const existing = await prisma.subscriber.findUnique({ where: { chatId } })
  if (!existing) {
    await ctx.reply('You are not subscribed yet — send /start first.')
    return
  }

  await prisma.subscriber.update({ where: { chatId }, data: { active } })
  logger.info({ chatId, active }, 'telegram subscription toggled')
  await ctx.reply(active ? 'Alerts resumed.' : 'Alerts paused. /unmute to resume.')
}

interface UpsertResult {
  created: boolean
}

async function upsertSubscriber(
  chatId: string,
  username: string | undefined,
): Promise<UpsertResult> {
  const existing = await prisma.subscriber.findUnique({ where: { chatId } })
  if (existing) {
    if (!existing.active || (username && username !== existing.username)) {
      await prisma.subscriber.update({
        where: { chatId },
        data: { active: true, username: username ?? existing.username },
      })
    }
    return { created: false }
  }
  await prisma.subscriber.create({
    data: { chatId, username, active: true },
  })
  return { created: true }
}
