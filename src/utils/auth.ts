import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { admin } from "better-auth/plugins"
import { createAccessControl } from "better-auth/plugins/access"
import { defaultStatements } from "better-auth/plugins/admin/access"
import prisma from "./prisma"
import { sendMail } from "./mail"

const statement = {
  ...defaultStatements,
  jobOffer: ["moderate"],
  event: ["moderate"],
  location: ["manage"],
  studentGroup: ["manage"],
  system: ["view"],
} as const

const ac = createAccessControl(statement)

const userRole = ac.newRole({})
// A report has no permission of its own: event:moderate covers a report against an event, and
// jobOffer:moderate covers a report against a job. These two roles thus also give report
// moderation for their own target type, and for no other type.
const jobModeratorRole = ac.newRole({ jobOffer: ["moderate"] })
const eventModeratorRole = ac.newRole({ event: ["moderate"] })
const adminRole = ac.newRole({
  ...defaultStatements,
  jobOffer: ["moderate"],
  event: ["moderate"],
  location: ["manage"],
  studentGroup: ["manage"],
  system: ["view"],
})

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Passwort zurücksetzen",
        text: `Klicke auf den folgenden Link, um dein Passwort zurückzusetzen:\n\n${url}\n\nWenn du das nicht warst, kannst du diese E-Mail ignorieren.`,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "E-Mail-Adresse bestätigen",
        text: `Klicke auf den folgenden Link, um deine E-Mail-Adresse zu bestätigen:\n\n${url}\n\nDer Link ist eine Stunde gültig. Wenn du das nicht warst, kannst du diese E-Mail ignorieren.`,
      })
    },
  },
  session: {
    // The cookie cache removes a database round trip on each request.
    // A change to the session becomes effective after maxAge seconds.
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
  plugins: [
    admin({
      ac,
      roles: {
        user: userRole,
        jobModerator: jobModeratorRole,
        eventModerator: eventModeratorRole,
        admin: adminRole,
      },
    }),
  ],
})
