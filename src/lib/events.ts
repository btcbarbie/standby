import { prisma } from "./prisma";

// One line in a watch's conversation. Also becomes the watch's status line, unless quiet.
// The same line said again (Scout checking and finding nothing new) folds into the last one with a count.

export type Who = "SCOUT" | "BANKER" | "VAULT" | "YOU" | "PAYPAL" | "STANDBY";

export async function say(mandateId: string, who: Who, text: string, opts: { alert?: boolean; decisionId?: string; note?: boolean } = {}) {
  if (opts.note !== false) await prisma.mandate.update({ where: { id: mandateId }, data: { lastNote: text } });
  const last = await prisma.event.findFirst({ where: { mandateId }, orderBy: { at: "desc" } });
  if (last && !opts.alert && !opts.decisionId && !last.decisionId && last.who === who && last.text === text) {
    await prisma.event.update({ where: { id: last.id }, data: { count: { increment: 1 }, lastAt: new Date() } });
    return;
  }
  await prisma.event.create({ data: { mandateId, who, text, alert: !!opts.alert, decisionId: opts.decisionId ?? null } });
}
