import { getLogger } from "./logger"

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY ?? import.meta.env.MAILGUN_API_KEY
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN ?? import.meta.env.MAILGUN_DOMAIN

export const HELP_EMAIL = "support@bambase.de"

const MAILGUN_API = "https://api.eu.mailgun.net/v3"
const authHeader = () => `Basic ${btoa(`api:${MAILGUN_API_KEY}`)}`

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

  const response = await fetch(`${MAILGUN_API}/${MAILGUN_DOMAIN}/messages`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
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

/** `ok: null` means Mailgun did not answer, so the state of the key and domain is unknown. */
export type MailStatus = { ok: boolean | null; detail?: string }

const PROBE_TTL_MS = 5 * 60 * 1000
let probe: { at: number; result: Promise<MailStatus> } | undefined

async function probeMailgun(): Promise<MailStatus> {
  try {
    const response = await fetch(`${MAILGUN_API}/domains/${MAILGUN_DOMAIN}`, {
      headers: { Authorization: authHeader() },
      signal: AbortSignal.timeout(3000),
    })
    // 401: bad or send-only key. 404: unknown domain, or a domain in the US region.
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` }
    const { domain } = (await response.json()) as { domain?: { state?: string } }
    return { ok: domain?.state === "active", detail: domain?.state }
  } catch (err) {
    getLogger().warn({ err }, "mailgun probe failed")
    return { ok: null, detail: "unreachable" }
  }
}

/**
 * Checks that the API key can read MAILGUN_DOMAIN and that the domain is active. Sends nothing.
 * The result is cached for 5 minutes, so a frequent health poll costs one Mailgun call per
 * 5 minutes. Caching the promise also lets concurrent polls share one call.
 */
export function checkMailgun(): Promise<MailStatus> {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN)
    return Promise.resolve({ ok: false, detail: "not configured" })
  if (!probe || Date.now() - probe.at >= PROBE_TTL_MS) {
    probe = { at: Date.now(), result: probeMailgun() }
  }
  return probe.result
}
