import { add } from "date-fns"

export const EVENTS = [
  {
    title: "Filmvorführung im Kino",
    description:
      "Gemeinsamer Kinoabend mit einem aktuellen Film. Eintritt für Studierende ermäßigt.",
    organizer: "Kino Bamberg",
    start: add(new Date(), { days: 1, hours: 20 }),
    end: add(new Date(), { days: 1, hours: 22 }),
    external_id: "filmvorfuehrung-im-kino",
    isOwned: true,
  },
  {
    title: "Stadtführung durch Bamberg",
    description:
      "Entdecke die Altstadt Bambergs mit einer geführten Tour durch die UNESCO-Welterbestätten.",
    organizer: "Tourist-Information Bamberg",
    start: add(new Date(), { days: 2, hours: 14 }),
    end: add(new Date(), { days: 2, hours: 16 }),
    external_id: "stadtfuehrung-durch-bamberg",
    isOwned: false,
  },
  {
    title: "Besuch des Bamberger Doms",
    description:
      "Geführte Besichtigung des Bamberger Doms mit Erklärungen zur Geschichte und Architektur.",
    organizer: "Bistum Bamberg",
    start: add(new Date(), { days: 3, hours: 16 }),
    end: add(new Date(), { days: 3, hours: 18 }),
    external_id: "besuch-des-bamberger-doms",
    isOwned: false,
  },
  {
    title: "Hochschulsport: Volleyball",
    description:
      "Offenes Volleyballtraining für alle Studierenden. Vorkenntnisse nicht erforderlich.",
    organizer: "Hochschulsport Bamberg",
    start: add(new Date(), { days: 1, hours: 18 }),
    end: add(new Date(), { days: 1, hours: 20 }),
    external_id: "hochschulsport-volleyball",
    isOwned: false,
  },
  {
    title: "Hochschulsport: Yoga für Anfänger",
    description: "Entspannter Yoga-Kurs für Einsteiger. Matte bitte selbst mitbringen.",
    organizer: "Hochschulsport Bamberg",
    start: add(new Date(), { days: 4, hours: 9 }),
    end: add(new Date(), { days: 4, hours: 10, minutes: 30 }),
    external_id: "hochschulsport-yoga",
    isOwned: false,
  },
  {
    title: "Livekonzert: Indie Night",
    description:
      "Lokale Indie-Bands spielen live. Eintritt frei für alle Studierenden mit Ausweis.",
    organizer: "Live-Club Bamberg",
    start: add(new Date(), { days: 1, hours: 21 }),
    end: add(new Date(), { days: 1, hours: 24 }),
    external_id: "live-club-konzert",
    isOwned: false,
  },
  {
    title: "Gastvortrag: KI im Alltag",
    description:
      "Renommierte Forscherin hält einen Vortrag über den Einfluss von Künstlicher Intelligenz auf unseren Alltag.",
    organizer: "Universität Bamberg",
    start: add(new Date(), { days: 5, hours: 18 }),
    end: add(new Date(), { days: 5, hours: 20 }),
    external_id: "uni-vortrag-ki",
    isOwned: false,
  },
  {
    title: "Ersti-Party",
    description:
      "Die große Willkommensparty für alle Erstsemester. Lernt euch kennen und feiert den Start ins Studium!",
    organizer: "Studierendenvertretung Uni Bamberg",
    start: add(new Date(), { days: 7, hours: 20 }),
    end: add(new Date(), { days: 8, hours: 2 }),
    external_id: "uni-ersti-party",
    isOwned: false,
  },
  {
    title: "Bibliotheksführung für Erstsemester",
    description:
      "Lernt die Universitätsbibliothek kennen: Ausleihe, Datenbanken, Lernräume und mehr.",
    organizer: "Universitätsbibliothek Bamberg",
    start: add(new Date(), { days: 3, hours: 11 }),
    end: add(new Date(), { days: 3, hours: 12 }),
    external_id: "bibliothek-fuehrung",
    isOwned: false,
  },
  {
    title: "Offene Sozialberatung",
    description:
      "Kostenlose Beratung zu BAföG, Wohnen, Finanzen und sozialen Fragen für Studierende.",
    organizer: "Studentenwerk Bamberg",
    start: add(new Date(), { days: 1, hours: 10 }),
    end: add(new Date(), { days: 1, hours: 12 }),
    external_id: "studentenwerk-beratung",
    isOwned: false,
  },
] as const
