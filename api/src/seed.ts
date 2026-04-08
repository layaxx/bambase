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

const EVENTS = [
  {
    title: "Filmvorführung im Kino",
    description:
      "Gemeinsamer Kinoabend mit einem aktuellen Film. Eintritt für Studierende ermäßigt.",
    organizer: "Kino Bamberg",
    start: add(new Date(), { days: 1, hours: 20 }),
    end: add(new Date(), { days: 1, hours: 22 }),
    external_id: "filmvorfuehrung-im-kino",
  },
  {
    title: "Stadtführung durch Bamberg",
    description:
      "Entdecke die Altstadt Bambergs mit einer geführten Tour durch die UNESCO-Welterbestätten.",
    organizer: "Tourist-Information Bamberg",
    start: add(new Date(), { days: 2, hours: 14 }),
    end: add(new Date(), { days: 2, hours: 16 }),
    external_id: "stadtfuehrung-durch-bamberg",
  },
  {
    title: "Besuch des Bamberger Doms",
    description:
      "Geführte Besichtigung des Bamberger Doms mit Erklärungen zur Geschichte und Architektur.",
    organizer: "Bistum Bamberg",
    start: add(new Date(), { days: 3, hours: 16 }),
    end: add(new Date(), { days: 3, hours: 18 }),
    external_id: "besuch-des-bamberger-doms",
  },
  {
    title: "Hochschulsport: Volleyball",
    description:
      "Offenes Volleyballtraining für alle Studierenden. Vorkenntnisse nicht erforderlich.",
    organizer: "Hochschulsport Bamberg",
    start: add(new Date(), { days: 1, hours: 18 }),
    end: add(new Date(), { days: 1, hours: 20 }),
    external_id: "hochschulsport-volleyball",
  },
  {
    title: "Hochschulsport: Yoga für Anfänger",
    description: "Entspannter Yoga-Kurs für Einsteiger. Matte bitte selbst mitbringen.",
    organizer: "Hochschulsport Bamberg",
    start: add(new Date(), { days: 4, hours: 9 }),
    end: add(new Date(), { days: 4, hours: 10, minutes: 30 }),
    external_id: "hochschulsport-yoga",
  },
  {
    title: "Livekonzert: Indie Night",
    description:
      "Lokale Indie-Bands spielen live. Eintritt frei für alle Studierenden mit Ausweis.",
    organizer: "Live-Club Bamberg",
    start: add(new Date(), { days: 1, hours: 21 }),
    end: add(new Date(), { days: 1, hours: 24 }),
    external_id: "live-club-konzert",
  },
  {
    title: "Gastvortrag: KI im Alltag",
    description:
      "Renommierte Forscherin hält einen Vortrag über den Einfluss von Künstlicher Intelligenz auf unseren Alltag.",
    organizer: "Universität Bamberg",
    start: add(new Date(), { days: 5, hours: 18 }),
    end: add(new Date(), { days: 5, hours: 20 }),
    external_id: "uni-vortrag-ki",
  },
  {
    title: "Ersti-Party",
    description:
      "Die große Willkommensparty für alle Erstsemester. Lernt euch kennen und feiert den Start ins Studium!",
    organizer: "Studierendenvertretung Uni Bamberg",
    start: add(new Date(), { days: 7, hours: 20 }),
    end: add(new Date(), { days: 8, hours: 2 }),
    external_id: "uni-ersti-party",
  },
  {
    title: "Bibliotheksführung für Erstsemester",
    description:
      "Lernt die Universitätsbibliothek kennen: Ausleihe, Datenbanken, Lernräume und mehr.",
    organizer: "Universitätsbibliothek Bamberg",
    start: add(new Date(), { days: 3, hours: 11 }),
    end: add(new Date(), { days: 3, hours: 12 }),
    external_id: "bibliothek-fuehrung",
  },
  {
    title: "Offene Sozialberatung",
    description:
      "Kostenlose Beratung zu BAföG, Wohnen, Finanzen und sozialen Fragen für Studierende.",
    organizer: "Studentenwerk Bamberg",
    start: add(new Date(), { days: 1, hours: 10 }),
    end: add(new Date(), { days: 1, hours: 12 }),
    external_id: "studentenwerk-beratung",
  },
] as const

export async function seed(strapi: Core.Strapi) {
  const existingOffers = await strapi.db.query("api::job-offer.job-offer").count({})
  const existingEvents = await strapi.db.query("api::event.event").count({})

  if (existingOffers > 0 && existingEvents > 0) {
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

  for (const event of EVENTS) {
    const createdEvent = await strapi.documents("api::event.event").create({
      data: {
        ...event,
        owner: user.id,
      } as any,
    })

    strapi.log.info(`Seed: created event "${createdEvent.title}"`)
  }

  strapi.log.info("Seed: done.")
}
