import { sendMail } from "./mail"
import { getLogger } from "./logger"

export type JobNotificationKind = "received" | "published" | "rejected"

type NotifiedJob = {
  slug: string
  title: string
  rejectionReason?: string | null
}

function jobMail(job: NotifiedJob, kind: JobNotificationKind, origin: string) {
  const url = `${origin}/job/${job.slug}`
  switch (kind) {
    case "received":
      return {
        subject: `Stellenangebot eingereicht: ${job.title}`,
        text: `Wir haben dein Stellenangebot „${job.title}“ erhalten. Es wird nach einer kurzen Prüfung veröffentlicht, in der Regel innerhalb weniger Tage. Wir schicken dir eine E-Mail, sobald es geprüft ist.\n\n${url}`,
      }
    case "published":
      return {
        subject: `Stellenangebot veröffentlicht: ${job.title}`,
        text: `Dein Stellenangebot „${job.title}“ ist jetzt auf BamBase online:\n\n${url}`,
      }
    case "rejected":
      return {
        subject: `Stellenangebot abgelehnt: ${job.title}`,
        text: `Dein Stellenangebot „${job.title}“ wurde nicht veröffentlicht.\n\nGrund: ${job.rejectionReason ?? "–"}\n\nDu kannst das Angebot bearbeiten und damit erneut zur Prüfung einreichen:\n\n${url}/edit`,
      }
  }
}

/**
 * Tells the owner of a job offer about a change of its moderation status. A failed mail only
 * logs: the status change is already saved, and the owner still sees it on the site.
 */
export async function notifyJobOwner(
  to: string | undefined,
  job: NotifiedJob,
  kind: JobNotificationKind,
  origin: string
): Promise<void> {
  if (!to) return
  try {
    await sendMail({ to, ...jobMail(job, kind, origin) })
  } catch (error) {
    // ponytail: no retry or outbox, a Mailgun outage drops the mail. Add an outbox table if that happens.
    getLogger().error({ err: error, slug: job.slug, kind }, "job notification failed")
  }
}
