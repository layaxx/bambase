import { getLogger } from "./logger"

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY ?? import.meta.env.MAILGUN_API_KEY
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN ?? import.meta.env.MAILGUN_DOMAIN

type MailMessage = {
  to: string
  subject: string
  text: string
}

/**
 * Sends the message with Mailgun if MAILGUN_API_KEY and MAILGUN_DOMAIN are set.
 * If they are not set, it logs the message, thus the auth flows stay usable in
 * local development.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    // The recipient is personal data and the body can carry password-reset links, so both stay
    // out of production logs.
    if (import.meta.env.PROD) {
      getLogger().warn({ subject: message.subject }, "mailgun not configured, email not sent")
    } else {
      getLogger().warn(
        { to: message.to, subject: message.subject },
        "mailgun not configured, email not sent"
      )
      getLogger().debug({ body: message.text }, "email body")
    }
    return
  }

  const body = new URLSearchParams({
    from: `BamBase <no-reply@${MAILGUN_DOMAIN}>`,
    to: message.to,
    subject: message.subject,
    text: message.text,
  })

  const api_url = `https://api.eu.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`

  const response = await fetch(api_url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })

  if (!response.ok) {
    const reason = (await response.text().catch(() => "")).slice(0, 500)
    getLogger().error(
      { subject: message.subject, status: response.status, reason },
      "email send failed"
    )
    throw new Error(`Mailgun request failed with status ${response.status}: ${reason}`)
  }

  const { id } = (await response.json().catch(() => ({}))) as { id?: string }
  getLogger().info({ subject: message.subject, mailgunId: id }, "email sent")
}
