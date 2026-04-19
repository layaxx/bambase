import { type Core } from "@strapi/strapi"
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
    where: { type: (settings as { default_role?: string }).default_role ?? "authenticated" },
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
      const { contact, isOwned, ...rest } = offer
      const createdOffer = await strapi.documents("api::job-offer.job-offer").create({
        data: {
          ...rest,
          owner: isOwned ? user.id : undefined,
          contact,
        },
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

  // Build a name → documentId map for locations (needed for event associations).
  // Locations are seeded before events so the map is available when creating events.
  const locationMap = new Map<string, string>()

  if (existingLocations === 0) {
    for (const location of LOCATIONS) {
      const created = await strapi.documents("api::location.location").create({
        data: location,
      })
      locationMap.set(created.name, created.documentId)
      strapi.log.info(`Seed: created location "${created.name}"`)
    }
  } else {
    // Locations already exist — populate the map from the database so events can
    // still be linked when only the event table is empty.
    const existing = (await strapi.db.query("api::location.location").findMany({})) as Array<{
      name: string
      documentId: string
    }>
    for (const loc of existing) {
      locationMap.set(loc.name, loc.documentId)
    }
  }

  if (existingEvents === 0) {
    for (const { isOwned, map_location_name, custom_location, ...event } of EVENTS) {
      const mapLocationId = map_location_name ? locationMap.get(map_location_name) : undefined
      if (map_location_name && !mapLocationId) {
        strapi.log.warn(
          `Seed: location "${map_location_name}" not found for event "${event.title}"`
        )
      }

      const createdEvent = await strapi.documents("api::event.event").create({
        data: {
          ...event,
          owner: isOwned ? user.id : undefined,
          ...(mapLocationId ? { map_location: mapLocationId } : {}),
          ...(custom_location ? { custom_location } : {}),
        },
      })

      strapi.log.info(`Seed: created event "${createdEvent.title}"`)
    }
  }

  if (existingStudentGroups === 0) {
    for (const group of STUDENT_GROUPS) {
      const created = await strapi.documents("api::student-group.student-group").create({
        data: group,
      })
      strapi.log.info(`Seed: created student group "${created.name}"`)
    }
  }

  strapi.log.info("Seed: done.")
}
