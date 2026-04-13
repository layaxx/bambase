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

const LOCATIONS = [
  // University buildings
  {
    name: "U2 – An der Universität 2",
    lat: 49.893681,
    lon: 10.887644,
    category: "university",
    description: "Teilbereiche der Fakultät GuK, Teilbibliothek 1",
    address: { street: "An der Universität", streetNumber: "2", city: "Bamberg", zip: 96047 },
  },
  {
    name: "U5 – An der Universität 5",
    lat: 49.893819,
    lon: 10.887191,
    category: "university",
    description: "Teilbereiche der Fakultät GuK, Multimedia-Sprachlabor",
    address: { street: "An der Universität", streetNumber: "5", city: "Bamberg", zip: 96047 },
  },
  {
    name: "U7 – An der Universität 7",
    lat: 49.8941,
    lon: 10.887376,
    category: "university",
    description: "Hörsaal, Bibliotheksmagazin",
    address: { street: "An der Universität", streetNumber: "7", city: "Bamberg", zip: 96047 },
  },
  {
    name: "U11 – An der Universität 11",
    lat: 49.894363,
    lon: 10.887255,
    category: "university",
    description: "Teilbereiche der Fakultät GuK",
    address: { street: "An der Universität", streetNumber: "11", city: "Bamberg", zip: 96047 },
  },
  {
    name: "DO2A/AULA – Aula/Dominikanerbau",
    lat: 49.891573,
    lon: 10.885482,
    category: "university",
    description: "Aula im Dominikanerbau",
    address: { street: "Dominikanerstraße", streetNumber: "2", city: "Bamberg", zip: 96049 },
  },
  {
    name: "WE5 (ERBA) – An der Weberei 5",
    lat: 49.903097,
    lon: 10.869834,
    category: "university",
    description:
      "Fakultät WIAI, Teilbereiche der Fakultäten GuK und HuWi, ERBA-Bibliothek, Cafeteria ",
    address: { street: "An der Weberei", streetNumber: "5", city: "Bamberg", zip: 96049 },
  },
  {
    name: "F21 (Feki) – Feldkirchenstraße 21",
    lat: 49.907519,
    lon: 10.904843,
    category: "university",
    description: "Fakultät SoWi, Audimax, Mensa & Cafeteria",
    address: { street: "Feldkirchenstraße", streetNumber: "21", city: "Bamberg", zip: 96052 },
  },
  {
    name: "KR12 – Am Kranen 12",
    lat: 49.892587,
    lon: 10.886834,
    category: "university",
    description: "Teilbereiche der Fakultät GuK",
    address: { street: "Am Kranen", streetNumber: "12", city: "Bamberg", zip: 96047 },
  },
  {
    name: "Kä7 – Kärntenstraße 7",
    lat: 49.912406,
    lon: 10.900366,
    category: "university",
    description: "Teilbereiche der Fakultät SoWi",
    address: { street: "Kärntenstraße", streetNumber: "7", city: "Bamberg", zip: 96052 },
  },
  {
    name: "KS13 – Kapellenstraße 13",
    lat: 49.890484,
    lon: 10.90845,
    category: "university",
    description: "Prüfungsraum",
    address: { street: "Kapellenstraße", streetNumber: "13", city: "Bamberg", zip: 96050 },
  },
  {
    name: "LU19 – Luitpoldstraße 19",
    lat: 49.897572,
    lon: 10.894291,
    category: "university",
    description: "Seminarräume, Zentrum für Lehrerinnen- und Lehrerbildung",
    address: { street: "Luitpoldstraße", streetNumber: "19", city: "Bamberg", zip: 96050 },
  },
  {
    name: "M3 (Marcushaus) – Markusplatz 3",
    lat: 49.895733,
    lon: 10.883903,
    category: "university",
    description: "Fakultät HuWi, Teilbibliothek 2",
    address: { street: "Markusplatz", streetNumber: "3", city: "Bamberg", zip: 96047 },
  },
  {
    name: "MG1/MG2 – Markusstraße 8a",
    lat: 49.895305,
    lon: 10.882857,
    category: "university",
    description: "Teilbereiche der Fakultäten HuWi, Hörsäle, Cafeteria",
    address: { street: "Markusstraße", streetNumber: "8a", city: "Bamberg", zip: 96047 },
  },
  {
    name: "RZ (Rechenzentrum/IT-Service) – An der Universität 19, RZ-Gebäude",
    lat: 49.90792,
    lon: 10.9048,
    category: "university",
    description: "IT-Service (vormals Rechenzentrum), Serverräume, PC-Pools",
    address: { street: "Feldkirchenstraße", streetNumber: "21", city: "Bamberg", zip: 96052 },
  },
  {
    name: "GU13 – Gutenbergstraße 13",
    lat: 49.883774,
    lon: 10.927057,
    category: "university",
    description: "Teilbereiche der Fakultät WIAI",
    address: { street: "Gutenbergstraße", streetNumber: "13", city: "Bamberg", zip: 96050 },
  },

  // Mensa & Cafeteria
  {
    name: "Mensa FEKI",
    lat: 49.9067,
    lon: 10.9051,
    category: "mensa",
    description: "Mensa Feldkirchenstraße",
    address: { street: "Feldkirchenstraße", streetNumber: "21", city: "Bamberg", zip: 96052 },
  },
  {
    name: "Mensa Austraße",
    lat: 49.8935,
    lon: 10.887,
    category: "mensa",
    description: "Austraße 37, Mensa in der Innenstadt",
    address: { street: "Austraße", streetNumber: "37", city: "Bamberg", zip: 96047 },
  },
  {
    name: "Cafeteria ERBA",
    lat: 49.9033,
    lon: 10.8699,
    category: "mensa",
    description: "An der Weberei 5, Cafeteria am ERBA-Campus",
    address: { street: "An der Weberei", streetNumber: "5", city: "Bamberg", zip: 96047 },
  },
  {
    name: "Cafeteria Markusplatz",
    lat: 49.8957,
    lon: 10.8838,
    category: "mensa",
    description: "Markusplatz 3, Cafeteria in der Altstadt",
    address: { street: "Markusplatz", streetNumber: "3", city: "Bamberg", zip: 96047 },
  },

  // Libraries
  {
    name: "Teilbibliothek 3 (SOWi) / Zentralbibliothek",
    lat: 49.9067,
    lon: 10.9046,
    category: "library",
    description: "Feldkirchenstraße 21, Zentral- & Teilbibliothek 3",
    address: { street: "Feldkirchenstraße", streetNumber: "21", city: "Bamberg", zip: 96052 },
  },
  {
    name: "Teilbibliothek 1 (Theologie und Philosophie)",
    lat: 49.8943,
    lon: 10.8879,
    category: "library",
    description: "An der Universität 2",
    address: { street: "An der Universität", streetNumber: "2", city: "Bamberg", zip: 96047 },
  },
  {
    name: "Teilbibliothek 2 (Humanwissenschaften)",
    lat: 49.8957,
    lon: 10.8838,
    category: "library",
    description: "Markusplatz 3",
    address: { street: "Markusplatz", streetNumber: "3", city: "Bamberg", zip: 96047 },
  },
  {
    name: "Teilbibliothek 4 (Sprach- und Literaturwissenschaften)",
    lat: 49.8941,
    lon: 10.8864,
    category: "library",
    description: "Heumarkt 2",
    address: { street: "Heumarkt", streetNumber: "2", city: "Bamberg", zip: 96047 },
  },
  {
    name: "Teilbibliothek 5 (Geschichts- und Geowissenschaften)",
    lat: 49.8928,
    lon: 10.8861,
    category: "library",
    description: "Am Kranen 3",
    address: { street: "Am Kranen", streetNumber: "3", city: "Bamberg", zip: 96047 },
  },
  {
    name: "ERBA-Bibliothek (WIAI)",
    lat: 49.9033,
    lon: 10.8699,
    category: "library",
    description: "An der Weberei 5, ERBA-Campus",
    address: { street: "An der Weberei", streetNumber: "5", city: "Bamberg", zip: 96047 },
  },
  {
    name: "Staatsbibliothek Bamberg",
    lat: 49.8918,
    lon: 10.8823,
    category: "library",
    description: "Domplatz 8, Neue Residenz – historische Landesbibliothek",
    address: { street: "Domplatz", streetNumber: "8", city: "Bamberg", zip: 96049 },
  },

  // Sport
  {
    name: "Hochschulsport (FEKI)",
    lat: 49.9067,
    lon: 10.9046,
    category: "sport",
    description: "Feldkirchenstraße 21, Verwaltung & Sporthallen",
    address: { street: "Feldkirchenstraße", streetNumber: "21", city: "Bamberg", zip: 96052 },
  },
  {
    name: "Hochschulsportanlage Volkspark",
    lat: 49.8984,
    lon: 10.9304,
    category: "sport",
    description: "Armeestraße 47, Außensportanlagen der Universität",
    address: { street: "Armeestraße", streetNumber: "47", city: "Bamberg", zip: 96050 },
  },
  {
    name: "brose Arena",
    lat: 49.879672,
    lon: 10.920169,
    category: "sport",
    description: "Heimspielstätte der Brose Bamberg Basketball GmbH",
    address: { street: "Forchheimer Straße", streetNumber: "15", city: "Bamberg", zip: 96050 },
  },
  {
    name: "Fuchs-Park Stadion",
    lat: 49.901252,
    lon: 10.927711,
    category: "sport",
    description: "Fuchs-Park-Straße 1, Fußballstadion",
    address: { street: "Pödeldorfer Straße", streetNumber: "180", city: "Bamberg", zip: 96050 },
  },

  // Venues
  {
    name: "Schlenkerla",
    lat: 49.8917,
    lon: 10.885,
    category: "venues",
    description: "Dominikanerstraße 6, Traditionsbrauerei mit Rauchbier",
    address: { street: "Dominikanerstraße", streetNumber: "6", city: "Bamberg", zip: 96049 },
  },
  {
    name: "Brauerei Spezial",
    lat: 49.8969,
    lon: 10.8928,
    category: "venues",
    description: "Obere Königstraße 10, Brauerei & Gaststätte",
    address: { street: "Obere Königstraße", streetNumber: "10", city: "Bamberg", zip: 96052 },
  },
  {
    name: "Brauerei Fässla",
    lat: 49.8971,
    lon: 10.8928,
    category: "venues",
    description: "Obere Königstraße 19–21, Brauerei & Hotel",
    address: { street: "Obere Königstraße", streetNumber: "19", city: "Bamberg", zip: 96052 },
  },
  {
    name: "Mahrs Bräu",
    lat: 49.8899,
    lon: 10.9064,
    category: "venues",
    description: "Wunderburg 10, beliebte Brauereikneipe",
    address: { street: "Wunderburg", streetNumber: "10", city: "Bamberg", zip: 96050 },
  },
  {
    name: "Zapfhahn",
    lat: 49.8934,
    lon: 10.8821,
    category: "venues",
    description: "Untere Sandstraße 14, Bar & Restaurant",
    address: { street: "Untere Sandstraße", streetNumber: "14", city: "Bamberg", zip: 96049 },
  },
  {
    name: "Kachelofen",
    lat: 49.8917,
    lon: 10.8844,
    category: "venues",
    description: "Obere Sandstraße 1, fränkische Gaststätte",
    address: { street: "Obere Sandstraße", streetNumber: "1", city: "Bamberg", zip: 96049 },
  },
  {
    name: "Zum Sternla",
    lat: 49.8919,
    lon: 10.8914,
    category: "venues",
    description: "Lange Straße, fränkische Gaststätte",
    address: { street: "Lange Straße", city: "Bamberg", zip: 96047 },
  },
  {
    name: "Café Abseits",
    lat: 49.8998,
    lon: 10.9076,
    category: "venues",
    description: "Pödeldorfer Straße 39, Bar & Bierspezialitäten",
    address: { street: "Pödeldorfer Straße", streetNumber: "39", city: "Bamberg", zip: 96052 },
  },
  {
    name: "Live-Club Bamberg",
    lat: 49.8917,
    lon: 10.8839,
    category: "venues",
    description: "Untere Sandstraße, Club & Konzertveranstaltungen",
    address: { street: "Untere Sandstraße", city: "Bamberg", zip: 96049 },
  },
  {
    name: "Wilde Rose Keller",
    lat: 49.8843,
    lon: 10.8869,
    category: "venues",
    description: "Sternwartstraße, Bierkeller & Biergarten",
    address: { street: "Sternwartstraße", city: "Bamberg", zip: 96049 },
  },
  {
    name: "Spezial-Keller",
    lat: 49.8848,
    lon: 10.8872,
    category: "venues",
    description: "Sternwartstraße, Bierkeller auf dem Berg",
    address: { street: "Sternwartstraße", city: "Bamberg", zip: 96049 },
  },

  // Other
  {
    name: "Bahnhof Bamberg",
    lat: 49.9006,
    lon: 10.8997,
    category: "other",
    description: "Ludwigstraße, Zug, Regionalbahn & Fernbus",
    address: { street: "Ludwigstraße", city: "Bamberg", zip: 96052 },
  },
  {
    name: "ZOB Bamberg",
    lat: 49.9012,
    lon: 10.8988,
    category: "other",
    description: "Zentraler Omnibusbahnhof",
  },
  {
    name: "Klinikum Bamberg",
    lat: 49.8672,
    lon: 10.8906,
    category: "other",
    description: "Buger Straße 80, Krankenhaus der Sozialstiftung Bamberg",
    address: { street: "Buger Straße", streetNumber: "80", city: "Bamberg", zip: 96049 },
  },
  {
    name: "Agentur für Arbeit Bamberg",
    lat: 49.8973,
    lon: 10.9087,
    category: "other",
    description: "Ludwigstraße, Jobcenter & Berufsberatung",
    address: { street: "Ludwigstraße", city: "Bamberg", zip: 96052 },
  },
  {
    name: "SWerk Würzburg – Außenstelle Bamberg",
    lat: 49.8935,
    lon: 10.887,
    category: "other",
    description: "Austraße 37, BAföG, Sozialberatung & Wohnheime",
    address: { street: "Austraße", streetNumber: "37", city: "Bamberg", zip: 96047 },
  },
] as const

export async function seed(strapi: Core.Strapi) {
  const existingOffers = await strapi.db.query("api::job-offer.job-offer").count({})
  const existingEvents = await strapi.db.query("api::event.event").count({})
  const existingLocations = await strapi.db.query("api::location.location").count({})

  if (existingOffers > 0 && existingEvents > 0 && existingLocations > 0) {
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

  strapi.log.info("Seed: done.")
}
