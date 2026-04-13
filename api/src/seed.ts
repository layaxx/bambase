import { Core } from "@strapi/strapi"
import { add } from "date-fns"
import bcrypt from "bcryptjs"

import { STUDENT_GROUPS } from "./seed/student-groups"
import { SEED_USER } from "./seed/seed-user"
import { JOB_OFFERS } from "./seed/job-offers"
import { EVENTS } from "./seed/events"
import { LOCATIONS } from "./seed/locations"

export async function seed(strapi: Core.Strapi) {
  const existingOffers = await strapi.db.query("api::job-offer.job-offer").count({})
  const existingEvents = await strapi.db.query("api::event.event").count({})
  const existingLocations = await strapi.db.query("api::location.location").count({})
  const existingStudentGroups = await strapi.db.query("api::student-group.student-group").count({})

  if (
    existingOffers > 0 &&
    existingEvents > 0 &&
    existingLocations > 0 &&
    existingStudentGroups > 0
  ) {
    strapi.log.info("Seed: data already present, skipping.")
    return
  }

  const pluginStore = strapi.store({ type: "plugin", name: "users-permissions" })
  const settings = await pluginStore.get({ key: "advanced" })

  const role = await strapi.db.query("plugin::users-permissions.role").findOne({
    where: { type: (settings as any)?.default_role ?? "authenticated" },
  })

  let user = await strapi.db.query("plugin::users-permissions.user").findOne({
    where: { email: SEED_USER.email },
  })

  if (!user) {
    const hashed = await bcrypt.hash(SEED_USER.password, 10)
    user = await strapi.db.query("plugin::users-permissions.user").create({
      data: {
        ...SEED_USER,
        password: hashed,
        provider: "local",
        confirmed: true,
        role: role?.id,
      },
    })
    strapi.log.info(`Seed: created user ${user.email}`)
  }

  if (existingOffers === 0) {
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
  }

  if (existingEvents === 0) {
    for (const event of EVENTS) {
      const createdEvent = await strapi.documents("api::event.event").create({
        data: {
          ...event,
          owner: user.id,
        } as any,
      })

      strapi.log.info(`Seed: created event "${createdEvent.title}"`)
    }
  }

  if (existingLocations === 0) {
    for (const location of LOCATIONS) {
      const created = await strapi.documents("api::location.location").create({
        data: location as any,
      })
      strapi.log.info(`Seed: created location "${created.name}"`)
    }
  }

  if (existingStudentGroups === 0) {
    for (const group of STUDENT_GROUPS) {
      const created = await strapi.documents("api::student-group.student-group").create({
        data: group as any,
      })
      strapi.log.info(`Seed: created student group "${created.name}"`)
    }
  }

  strapi.log.info("Seed: done.")
}
