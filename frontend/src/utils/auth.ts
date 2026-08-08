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
} as const

const ac = createAccessControl(statement)

const userRole = ac.newRole({})
const moderatorRole = ac.newRole({ jobOffer: ["moderate"] })
const adminRole = ac.newRole({ ...defaultStatements, jobOffer: ["moderate"] })

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
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
    // Avoids a DB round trip on every request; session changes are picked up
    // again within maxAge seconds.
    cookieCache: {
      enabled: true,
      maxAge: 60,
    },
  },
  plugins: [
    admin({
      ac,
      roles: { user: userRole, moderator: moderatorRole, admin: adminRole },
    }),
  ],
})
