import { Core } from "@strapi/strapi"
import { add } from "date-fns"
import bcrypt from "bcryptjs"

const SEED_USER = {
  username: "seed-user",
  email: "seed@example.com",
  password: "Seed1234!",
}

const JOB_OFFERS = [
  {
    title: "Frontend Developer",
    company: "TechCorp GmbH",
    location: "Bamberg",
    working_hours: 40,
    description: "We are looking for an experienced Frontend Developer to join our team.",
    online_status: "published",
    external_url: "https://example.com/apply/frontend",
    contact: { name: "Anna Müller", mail: "anna@techcorp.de", phone: "+49 951 123456" },
  },
  {
    title: "Backend Engineer",
    company: "DataSystems AG",
    location: "Remote",
    working_hours: 32,
    description: "Join our backend team and help build scalable APIs.",
    online_status: "published",
    contact: { name: "Max Schmidt", mail: "max@datasystems.de" },
  },
  {
    title: "UX Designer",
    company: "Kreativ Studio",
    location: "Bamberg",
    working_hours: 20,
    description: "Part-time UX Designer for a creative agency in Bamberg.",
    online_status: "submitted",
    contact: { name: "John Doe", mail: "jobs@kreativstudio.de" },
  },
  {
    title: "DevOps Engineer",
    company: "CloudOps GmbH",
    location: "Nürnberg",
    working_hours: 40,
    description: "Maintain and improve our cloud infrastructure.",
    online_status: "expired",
    contact: { name: "Lisa Weber", mail: "lisa@cloudops.de" },
  },
  {
    title: "Full Stack Developer",
    company: "Startup Hub Bamberg",
    location: "Bamberg",
    working_hours: 40,
    description:
      "Join our fast-growing startup and work across the entire stack — React, Node.js, and PostgreSQL.",
    online_status: "published",
    external_url: "https://example.com/apply/fullstack",
    contact: { name: "Tom Bauer", mail: "tom@startuphub.de", phone: "+49 951 654321" },
  },
  {
    title: "Werkstudent Marketing",
    company: "RegioMedia GmbH",
    location: "Bamberg",
    working_hours: 20,
    description:
      "Unterstütze unser Marketingteam bei der Erstellung von Content und der Pflege unserer Social-Media-Kanäle.",
    online_status: "published",
    contact: { name: "Sara König", mail: "sara@regiomedia.de" },
  },
] as const

async function seed(strapi: Core.Strapi) {
  const existingOffers = await strapi.db.query("api::job-offer.job-offer").count({})

  if (existingOffers > 0) {
    strapi.log.info("Seed: data already present, skipping.")
    return
  }

  const pluginStore = strapi.store({ type: "plugin", name: "users-permissions" })
  const settings = await pluginStore.get({ key: "advanced" })

  const role = await strapi.db.query("plugin::users-permissions.role").findOne({
    where: { type: (settings as any)?.default_role ?? "authenticated" },
  })

  const hashed = await bcrypt.hash(SEED_USER.password, 10)

  const user = await strapi.db.query("plugin::users-permissions.user").create({
    data: {
      ...SEED_USER,
      password: hashed,
      provider: "local",
      confirmed: true,
      role: role?.id,
    },
  })

  strapi.log.info(`Seed: created user ${user.email}`)

  for (const offer of JOB_OFFERS) {
    const { contact, ...rest } = offer
    const createdOffer = await strapi.documents("api::job-offer.job-offer").create({
      data: {
        ...rest,
        offline_after: add(new Date(), { days: 30 }),
        owner: user.id,
        contact,
      } as any,
    })

    await strapi.documents("api::job-offer.job-offer").update({
      documentId: createdOffer.documentId,
      data: {
        online_status: offer.online_status,
      },
    })

    strapi.log.info(`Seed: created job offer "${createdOffer.title}"`)
  }

  strapi.log.info("Seed: done.")
}

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    strapi.service("api::mensa.mensa").load()

    if (process.env.SEED === "true") {
      strapi.log.info("Starting seeding process...")
      await seed(strapi)
      strapi.log.info("Seeding process completed.")
    }
  },
}
