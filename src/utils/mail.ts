const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY ?? import.meta.env.MAILGUN_API_KEY
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN ?? import.meta.env.MAILGUN_DOMAIN

type MailMessage = {
  to: string
  subject: string
  text: string
}

/**
 * Sends via Mailgun when MAILGUN_API_KEY/MAILGUN_DOMAIN are configured,
 * otherwise logs the message so auth flows stay usable in local dev.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.warn(
      `[mail] MAILGUN_API_KEY/MAILGUN_DOMAIN not set, logging email instead of sending:\n` +
        `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`
    )
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
    throw new Error(`Mailgun request failed with status ${response.status}`)
  }
}
