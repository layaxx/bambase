import { PrismaPg } from "@prisma/adapter-pg"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { PrismaClient } from "../src/generated/prisma/client.ts"
import type {
  LocationCategory,
  EventCategory,
  JobType,
  JobField,
  WorkMode,
  JobOnlineStatus,
} from "../src/generated/prisma/enums.ts"
import { slugify } from "../src/utils/slugify.ts"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// A standalone better-auth instance mirroring src/utils/auth.ts — duplicated
// here because this script runs under plain Node, which can't resolve that
// module's extensionless imports the way Vite/Astro can.
const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
})

const SEED_USER = { email: "seed@example.com", password: "Seed1234!" }
// A second user with no owned content — used by e2e tests for the empty-state UI.
const CLEAN_USER = { email: "clean@example.com", password: "Clean1234!" }
// A separate account (not SEED_USER/CLEAN_USER) so granting it the "admin" role
// doesn't affect existing e2e assertions about ownership/empty-state UI.
const ADMIN_USER = { email: "admin@example.com", password: "Admin1234!" }

const STUDENT_GROUPS = [
  {
    name: "AK Philosophie",
    description:
      "Seit dem Wintersemester 2018/2019 gibt es in der Bamberger Philosophie den Arbeitskreis Philosophie. Dieser besteht aus Studierenden, die sich gemeinsam am Institut für studentische Interessen einsetzen und insgesamt bei der Gestaltung des studentischen Lebens in der Bamberger Philosophie mitwirken möchten. Unter anderem gehören dazu die Koordinierung des philosophischen Stammtischs (immer mittwochs ab 20:00 Uhr in der Galerie am Stephansberg), die Vermittlung von Lesekreisen, die Organisation von Fußballspielen gegen andere Institute sowie des jährlichen Sommerfestes und der Weihnachtsfeier. Auch Lehrevaluationen und das Sammeln von Kritik, Anregungen und Wünschen zur Vermittlung zwischen Lehrenden und Studierenden sind Tätigkeitsfelder des AKs. Mehr Infos unter /philosophie/arbeitskreis-philosophie.",
    website: "https://www.uni-bamberg.de/philosophie/arbeitskreis-philosophie/",
    email: "ak.philosophie@uni-bamberg.de",
  },
  {
    name: "AK Politik - Arbeitskreis Politikwissenschaft",
    description:
      "Treffen: Etwa jeden zweiten Mittwoch in einer Bamberger Bar und weitere Veranstaltungen. Die Termine und Orte könnt ihr über unsere Webseite einsehen.\nKontakt: akpol.kontakt@gmail.com\nInternet: www.akpol.jimdo.com\nFacebook: https://de-de.facebook.com/AKPolBamberg/\nInstagram: https://www.instagram.com/ak.politikwissenschaft/\nWir sind der Arbeitskreis Politikwissenschaft und setzen uns für die Interessen der Politikstudierenden ein. Zum einen sehen wir uns als vermittelnde Stelle zwischen der Studierendenschaft und den Dozierenden an, zum anderen bieten wir politikbezogene Veranstaltungen abseits des Universitätsbetriebs. Bei uns kannst du Vorträge zu diversen Themen, Filmabende, Studienfahrten oder Podiumsdiskussionen organisieren, dich der Homepage widmen oder aber den Dialog zwischen Studierenden und Lehrenden fördern. Wenn das deine Neugier weckt oder du noch Fragen hast, wende dich einfach mit einer E-Mail an uns!",
    email: "akpol.kontakt@gmail.com",
    facebook: "https://www.facebook.com/Ak-Pol-Bamberg-151081531606452",
    instagram: "https://www.instagram.com/ak.politikwissenschaft/",
  },
  {
    name: "Arbeitskreis Psychiatrie",
    description:
      "Der Ak Psychiatrie Patientenbetreuung e.V. ist ein gemeinnütziger Verein. Er umfasst ca. 25 Mitglieder, von denen die meisten Studierende sind – dies ist jedoch kein Muss. Unser primäres Ziel besteht darin, das Freizeitangebot der Klinik am Michelsberg auf den zwei geschützten psychiatrischen Stationen mit verschiedenen Aktivitäten zu erweitern. Das Anliegen unseres Vereins ist es, dass psychiatrische Patient*innen die Möglichkeit haben, sowohl Ansprache als auch Abwechslung zu erfahren.\nDafür organisieren wir wöchentliche Besuchsdienste, im Rahmen derer wir die Patient*innen zu einem kleinen Spaziergang und zu Kaffee und Kuchen in einem nahegelegenen Café einladen. Im Sommer feiern wir meist ein kleines Sommerfest auf dem Klinikgelände. Die Weihnachtsfeier mit Plätzchen und gemeinsamem Singen runden das Jahr ab.",
  },
  {
    name: "BaSKo e.V.",
    description:
      "BaSKo e.V. ist ein gemeinnütziger Verein, der es sich zur Aufgabe gemacht hat, den Bamberger Studierenden der Kommunikationswissenschaft das Vernetzen innerhalb und außerhalb des Studiums möglichst leicht zu machen. \nSo zum Beispiel organisiert der Verein Exkursionen und Workshops um den Studierenden einen Einblick in sowohl das Fach als auch in das spätere Berufsleben zu geben \nAber auch das Studentenleben kommt nicht zu kurz. Mit regelmäßigen sozialen Events bei denen jeder das Studium für ein paar Stunden vergessen kann wird für einen Ausgleich und Kennenlernmöglichkeiten gesorgt.",
  },
  {
    name: "BLLV – Bayerischer Lehrer- und Lehrerinnenverband",
    description:
      "Wir sind die Studierendengruppe des Bayerischen Lehrer- und Lehrerinnenverbands. Wir vertreten die Interessen aller Lehramtsstudierenden und setzen uns für eine bessere Bildung ein. Wir beraten dich zu deinem Lehramtsstudium, helfen dir beim Erstellen deines Stundenplans und erleichtern dir mit studien- und prüfungsrelevanten Skripten den Alltag.\nBei uns kannst du jegliche Fragen rund um dein EWS Examen und Referendariat stellen. Außerdem bieten wir Seminare zu Rhetorik, Stimmbildung und neuen Unterrichtsmethoden sowie Auslandspraktika und Exkursionen zu Schulen mit reformpädagogischen Konzepten an.",
    website: "https://studierende.bllv.de/wer-wir-sind/studierendengruppen/bamberg/",
    email: "bamberg@studierende.bllv.de",
  },
  {
    name: "Feki.de e. V.",
    description:
      'Feki.de e.V. hat das Ziel, Studierende aller Fakultäten mit Informationen zu vernetzen - ganz nach unserem Motto "Vier Fakultäten - ein Verein!". Die Mitgliedschaft steht allen Studierenden offen, Termine unserer Treffen findet ihr auf unserer Website.\nMit unseren vielen Projekten wollen wir das studentische Leben in Bamberg bereichern. Neben unserer Website (mit Jobbörse und Eventkalender) geben wir den Uniguide und einen kostenlosen Wandkalender heraus und veranstalten Events wie das Freizeitwochenende oder die Partyreihe partycipate®. Außerdem bieten wir Studierenden die Möglichkeit, eigene Ideen im von uns betriebenen offiziellen Unishop umzusetzen.\nNatürlich gibt es auch viele weitere Events für Vereinsmitglieder, wie Vereinstage, Weihnachtsfeiern und Sommerfeste. \nFeki.de e.V. bietet Studierenden die Möglichkeit, Kenntnisse für das spätere Berufsleben zu erwerben sowie Freunde fürs Leben kennenzulernen.',
  },
  {
    name: "Förderverein Economic Studies Bamberg (ESB) e. V.",
    description:
      "Der Förderverein Economic Studies Bamberg (ESB) e.V. verfolgt das Ziel, die universitäre Ausbildung im Fach Volkswirtschaftslehre durch ein starkes Netzwerk aus Studierenden, Alumni und Unternehmen zu bereichern. Als gemeinnütziger Verein, der von Studierenden und Alumni der Universität ehrenamtlich geführt wird und durch die Lehrstühle der Volkswirtschaftslehre unterstützt wird, schaffen wir eine Plattform für den Austausch zwischen Theorie und Praxis.\nUnser Anliegen ist es, durch gezielte Veranstaltungen wie Workshops, Vorträge und die Vermittlung von Praktika den akademischen und beruflichen Werdegang der Studierenden zu fördern und einen direkten Mehrwert für das universitäre Leben zu schaffen. Zudem bieten wir Alumni die Möglichkeit, durch Ehemaligentreffen und die aktive Zusammenarbeit mit der Universität in Verbindung zu bleiben.\nMit unseren Initiativen leisten wir einen wichtigen Beitrag zur Vernetzung von Universität und Gesellschaft und unterstützen damit die Bildungs- und Forschungsziele der Universität, wie sie im Bayerischen Hochschulinnovationsgesetz festgelegt sind. Der ESB e.V. trägt zur Schaffung eines engagierten akademischen Umfelds bei, das die Studierenden in ihrer persönlichen und beruflichen Entwicklung unterstützt.",
    email: "verein@ees-bamberg.de",
  },
  {
    name: "Fränkische Gesellschaft für Philosophie e. V.",
    description:
      "Die Fränkische Gesellschaft für Philosophie e. V. (FGPh) wurde 1991 von Lehrenden der Otto-Friedrich-Universität Bamberg und interessierten Bürgern ins Leben gerufen, um das philosophische Denken aus dem akademischen „Elfenbeinturm“ zu befreien und einer breiten Öffentlichkeit zugänglich zu machen. In diesem Sinne versteht sich die FGPh als Forum für den Austausch von Gedanken und Wissen zu philosophischen sowie gesellschaftlich relevanten Fragestellungen, um so ideengeschichtliche Kenntnisse, ein analytisch-kritisches Denken und den philosophischen Diskurs zu fördern.\nUm diese Ziele zu erreichen, organisiert der Verein öffentliche Vorträge, Workshops und Lesekreise. Regelmäßig finden Veranstaltungen in Kooperation mit dem Teilinstitut für Philosophie der Otto-Friedrich-Universität Bamberg sowie dem studentischen Arbeitskreis Philosophie statt. Daher sind Forschende, Lehrende sowie Alumni und Studierende der Universität Bamberg immer wieder im Veranstaltungsprogramm vertreten. \nDas Vereinsleben und die Veranstaltungen werden von Dozierenden und Studierenden der Otto-Friedrich-Universität Bamberg koordiniert. Studierende, die sich im Vorstand der FGPh engagieren oder die Organisation und Durchführung von Veranstaltungen unterstützen, haben die Möglichkeit, berufspraktische Soft Skills im Bereich der Veranstaltungsorganisation zu erwerben und ihre eigenen Interessen aktiv in die Gestaltung des Programms einzubringen.",
    website: "https://fgph-bamberg.de/",
    email: "info@fgph-bamberg.de",
    facebook: "https://www.facebook.com/FGPhBamberg",
    instagram: "https://www.instagram.com/fgph_bamberg/",
  },
  {
    name: "HSG WiPäd",
    description:
      "Wir sind engagiert, unabhängig und selbstorganisiert. Als die Hochschulgruppe (HSG) WiPäd setzen wir uns für die Belange und Interessen der Bachelor- und Masterstudierenden der Wirtschaftspädagogik ein. Bei uns kannst du ein Teil des Netzwerks zwischen Studierenden und dem Lehrstuhl werden und helfen, die Gemeinschaft der Wirtschaftspädagogen zu fördern. Wir informieren alle WiPäd-Studierende per Mail über den VC-Kurs (Aktuelle Mitteilungen Wirtschaftspädagogik) und Social Media über aktuelle Veranstaltungen und News. Genaue Informationen zu Stammtischen, Informationsabende für das Referendariat, etc. findest du auch auf unserer Facebook und Instagram-Seite. Bei Fragen und Problemen „rund um das (WiPäd)-Studieren in Bamberg“ sind wir dein Ansprechpartner und Vermittler.",
    website: "https://www.uni-bamberg.de/wipaed/studium/waehrend-des-studiums/hochschulgruppe/",
    email: "hsg.wipaed@uni-bamberg.de",
    instagram: "https://www.instagram.com/hsg_wipaed_bamberg/?hl=de",
  },
  {
    name: "Studentischer Arbeitskreis Archäologie Bamberg",
    description:
      "Der Studentische Arbeitskreis Archäologie Bamberg ist eine Gruppe von Studierenden der archäologischen Fächer der Otto-Friedrich-Universität Bamberg, die es sich zur Aufgabe gemacht haben, das studentische Engagement und Miteinander zu fördern.\nDer AK gründete sich mit dem Ziel, durch Veranstaltungen - wie Spieleabende, Exkursionen und dem Forum Archaeologicum sowie unserem Stammtisch - jüngere und ältere Studierende wieder mehr miteinander zu vernetzten. Außerdem soll so der innerfachliche Austausch, sowie der Kontakt zwischen Studierenden, Dozierenden, Professorinnen und Professoren sowie Institutsansprechpersonen ausgebaut werden.\nInteressierte sind herzlich eingeladen, unsere Veranstaltungen zu besuchen und sich zu beteiligen.",
    instagram: "https://www.instagram.com/akuni_bamberg/",
  },
  {
    name: "USI – Unabhängige Studierendeninitiative",
    description:
      'Die Unabhängige Studierendeninitiative e. V. setzt sich aktiv für die Interessen aller Studierenden an der Otto-Friedrich-Universität Bamberg ein. Unser Ziel ist es, die Studienbedingungen zu verbessern und das allgemeine und universitäre Leben der Studierenden in Bamberg zu bereichern.\n\nRegelmäßig planen wir soziale Projekte, um der Gesellschaft etwas zurückzugeben und regionale Institutionen sowie internationale Hilfsorganisationen zu unterstützen.\n\nWeiterhin haben wir eine große Zahl an Veranstaltungen und Events ins Leben gerufen, die regelmäßig stattfinden und den Studienalltag der Studierenden an der Otto-Friedrich-Universität bereichern. Hierzu gehören zum Beispiel unser Fußballturnier "UniCup – powered by USI", ein Kino im Hörsaal "USI zeigt Movie" oder die Kultparty am Universitätsstandort Feldkirchenstraße "USI macht Musi", welche jeden ersten Freitag im neuen Semester stattfindet.',
    email: "vorstand@usi-bamberg.de",
    facebook:
      "https://www.facebook.com/Unabh%C3%A4ngige-Studierendeninitiative-USI-eV-171067202927351",
    instagram: "https://www.instagram.com/usi.bamberg/?hl=de",
  },
  {
    name: "Amnesty International",
    description:
      "Wir sind eine lokal agierende Gruppe, die zu Amnesty International Deutschland und damit zu einer weltweiten Bewegung gehört, die sich für den Schutz der Menschenrechte einsetzt. Wir sind unabhängig von Regierungen, politischen Parteien, Ideologien etc.\nBei uns kannst du Menschenrechten Gehör verschaffen! Ein Großteil unserer Arbeit besteht aus Öffentlichkeitsarbeit, weshalb wir Vorträge und Veranstaltungen organisieren, in deren Rahmen wir auf Menschenrechtsverletzungen aufmerksam machen und Unterschriften sammeln. Außerdem kannst du an bundesweiten Versammlungen und Workshops teilnehmen.",
    website: "https://amnesty-bamberg-hochschulgruppe.de/",
    email: "amnesty-bamberg@gmx.de",
    facebook: "https://de-de.facebook.com/amnestybamberg",
  },
  {
    name: "Arbeiterkind.de",
    description:
      'Wir, die Gruppe "Arbeiterkind Bamberg", setzen uns als eine von 80 ArbeiterKind.de Gruppen für chancengerechte Bildung ein. Laut dem DZHW nehmen 79 von 100 Akademikerkindern ein Studium auf, aber nur 27 von 100 Nicht-Akademikerkindern. Obwohl doppelt so viele die Hochschulreife erreichen (DZHW, 03/2018). Finanzielle Belastungen sind nur ein Grund dafür. Unser Ziel ist es, Schüler*innen aus nicht-akademischen Familien zum Studium zu ermutigen und sie währenddessen zu unterstützen. Durch Informationsveranstaltungen, Workshops und individuelle Beratung möchten wir Wissen vermitteln, Ängste abbauen und notwendige Ressourcen bereitstellen. Bildung sollte für alle zugänglich sein, unabhängig von der sozialen Herkunft!\nDaher unterstützen wir Arbeiterkinder von der Schule bis zum erfolgreichen Studienabschluss. Neben praktischen Informationen zu Studien- und Finanzierungsmöglichkeiten bieten wir Austausch und ein deutschlandweites Online-Netzwerk mit zahlreichen, ehrenamtlichen Mentoren und kostenfreien Trainings und Workshops in ganz Deutschland.',
    website: "https://arbeiterkind.de/mitmachen/lokale-gruppen/bamberg/",
    email: "bamberg@arbeiterkind.de",
    instagram: "https://www.instagram.com/arbeiterkind.de_bamberg/",
  },
  {
    name: "CHANGE e. V. - CHancen NAchhaltig GEstalten",
    description:
      "CHANGE-Chancen.Nachhaltig.Gestalten e. V. ist ein gemeinnütziger Verein aus Bamberg, der sich die Verbesserung der Bildungs- und Lebenschancen weltweit zur Aufgabe macht. Wir verstehen uns als ein Netzwerk von engagierten Menschen, die offen und kritisch über nachhaltige Lebens- und Gesellschaftsentwürfe nachdenken.\nWir arbeiten mit Menschen und Organisationen in Bamberg und weltweit zusammen, um Antworten auf diese Fragen zu suchen und zu entwickeln. Wir machen politische Bildungsarbeit, finanzieren Projekte, organisieren Kampagnen und inspirieren uns und andere für eine schöne Welt zu streiten. Egal ob mit oder ohne Plan, Enthusiasmus oder Frust – wir freuen uns über neue engagierte Mitstreiter:innen!",
    email: "kontakt@chancengestalten.de",
    instagram: "https://www.instagram.com/changebamberg/",
  },
  {
    name: "Freund statt Fremd e. V.",
    description:
      "Integration ist für uns keine Worthülse – sondern gelebtes Engagement. Als gemeinnütziger Verein hilft Freund statt fremd e. V. geflüchteten Menschen nach ihrer Ankunft in Bamberg und Umgebung, sich zurechtzufinden und zu integrieren. Unsere Aktivitäten reichen von Deutsch- und Nachhilfeangeboten über die Vermittlung von Patenschaften, Freizeitangebote bis hin zu Bildungs- und Informationsarbeit, die verschiedene Teams planen und durchführen. Mit der Blauen Frieda in der Schützenstraße 2a bietet der Verein einen Raum für interkulturelle Begegnung und ein Ehrenamtscafé, das von vielen Engagierten mit Leben gefüllt wird.",
    website: "https://freundstattfremd.de/",
    email: "ehrenamt@freundstattfremd.de",
    facebook: "http://facebook.com/freundstattfremd",
    instagram: "https://www.instagram.com/freundstattfremd_bamberg/",
  },
  {
    name: "Leo Club Bamberg",
    description:
      "Wir sind „Leos“ - „we serve“. Wir helfen, wir unterstützen Menschen, die unsere Fürsorge brauchen. Wir, das ist eine offene, eine engagierte internationale Organisation von jungen Menschen die mit Kreativität und vielen Aktionen erfolgreich an verschiedensten Stellen in unserer Gesellschaft wirken. Wir sind Teil eines Netzwerkes von über 6000 Clubs in 145 Ländern. Wir tauschen uns aus, lernen für uns selbst und in einer inspirierenden Gemeinschaft – weltweit und grenzüberschreitend. Bei uns im LEO Club Bamberg steht der Spaß bei den Herausforderungen und gemeinsamen Aktivitäten immer im Vordergrund.",
    website: "https://www.leo-clubs.de/",
    email: "info.leoclub.bamberg@gmail.com",
    instagram: "https://www.instagram.com/leoclubbambergkellerloewen/?hl=de",
  },
  {
    name: "Rotaract Club Bamberg",
    description:
      "Das Motto der Rotaract Clubs lautet „Lernen – Helfen – Feiern“. Getreu dieses Leitspruchs kannst du bei uns unterschiedliche Dinge erleben. Gemeinsam wollen wir uns weiterbilden, beispielsweise durch Vorträge, Betriebsbesichtigungen oder Kulturveranstaltungen. Das Helfen findet sich in unseren Aktionen wieder, wie dem wöchentlichen Hundespaziergang in Kooperation mit dem Tierheim Bamberg oder der „Kauf-Eins-Mehr-Aktion“, bei der wir Lebensmittel an die Bamberger Tafel spenden. Natürlich kommt auch das Feiern nicht zu kurz. Bei den Hochschulpartys oder Feiern (auch mit anderen Clubs) sind wir immer gern mit dabei!\n\nDies alles findet bei uns als Teil eines internationalen Netzwerks aus 190.000 Mitgliedern in 178 Ländern statt. Gemeinsam möchten die Rotaract Clubs mit Begeisterung und Spaß die Welt verbessern und durch Kleines ganz Großes erreichen.",
    website: "https://bamberg.rotaract.de/",
    email: "bamberg@rotaract.de",
    instagram: "https://www.instagram.com/rotaractclubbamberg/",
  },
  {
    name: "UNICEF-Deutschland Bamberg",
    description:
      "Als UNICEF-Team Bamberg treffen wir uns regelmäßig, um unsere aktuellen Aktivitäten zu planen. Jeder entscheidet selbst, wie viel Zeit und Kraft er oder sie einbringen kann und wie er sich engagiert – bei Spendenaktionen, in der Arbeit mit Schulen oder beim Grußkartenverkauf. Sie werden schrittweise in die UNICEF-Arbeit einbezogen und können sich in Workshops Kenntnisse für Ihre Aufgabe aneignen. Eine eigene Internet-Plattform bietet Arbeitsmaterialien und fördert den Austausch der ehrenamtlich Engagierten in ganz Deutschland.",
    email: "info@hochschulgruppe-bamberg.unicef.de",
  },
  {
    name: "Bamberger grün-linke Studierendeninitiative (BAGLS)",
    description:
      "Die Bamberger grün-linke Studierendeninitiative - kurz BAGLS - hat sich im Herbst 2017 gegründet und vertritt seit dem Wintersemester 18/19 die Belange der Studierenden in studentischen Gremien.\nWir legen unseren Schwerpunkt auf ökologische und soziale Themen – u. a. möchten wir das vegane Angebot der Mensa stärken, bezahlbaren Wohnraum schaffen, uns für faire Rahmenbedingungen in Prüfungen und längere Biböffnungszeiten einsetzen, Gleichberechtigung Aller an der Uni umsetzen… und noch vieles mehr!\nUm all das zu verwirklichen setzen wir uns im Studierendenparlament und anderen Gremien für die Studierenden ein. Darüber hinaus veranstalten wir verschiedene Aktionen oder Vorträge, um euch direkt die Chance zu bieten sich fortzubilden oder die Uni zu gestalten. Wir freuen uns immer über neuen Wind und brauchen deine Ideen!",
    email: "kontakt@bagls.de",
    instagram: "https://www.instagram.com/bagls.bamberg",
  },
  {
    name: "Juso-Hochschulgruppe",
    description:
      "Wir, die Juso-Hochschulgruppe, bekennen uns als politische Gruppierung zu den Werten des demokratischen Sozialismus. Wir stehen für Freiheit, Gerechtigkeit und Solidarität.\nDiese Werte bedeuten für uns als Hochschulgruppe, dass Lernen selbstbestimmt und in produktiver Zusammenarbeit mit den Dozent:innen möglich sein soll und, dass sich die Studierenden selbstständig, frei und kritisch mit der Lehre auseinandersetzen können.\nUnser Ziel ist ein gerechtes Studium für alle!\nDeshalb kämpfen wir unter anderem für ein höheres und elternunabhängiges Bafög, für mehr bezahlbaren Wohnraum für Studierende sowie einen günstigen und zuverlässigen öffentlichen Nahverkehr in Bamberg.\nWir sind in antifaschistischen und feministischen Netzwerken aktiv und stehen selbstverständlich gegen Nationalismus, Rassismus, Chauvinismus und Benachteiligungen jeglicher Art ein.",
    email: "jusohsgbamberg@gmail.com",
    instagram: "https://www.instagram.com/jusohsgbamberg/?hl=de",
  },
  {
    name: "RCDS Bamberg",
    description:
      "Der RCDS in Bamberg ist seit dem Jahr 1982 an der Universität Bamberg aktiv und ist damit die älteste Hochschulgruppe an der Otto-Friedrich-Universität. Nebenbei stellt der RCDS auf Bundesebene mit 8.000 Mitgliedern den größten Studierendenverband Deutschlands dar.\nDie Grundlage unserer Arbeit sowie in allen studentischen und universitären Gremien, in denen wir derzeit für die Studierendenschaft tätig sind, bildet das Bekenntnis zur freiheitlich-demokratischen Grundordnung. Wir glauben an die Freiheit des/der Einzelnen in einer offenen und solidarischen Gesellschaft – Gerechtigkeit, Solidarität, Liberalität und Toleranz sind dabei für uns keine bloßen Lippenbekenntnisse.\nDer RCDS Bamberg ist die politische Hochschulgruppe der demokratischen Mitte. Wir bekennen uns zu liberalen, konservativen und sozialen Werten.",
    email: "kontakt@rcds-bamberg.de",
    facebook: "https://www.facebook.com/rcds.bamberg/",
  },
  {
    name: "Ottfried – Die Bamberger Studierendenzeitschrift",
    description:
      "Wir sind unabhängig, selbstfinanziert und keiner politischen Weltanschauung oder Gruppierung verpflichtet. Unsere Zeitschrift von Studierenden für Studierende erscheint insgesamt drei Mal im Jahr, parallel dazu veröffentlichen wir auf unserer Website regelmäßig neue Artikel. Wir behandeln aktuelle Themen, die Bamberg, die Uni und ihre Studierenden betreffen. Der Ottfried ermöglicht es Dir, erste journalistische Erfahrungen zu sammeln und Deine Texte zu veröffentlichen.\nBei uns kannst Du schreiben, fotografieren, layouten, eine Webpräsenz verwalten, organisieren und all das auch lernen. Vorkenntnisse sind nicht nötig, auch 'nur' zum Reinschnuppern sind alle herzlich willkommen!",
    website: "https://www.ottfried.de/",
    email: "ottfried@ottfried.de",
    instagram: "https://www.instagram.com/ottfried.bamberg/",
  },
  {
    name: "Rezensöhnchen",
    description:
      "Wörter sind unsere Leidenschaft – Wir, das Rezensöhnchen, sind eine (studentische) Gruppe von Literatur- und Kulturbegeisterten, die einmal im Semester eine kostenlose Zeitschrift für Literaturkritik ohne Verlag herausbringt und über das Jahr verteilt Rezensionen zu Neuerscheinungen auf unserer Website www.rezensöhnchen.de veröffentlicht. Angefangen beim Lesen von Büchern über das Verfassen von Rezensionen sowie Theater- und Filmkritiken, den Besuch Bamberger Literatureinrichtungen und den Kontakt zu angesehenen zeitgenössischen Literaten, Verlagen und Werbekunden bieten wir eine Vielzahl an Einbringungsmöglichkeiten in unser Team.",
    email: "rezensoehnchen@gmail.com",
    instagram: "http://www.instagram.com/rezensoehnchen/",
  },
  {
    name: "ÖHG - Ökumenische Hochschulgemeinde",
    description:
      "Studieren heißt nicht nur büffeln, am Schreibtisch hocken und auf credit points schielen. Sondern Studieren heißt Fragen stellen, sich nicht mit vorschnellen Antworten abgeben und eigene Standpunkte entwickeln; die unterschiedlichsten Leute kennenlernen, Neues ausprobieren, die eigenen Fähigkeiten zum Klingen bringen, Feste feiern und Freundschaften schließen; entdecken, was mir im Leben wichtig ist, wofür ich mich einsetzen will, was mir Kraft gibt und mich trägt.\nWir sind evangelisch (esg) und katholisch (khg) – und das ist gut so. Aber wir sind auch ökumenisch und interreligiös, das heißt bei uns kann jede und jeder mitmachen!\nUnsere Gemeindeabende finden im Semester dienstags um 19 Uhr statt. Die UniGottesdienste im Semester in der Regel Sonntags um 19 Uhr.",
    website: "https://www.uni-bamberg.de/zentraler-kontakt/",
    email: "khg-bamberg@erzbistum-bamberg.de",
    facebook: "http://www.facebook.com/KHGbamberg/",
  },
  {
    name: "SMD – Christliche Hochschulgruppe",
    description:
      "Die SMD ist ein Netzwerk christlicher Hochschulgruppen.\nWir sind Studierende aller Fachrichtungen und Konfessionen und auch sonst sehr verschieden. Was viele von uns verbindet, ist der Glaube an Jesus Christus. Er ist unser Mittelpunkt. Dabei sind wir überzeugt, dass Denken und Glauben sich nicht widersprechen müssen. Wir wollen Christen dazu herausfordern, ihren Glauben alltagsrelevant zu leben, sowie einen Ort schaffen, wo alle, die interessiert sind, sich über das Christsein informieren und austauschen können.\nBei uns kannst du neue Leute kennenlernen, Gemeinschaft finden, diskutieren, singen, gemeinsam beten, musizieren und vieles mehr. Wir freuen uns auf dich!",
    website: "https://hochschul-smd.org/bamberg/",
    email: "bamberg@smd.org",
    facebook: "https://www.facebook.com/hochschulsmdbamberg",
    instagram: "https://www.instagram.com/smd.bamberg/",
  },
  {
    name: "KDStV Fredericia",
    description:
      'fraternitas, sinceritas, veritas! (auf dt. Liebe, Treue, Wahrheit!)\nKein bloßer Spruch, sondern gelebter Alltag bei der Katholisch Deutschen Studentenverbindung Fredericia im Cartellverband zu Bamberg. Im Jahre 1913 aus der 1911 gegründeten "Akademischen Vereinigung" hervorgegangen, pflegen wir seit dieser Zeit das Couleurstudententum in Bamberg.\nAm wichtigsten ist uns die Gemeinschaft und Freundschaft mit unseren Bundesbrüdern. Bundesbrüderlichkeit ist keine reine Arbeitsbeziehung zu anderen Mitgliedern eines Vereins. Für uns bedeutet sie eine echte Gemeinschaft, in der jeder Bundesbruder - egal welchen Alters - nicht nur mit Unterstützung oder Rat hilft, sondern das auch gerne tut.',
    website: "https://fredericia.de/",
    email: "senior@fredericia.de",
    facebook: "https://www.facebook.com/fredericia.bamberg",
    instagram: "https://www.instagram.com/fredericia.bamberg1913",
  },
  {
    name: "K.St.V. Mainfranken",
    description:
      "Wir sind ein nichtfarbentragender, nichtschlagender Verein von Studierenden aller Fachrichtungen. Wir haben uns zusammengefunden, um gemeinsam zu lernen, zu studieren und zu feiern.\n\nUns verbindet die Orientierung an den Grundsätzen Wissenschaft, Freundschaft und Religion.\n\nBei uns kannst du Vorträge hören, dich über den Rahmen des gewöhnlichen Studiums hinaus interdisziplinär weiterbilden, an studentischen Veranstaltungen oder beispielsweise auch an gemütlichen Grill- oder Glühweinabenden teilnehmen.",
    email: "nachricht@mainfranken-bamberg.de",
    facebook: "https://www.facebook.com/KStVMainfrankenimKVzuBamberg",
  },
  {
    name: "Leipziger Burschenschaft Alemannia zu Bamberg",
    description:
      "Die Leipziger Burschenschaft Alemannia zu Bamberg wurde 1861 gegründet und heißt Bamberger Studenten aller Fachschaften willkommen. Wir bekennen uns zu den Grundprinzipien der christlich-deutschen Gesinnung, Toleranz, Sittlichkeit und Wissenschaftlichkeit. Als nichtschlagende Burschenschaft sind wir eine inhärent politische Studentenverbindung, in der Meinungen aller politischen Richtungen vertreten sind und in der Demokratieverständnis und ein sachlicher Diskurs über Politik gefördert werden.\nNicht zuletzt durch unser Grundprinzip der Wissenschaftlichkeit zeigt sich, dass der Erfolg im Studium und die Unterstützung unserer Bundesbrüder im akademischen Leben zentrale Teile des Mitgliedseins sind.",
    website: "https://www.alemannia-bamberg.de/",
  },
  {
    name: "W.K.St.V. Unitas Henricia Bamberg",
    description:
      "Die 1927 gegründete Unitas Henricia ist Mitglied im ältesten katholischen Akademikerverband, dem Verband der Wissenschaftlichen Katholischen Studentenvereine UNITAS e.V. Als eine weder schlagende noch farbentragende Korporation bemühen wir uns, Tradition und zeitgemäße studentische Gemeinschaft zu verbinden. Der Unitas-Verband ist der einzige katholische Korporationsverband, dem sowohl Männer als auch Frauen angehören.\nIn unserem Vereinsleben pflegen wir eine fächerübergreifende Auseinandersetzung mit wissenschaftlichen und religiösen Themen und wollen in froher Geselligkeit Freundschaften aufbauen, die über das Studium hinausreichen. Das findet Ausdruck in unseren Prinzipien: virtus - scientia - amicitia.",
    email: "unitas-henricia.bamberg@gmx.de",
    facebook: "https://www.facebook.com/unitashenricia/",
    instagram: "https://www.instagram.com/unitashenricia/",
  },
  {
    name: "AEGEE–Bamberg e. V.",
    description:
      "Some call it Europe - we call it home!\n\nAEGEE-Bamberg ist ein lokaler Standort von AEGEE-Europe und damit Teil einer der größten internationalen Studierenden-Assoziationen Europas. Gemeinsam mit mehr als 10.000 Mitgliedern aus über 40 Ländern setzt sich AEGEE-Bamberg für ein demokratisches, vielfältiges und grenzenloses Europa ein.\n\nDer Verein ist finanziell und konfessionell unabhängig und motiviert junge Menschen eine aktive Rolle in der Gesellschaft zu übernehmen. Durch und mit AEGEE werden in Bamberg nicht nur lokale Events, Ausflüge, Austauschreisen, Sommer Universitäten und themenspezifische Trainings organisiert, sondern auch aktuelle Themen wie Nachhaltigkeit, politischer Aktivismus, mentale Gesundheit oder soziale Gerechtigkeit thematisiert.",
    website: "https://aegee-bamberg.eu",
    email: "bamberg@aegee.eu",
    facebook: "https://www.facebook.com/AEGEE.Bamberg",
    instagram: "https://www.instagram.com/aegeebamberg/",
  },
  {
    name: "JEF Bamberg",
    description:
      "Die Jungen Europäischen Föderalist:innen sind ein europaweit tätiger, überparteilicher Verband, der es sich zum Ziel gemacht hat, die EU der Bevölkerung näher zu bringen und so seinen Beitrag zum Fortbestand eines geeinten Europas zu leisten. Die JEF Bamberg ist einer von zehn Kreisverbänden in Bayern.\nWir planen Veranstaltungen zu europäischen Themen, setzen uns aber auch kritisch mit der EU auseinander und organisieren Bildungsprojekte wie die Simulation des EU-Parlaments (SimEP). Dabei schlüpfen Bamberger Schülerinnen und Schüler in die Rolle von Abgeordneten und simulieren den Ablauf der politischen Entscheidungsfindung des Europäischen Parlaments.",
    website: "https://www.jef-bayern.de/bamberg/",
    email: "bamberg@jef-bayern.de",
    instagram: "https://www.instagram.com/jefbamberg/",
  },
  {
    name: "NMUN Bamberg",
    description:
      "National Model United Nations (NMUN) ist die weltweit größte Simulationskonferenz der Vereinten Nationen. Sie findet jedes Jahr mit fast 5.000 Studierenden in New York statt. Wir von NMUN Bamberg entsenden dorthin jedes Jahr eine eigene Delegation an Studierenden aus allen Fachrichtungen.\n\nWenn du auch einmal spannende Einblicke in internationale Verhandlungen gewinnen willst oder an einer UN-Simulation teilnehmen möchtest, bist du bei uns genau richtig. Hier wirst du Teil eines engagierten Teams, lernst ganz praktisch das Handwerk von echten Diplomaten*innen und kannst dein Können bei diversen Konferenzen unter Beweis stellen.",
    website: "https://www.uni-bamberg.de/nmun/",
    email: "nmun@uni-bamberg.de",
    facebook: "https://www.facebook.com/nmunbamberg",
    instagram: "https://www.instagram.com/nmunbamberg/",
  },
  {
    name: "StiPf - Studierende in Patenfamilien",
    description:
      "Das StiPf-Programm ermöglicht internationalen Studierenden an der Universität Bamberg, Familien aus Bamberg und dem Umland kennenzulernen und auf diese Weise ihre Deutschkenntnisse zu verbessern und parallel deutsche Alltagskultur zu erleben: Sie besuchen die Familien und unternehmen mit ihnen zusammen verschiedene Aktivitäten. Beispiele sind: Besuch kultureller Veranstaltungen, Ausflüge, Sport und Spiele, gemeinsame Mahlzeiten und Feiern. Für die Familien wiederum bietet das Programm internationale Kontakte und die Erweiterung des eigenen kulturellen Horizonts in persönlicher Atmosphäre.\nStiPf wird vom ehrenamtlichen Engagement zahlreicher Familien in Bamberg und Umgebung getragen, die schon über 200 Studierende aus Europa, Asien und Amerika während ihres Studienaufenthaltes in Bamberg begleitet, betreut und in ihre Familien integriert haben.",
    website:
      "https://www.uni-bamberg.de/studium/im-studium/studentisches-engagement/hochschulnahe-gruppen/",
    instagram: "http://www.instagram.com/stipf_bamberg",
  },
  {
    name: "BamBuS e.V. - Die Macher des BamBuS Dinners",
    description:
      'BamBuS e. V. ist eine unpolitische und unabhängige Studierendengruppe. 1996 als die "Bamberg Business Students" gegründet, haben wir uns seitdem zu viel mehr als "nur" Business Students entwickelt. Bei uns ist jede:r willkommen, unabhängig vom Studienfach. Unsere Mitglieder kommen aus den verschiedensten Ecken der Uni und studieren alles Mögliche - von BWL über Informatik bis hin zu Lehramt oder Psychologie.\nUnser Ziel ist es, die Studi-Zeit in Bamberg zu etwas Besonderem machen, das Uni-Leben mitgestalten. In verschiedenen Projektteams planen und veranstalten wir jedes Semester das legendäre BamBuS Dinner - ein Running Dinner, das mittlerweile genauso zu Bamberg dazugehört, wie das berühmte Bier oder die Sandkerwa.',
    website: "https://www.bambusev.de/",
    email: "bambusev.org@gmail.com",
    instagram: "https://www.instagram.com/bambus.ev/",
  },
  {
    name: "Börsen- und Kapitalmarktverein Bamberg e. V.",
    description:
      "Der Börsen- und Kapitalmarktverein Bamberg e. V. (BKB) ist ein gemeinnütziger sowie unpolitischer Verein, der von Studierenden geführt wird. Ziel unseres Vereins ist es, die Studierenden der Otto-Friedrich-Universität Bamberg mittels Workshops, Fachvorträgen, regelmäßigen Stammtischen und Exkursionen für Finanzbildung und Börse zu begeistern und ihr Finanzwissen zu erweitern. Dabei möchten wir allen Mitgliedern die Möglichkeit geben, sich gemäß ihren individuellen Interessen und Stärken zu engagieren und auszutauschen.",
    website: "https://boersenverein-bamberg.de/",
    email: "vorstand@boersenverein-bamberg.de",
    instagram: "https://www.instagram.com/boersenvereinbamberg",
  },
  {
    name: "cogita! e. V.",
    description:
      "cogita! e.V. ist eine studentische Unternehmensberatung und wurde 2005 an der Otto-Friedrich-Universität Bamberg als gemeinnütziger Verein gegründet.\nAls Studierende verschiedenster Fachrichtungen habt ihr bei uns die Möglichkeit euer theoretisches Wissen in internen und externen Projekten mit kleinen und mittelständischen Unternehmen praktisch anzuwenden.\nWeiterhin bieten wir mit unserem Dachverband JCNetwork Schulungen an, um unser Wissen kontinuierlich zu erweitern und deutschlandweites Networking zu betreiben.\nDerzeit sind wir rund 20 aktive Mitglieder aus verschiedensten Fachrichtungen.",
    website: "https://www.linkedin.com/company/cogitaev/posts/?feedView=all",
    email: "info@cogita-beratung.de",
    instagram: "https://www.instagram.com/cogita_ev/",
  },
  {
    name: "MTP - Marketing zwischen Theorie und Praxis e. V.",
    description:
      "Wir sind Deutschlands größte, unabhängige studentische Marketinginitiative und haben es uns zur Aufgabe gemacht, allen interessierten Studierenden von Universitäten und Fachhochschulen neben den theoretischen Vorlesungen einen ergänzenden, praxisnahen Einblick in die Marketingarbeit bzw. Unternehmenswelt zu ermöglichen. \nIn enger Zusammenarbeit mit Professoren, Unternehmen und unserem großen Alumninetzwerk organisieren wir regelmäßig Events und Workshops, die auf einer nahbaren Ebene die Brücke zu Unternehmensinsights und auch -kontakten herstellen.",
    website: "https://www.mtp.org/geschaeftsstelle/bamberg/",
    email: "bamberg@mtp.org",
    instagram: "https://www.instagram.com/mtpbamberg/",
  },
] as const

type SeedLocation = {
  name: string
  lat: number
  lon: number
  category: LocationCategory
  description: string
  address?: { street?: string; streetNumber?: string; city?: string; zip?: string }
}

const LOCATIONS: SeedLocation[] = [
  // University buildings
  {
    name: "U2 – An der Universität 2",
    lat: 49.893681,
    lon: 10.887644,
    category: "university",
    description: "Teilbereiche der Fakultät GuK, Teilbibliothek 1",
    address: { street: "An der Universität", streetNumber: "2", city: "Bamberg", zip: "96047" },
  },
  {
    name: "U5 – An der Universität 5",
    lat: 49.893819,
    lon: 10.887191,
    category: "university",
    description: "Teilbereiche der Fakultät GuK, Multimedia-Sprachlabor",
    address: { street: "An der Universität", streetNumber: "5", city: "Bamberg", zip: "96047" },
  },
  {
    name: "U7 – An der Universität 7",
    lat: 49.8941,
    lon: 10.887376,
    category: "university",
    description: "Hörsaal, Bibliotheksmagazin",
    address: { street: "An der Universität", streetNumber: "7", city: "Bamberg", zip: "96047" },
  },
  {
    name: "U11 – An der Universität 11",
    lat: 49.894363,
    lon: 10.887255,
    category: "university",
    description: "Teilbereiche der Fakultät GuK",
    address: { street: "An der Universität", streetNumber: "11", city: "Bamberg", zip: "96047" },
  },
  {
    name: "DO2A/AULA – Aula/Dominikanerbau",
    lat: 49.891573,
    lon: 10.885482,
    category: "university",
    description: "Aula im Dominikanerbau",
    address: { street: "Dominikanerstraße", streetNumber: "2", city: "Bamberg", zip: "96049" },
  },
  {
    name: "WE5 (ERBA) – An der Weberei 5",
    lat: 49.903097,
    lon: 10.869834,
    category: "university",
    description:
      "Fakultät WIAI, Teilbereiche der Fakultäten GuK und HuWi, ERBA-Bibliothek, Cafeteria ",
    address: { street: "An der Weberei", streetNumber: "5", city: "Bamberg", zip: "96049" },
  },
  {
    name: "F21 (Feki) – Feldkirchenstraße 21",
    lat: 49.907519,
    lon: 10.904843,
    category: "university",
    description: "Fakultät SoWi, Audimax, Mensa & Cafeteria",
    address: { street: "Feldkirchenstraße", streetNumber: "21", city: "Bamberg", zip: "96052" },
  },
  {
    name: "KR12 – Am Kranen 12",
    lat: 49.892587,
    lon: 10.886834,
    category: "university",
    description: "Teilbereiche der Fakultät GuK",
    address: { street: "Am Kranen", streetNumber: "12", city: "Bamberg", zip: "96047" },
  },
  {
    name: "Kä7 – Kärntenstraße 7",
    lat: 49.912406,
    lon: 10.900366,
    category: "university",
    description: "Teilbereiche der Fakultät SoWi",
    address: { street: "Kärntenstraße", streetNumber: "7", city: "Bamberg", zip: "96052" },
  },
  {
    name: "KS13 – Kapellenstraße 13",
    lat: 49.890484,
    lon: 10.90845,
    category: "university",
    description: "Prüfungsraum",
    address: { street: "Kapellenstraße", streetNumber: "13", city: "Bamberg", zip: "96050" },
  },
  {
    name: "LU19 – Luitpoldstraße 19",
    lat: 49.897572,
    lon: 10.894291,
    category: "university",
    description: "Seminarräume, Zentrum für Lehrerinnen- und Lehrerbildung",
    address: { street: "Luitpoldstraße", streetNumber: "19", city: "Bamberg", zip: "96050" },
  },
  {
    name: "M3 (Marcushaus) – Markusplatz 3",
    lat: 49.895733,
    lon: 10.883903,
    category: "university",
    description: "Fakultät HuWi, Teilbibliothek 2",
    address: { street: "Markusplatz", streetNumber: "3", city: "Bamberg", zip: "96047" },
  },
  {
    name: "MG1/MG2 – Markusstraße 8a",
    lat: 49.895305,
    lon: 10.882857,
    category: "university",
    description: "Teilbereiche der Fakultäten HuWi, Hörsäle, Cafeteria",
    address: { street: "Markusstraße", streetNumber: "8a", city: "Bamberg", zip: "96047" },
  },
  {
    name: "RZ (Rechenzentrum/IT-Service) – An der Universität 19, RZ-Gebäude",
    lat: 49.90792,
    lon: 10.9048,
    category: "university",
    description: "IT-Service (vormals Rechenzentrum), Serverräume, PC-Pools",
    address: { street: "Feldkirchenstraße", streetNumber: "21", city: "Bamberg", zip: "96052" },
  },
  {
    name: "GU13 – Gutenbergstraße 13",
    lat: 49.883774,
    lon: 10.927057,
    category: "university",
    description: "Teilbereiche der Fakultät WIAI",
    address: { street: "Gutenbergstraße", streetNumber: "13", city: "Bamberg", zip: "96050" },
  },

  // Mensa & Cafeteria
  {
    name: "Mensa FEKI",
    lat: 49.9067,
    lon: 10.9051,
    category: "mensa",
    description: "Mensa Feldkirchenstraße",
    address: { street: "Feldkirchenstraße", streetNumber: "21", city: "Bamberg", zip: "96052" },
  },
  {
    name: "Mensa Austraße",
    lat: 49.8935,
    lon: 10.887,
    category: "mensa",
    description: "Austraße 37, Mensa in der Innenstadt",
    address: { street: "Austraße", streetNumber: "37", city: "Bamberg", zip: "96047" },
  },
  {
    name: "Cafeteria ERBA",
    lat: 49.9033,
    lon: 10.8699,
    category: "mensa",
    description: "An der Weberei 5, Cafeteria am ERBA-Campus",
    address: { street: "An der Weberei", streetNumber: "5", city: "Bamberg", zip: "96047" },
  },
  {
    name: "Cafeteria Markusplatz",
    lat: 49.8957,
    lon: 10.8838,
    category: "mensa",
    description: "Markusplatz 3, Cafeteria in der Altstadt",
    address: { street: "Markusplatz", streetNumber: "3", city: "Bamberg", zip: "96047" },
  },

  // Libraries
  {
    name: "Teilbibliothek 3 (SOWi) / Zentralbibliothek",
    lat: 49.9067,
    lon: 10.9046,
    category: "library",
    description: "Feldkirchenstraße 21, Zentral- & Teilbibliothek 3",
    address: { street: "Feldkirchenstraße", streetNumber: "21", city: "Bamberg", zip: "96052" },
  },
  {
    name: "Teilbibliothek 1 (Theologie und Philosophie)",
    lat: 49.8943,
    lon: 10.8879,
    category: "library",
    description: "An der Universität 2",
    address: { street: "An der Universität", streetNumber: "2", city: "Bamberg", zip: "96047" },
  },
  {
    name: "Teilbibliothek 2 (Humanwissenschaften)",
    lat: 49.8957,
    lon: 10.8838,
    category: "library",
    description: "Markusplatz 3",
    address: { street: "Markusplatz", streetNumber: "3", city: "Bamberg", zip: "96047" },
  },
  {
    name: "Teilbibliothek 4 (Sprach- und Literaturwissenschaften)",
    lat: 49.8941,
    lon: 10.8864,
    category: "library",
    description: "Heumarkt 2",
    address: { street: "Heumarkt", streetNumber: "2", city: "Bamberg", zip: "96047" },
  },
  {
    name: "Teilbibliothek 5 (Geschichts- und Geowissenschaften)",
    lat: 49.8928,
    lon: 10.8861,
    category: "library",
    description: "Am Kranen 3",
    address: { street: "Am Kranen", streetNumber: "3", city: "Bamberg", zip: "96047" },
  },
  {
    name: "ERBA-Bibliothek (WIAI)",
    lat: 49.9033,
    lon: 10.8699,
    category: "library",
    description: "An der Weberei 5, ERBA-Campus",
    address: { street: "An der Weberei", streetNumber: "5", city: "Bamberg", zip: "96047" },
  },
  {
    name: "Staatsbibliothek Bamberg",
    lat: 49.8918,
    lon: 10.8823,
    category: "library",
    description: "Domplatz 8, Neue Residenz – historische Landesbibliothek",
    address: { street: "Domplatz", streetNumber: "8", city: "Bamberg", zip: "96049" },
  },

  // Sport
  {
    name: "Hochschulsport (FEKI)",
    lat: 49.9067,
    lon: 10.9046,
    category: "sport",
    description: "Feldkirchenstraße 21, Verwaltung & Sporthallen",
    address: { street: "Feldkirchenstraße", streetNumber: "21", city: "Bamberg", zip: "96052" },
  },
  {
    name: "Hochschulsportanlage Volkspark",
    lat: 49.8984,
    lon: 10.9304,
    category: "sport",
    description: "Armeestraße 47, Außensportanlagen der Universität",
    address: { street: "Armeestraße", streetNumber: "47", city: "Bamberg", zip: "96050" },
  },
  {
    name: "brose Arena",
    lat: 49.879672,
    lon: 10.920169,
    category: "sport",
    description: "Heimspielstätte der Brose Bamberg Basketball GmbH",
    address: { street: "Forchheimer Straße", streetNumber: "15", city: "Bamberg", zip: "96050" },
  },
  {
    name: "Fuchs-Park Stadion",
    lat: 49.901252,
    lon: 10.927711,
    category: "sport",
    description: "Fuchs-Park-Straße 1, Fußballstadion",
    address: { street: "Pödeldorfer Straße", streetNumber: "180", city: "Bamberg", zip: "96050" },
  },

  // Venues
  {
    name: "Schlenkerla",
    lat: 49.8917,
    lon: 10.885,
    category: "venues",
    description: "Dominikanerstraße 6, Traditionsbrauerei mit Rauchbier",
    address: { street: "Dominikanerstraße", streetNumber: "6", city: "Bamberg", zip: "96049" },
  },
  {
    name: "Brauerei Spezial",
    lat: 49.8969,
    lon: 10.8928,
    category: "venues",
    description: "Obere Königstraße 10, Brauerei & Gaststätte",
    address: { street: "Obere Königstraße", streetNumber: "10", city: "Bamberg", zip: "96052" },
  },
  {
    name: "Brauerei Fässla",
    lat: 49.8971,
    lon: 10.8928,
    category: "venues",
    description: "Obere Königstraße 19–21, Brauerei & Hotel",
    address: { street: "Obere Königstraße", streetNumber: "19", city: "Bamberg", zip: "96052" },
  },
  {
    name: "Mahrs Bräu",
    lat: 49.8899,
    lon: 10.9064,
    category: "venues",
    description: "Wunderburg 10, beliebte Brauereikneipe",
    address: { street: "Wunderburg", streetNumber: "10", city: "Bamberg", zip: "96050" },
  },
  {
    name: "Zapfhahn",
    lat: 49.8934,
    lon: 10.8821,
    category: "venues",
    description: "Untere Sandstraße 14, Bar & Restaurant",
    address: { street: "Untere Sandstraße", streetNumber: "14", city: "Bamberg", zip: "96049" },
  },
  {
    name: "Kachelofen",
    lat: 49.8917,
    lon: 10.8844,
    category: "venues",
    description: "Obere Sandstraße 1, fränkische Gaststätte",
    address: { street: "Obere Sandstraße", streetNumber: "1", city: "Bamberg", zip: "96049" },
  },
  {
    name: "Zum Sternla",
    lat: 49.8919,
    lon: 10.8914,
    category: "venues",
    description: "Lange Straße, fränkische Gaststätte",
    address: { street: "Lange Straße", city: "Bamberg", zip: "96047" },
  },
  {
    name: "Café Abseits",
    lat: 49.8998,
    lon: 10.9076,
    category: "venues",
    description: "Pödeldorfer Straße 39, Bar & Bierspezialitäten",
    address: { street: "Pödeldorfer Straße", streetNumber: "39", city: "Bamberg", zip: "96052" },
  },
  {
    name: "Live-Club Bamberg",
    lat: 49.8917,
    lon: 10.8839,
    category: "venues",
    description: "Untere Sandstraße, Club & Konzertveranstaltungen",
    address: { street: "Untere Sandstraße", city: "Bamberg", zip: "96049" },
  },
  {
    name: "Wilde Rose Keller",
    lat: 49.8843,
    lon: 10.8869,
    category: "venues",
    description: "Sternwartstraße, Bierkeller & Biergarten",
    address: { street: "Sternwartstraße", city: "Bamberg", zip: "96049" },
  },
  {
    name: "Spezial-Keller",
    lat: 49.8848,
    lon: 10.8872,
    category: "venues",
    description: "Sternwartstraße, Bierkeller auf dem Berg",
    address: { street: "Sternwartstraße", city: "Bamberg", zip: "96049" },
  },

  // Other
  {
    name: "Bahnhof Bamberg",
    lat: 49.9006,
    lon: 10.8997,
    category: "other",
    description: "Ludwigstraße, Zug, Regionalbahn & Fernbus",
    address: { street: "Ludwigstraße", city: "Bamberg", zip: "96052" },
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
    address: { street: "Buger Straße", streetNumber: "80", city: "Bamberg", zip: "96049" },
  },
  {
    name: "Agentur für Arbeit Bamberg",
    lat: 49.8973,
    lon: 10.9087,
    category: "other",
    description: "Ludwigstraße, Jobcenter & Berufsberatung",
    address: { street: "Ludwigstraße", city: "Bamberg", zip: "96052" },
  },
  {
    name: "SWerk Würzburg – Außenstelle Bamberg",
    lat: 49.8935,
    lon: 10.887,
    category: "other",
    description: "Austraße 37, BAföG, Sozialberatung & Wohnheime",
    address: { street: "Austraße", streetNumber: "37", city: "Bamberg", zip: "96047" },
  },
]

type SeedEvent = {
  title: string
  description: string
  organizer: string
  start: Date
  end: Date
  externalId: string
  category: EventCategory
  mapLocationName?: string
  customLocation?: { name: string; address?: string; city?: string }
  /** Owned by SEED_USER — gives /account/events a non-empty listing in e2e tests. */
  ownedBySeedUser?: boolean
}

function offsetFromNow(days: number, hours: number, minutes = 0): Date {
  return new Date(Date.now() + ((days * 24 + hours) * 60 + minutes) * 60 * 1000)
}

const EVENTS: SeedEvent[] = [
  {
    title: "Filmvorführung im Kino",
    description:
      "Gemeinsamer Kinoabend mit einem aktuellen Film. Eintritt für Studierende ermäßigt.",
    organizer: "Kino Bamberg",
    start: offsetFromNow(1, 20),
    end: offsetFromNow(1, 22),
    externalId: "filmvorfuehrung-im-kino",
    category: "culture",
    customLocation: { name: "Kino Bamberg", address: "Hautpwachstraße 6", city: "Bamberg" },
  },
  {
    title: "Stadtführung durch Bamberg",
    description:
      "Entdecke die Altstadt Bambergs mit einer geführten Tour durch die UNESCO-Welterbestätten.",
    organizer: "Tourist-Information Bamberg",
    start: offsetFromNow(2, 14),
    end: offsetFromNow(2, 16),
    externalId: "stadtfuehrung-durch-bamberg",
    category: "other",
    customLocation: { name: "Altes Rathaus", address: "Obere Brücke 1", city: "Bamberg" },
  },
  {
    title: "Besuch des Bamberger Doms",
    description:
      "Geführte Besichtigung des Bamberger Doms mit Erklärungen zur Geschichte und Architektur.",
    organizer: "Bistum Bamberg",
    start: offsetFromNow(3, 16),
    end: offsetFromNow(3, 18),
    externalId: "besuch-des-bamberger-doms",
    category: "other",
    customLocation: { name: "Bamberger Dom", address: "Domplatz 5", city: "Bamberg" },
  },
  {
    title: "Hochschulsport: Volleyball",
    description:
      "Offenes Volleyballtraining für alle Studierenden. Vorkenntnisse nicht erforderlich.",
    organizer: "Hochschulsport Bamberg",
    start: offsetFromNow(1, 18),
    end: offsetFromNow(1, 20),
    externalId: "hochschulsport-volleyball",
    category: "sport",
    mapLocationName: "Hochschulsport (FEKI)",
    ownedBySeedUser: true,
  },
  {
    title: "Hochschulsport: Yoga für Anfänger",
    description: "Entspannter Yoga-Kurs für Einsteiger. Matte bitte selbst mitbringen.",
    organizer: "Hochschulsport Bamberg",
    start: offsetFromNow(4, 9),
    end: offsetFromNow(4, 10, 30),
    externalId: "hochschulsport-yoga",
    category: "sport",
    mapLocationName: "Hochschulsport (FEKI)",
  },
  {
    title: "Livekonzert: Indie Night",
    description:
      "Lokale Indie-Bands spielen live. Eintritt frei für alle Studierenden mit Ausweis.",
    organizer: "Live-Club Bamberg",
    start: offsetFromNow(1, 21),
    end: offsetFromNow(1, 24),
    externalId: "live-club-konzert",
    category: "culture",
    mapLocationName: "Live-Club Bamberg",
  },
  {
    title: "Gastvortrag: KI im Alltag",
    description:
      "Renommierte Forscherin hält einen Vortrag über den Einfluss von Künstlicher Intelligenz auf unseren Alltag.",
    organizer: "Universität Bamberg",
    start: offsetFromNow(5, 18),
    end: offsetFromNow(5, 20),
    externalId: "uni-vortrag-ki",
    category: "university",
    mapLocationName: "WE5 (ERBA) – An der Weberei 5",
  },
  {
    title: "Ersti-Party",
    description:
      "Die große Willkommensparty für alle Erstsemester. Lernt euch kennen und feiert den Start ins Studium!",
    organizer: "Studierendenvertretung Uni Bamberg",
    start: offsetFromNow(7, 20),
    end: offsetFromNow(8, 2),
    externalId: "uni-ersti-party",
    category: "party",
    mapLocationName: "DO2A/AULA – Aula/Dominikanerbau",
  },
  {
    title: "Bibliotheksführung für Erstsemester",
    description:
      "Lernt die Universitätsbibliothek kennen: Ausleihe, Datenbanken, Lernräume und mehr.",
    organizer: "Universitätsbibliothek Bamberg",
    start: offsetFromNow(3, 11),
    end: offsetFromNow(3, 12),
    externalId: "bibliothek-fuehrung",
    category: "university",
    mapLocationName: "Teilbibliothek 3 (SOWi) / Zentralbibliothek",
  },
  {
    title: "Offene Sozialberatung",
    description:
      "Kostenlose Beratung zu BAföG, Wohnen, Finanzen und sozialen Fragen für Studierende.",
    organizer: "Studentenwerk Bamberg",
    start: offsetFromNow(1, 10),
    end: offsetFromNow(1, 12),
    externalId: "studentenwerk-beratung",
    category: "social",
    mapLocationName: "SWerk Würzburg – Außenstelle Bamberg",
  },
]

type SeedJobOffer = {
  title: string
  company: string
  location: string
  description: string
  workingHours: number
  jobType: JobType
  field: JobField
  workMode: WorkMode
  onlineStatus?: JobOnlineStatus
  externalUrl?: string
  contactName?: string
  contactMail?: string
  contactPhone?: string
  /** Owned by SEED_USER — gives /account/jobs a non-empty listing in e2e tests. */
  ownedBySeedUser?: boolean
}

const JOB_OFFERS: SeedJobOffer[] = [
  {
    title: "Werkstudent:in Softwareentwicklung",
    company: "Feki.de e. V.",
    location: "Bamberg",
    description:
      "Zur Unterstützung unseres Website-Teams suchen wir eine:n Werkstudent:in, die/der uns bei der Weiterentwicklung unserer Jobbörse und unseres Eventkalenders hilft. Kenntnisse in JavaScript/TypeScript sind von Vorteil.",
    workingHours: 10,
    jobType: "working_student",
    field: "it",
    workMode: "hybrid",
    contactName: "Feki.de Team",
    contactMail: "jobs@feki.de",
  },
  {
    title: "Praktikum Marketing & Social Media",
    company: "BamBuS e. V.",
    location: "Bamberg",
    description:
      "Du unterstützt uns bei der Planung und Umsetzung unserer Social-Media-Kampagnen rund um das BamBuS Dinner und weitere Events. Erfahrung mit Instagram und Canva wünschenswert.",
    workingHours: 15,
    jobType: "internship",
    field: "marketing",
    workMode: "on_site",
    contactName: "BamBuS Marketingteam",
    contactMail: "bambusev.org@gmail.com",
    ownedBySeedUser: true,
  },
  {
    title: "Aushilfe Service & Küche",
    company: "Schlenkerla",
    location: "Dominikanerstraße 6, Bamberg",
    description:
      "Wir suchen ab sofort Unterstützung im Service und in der Küche für Wochenendschichten. Erfahrung in der Gastronomie ist von Vorteil, aber keine Voraussetzung.",
    workingHours: 12,
    jobType: "part_time",
    field: "gastronomy",
    workMode: "on_site",
    contactName: "Schlenkerla Personalbüro",
    contactPhone: "0951 56060",
  },
  {
    title: "Hilfskraft am Lehrstuhl für Wirtschaftsinformatik",
    company: "Universität Bamberg",
    location: "An der Weberei 5, Bamberg",
    description:
      "Am Lehrstuhl für Wirtschaftsinformatik ist ab sofort eine Stelle als studentische Hilfskraft zu besetzen. Aufgaben umfassen die Unterstützung bei Lehrveranstaltungen und Literaturrecherche.",
    workingHours: 8,
    jobType: "research_assistant",
    field: "research",
    workMode: "on_site",
    contactName: "Lehrstuhlsekretariat",
    contactMail: "sekretariat.wi@uni-bamberg.de",
  },
  {
    title: "Remote Junior Consultant (m/w/d)",
    company: "cogita! e. V.",
    location: "Bamberg",
    description:
      "Im Rahmen unserer studentischen Beratungsprojekte suchen wir engagierte Studierende, die bei der Analyse und Umsetzung von Projekten für kleine und mittelständische Unternehmen mitwirken möchten.",
    workingHours: 6,
    jobType: "volunteer",
    field: "administration",
    workMode: "remote",
    externalUrl: "https://www.linkedin.com/company/cogitaev/posts/?feedView=all",
    contactName: "cogita! Vorstand",
    contactMail: "info@cogita-beratung.de",
  },
  {
    title: "Bachelor-/Masterarbeit im Bereich Data Science",
    company: "Universität Bamberg",
    location: "Feldkirchenstraße 21, Bamberg",
    description:
      "Für eine Abschlussarbeit im Bereich Data Science / Machine Learning bieten wir Betreuung und Zugang zu realen Datensätzen. Interesse an Statistik und Python wird vorausgesetzt.",
    workingHours: 0,
    jobType: "thesis",
    field: "research",
    workMode: "on_site",
    onlineStatus: "submitted",
    contactName: "Prof. Dr. Beispiel",
    contactMail: "abschlussarbeiten@uni-bamberg.de",
  },
  {
    title: "Nachhilfelehrer:in gesucht (Vergangene Stelle)",
    company: "Nachhilfeinstitut Bamberg",
    location: "Bamberg",
    description:
      "Diese Stelle ist bereits besetzt und dient nur als Beispiel für archivierte Stellenanzeigen.",
    workingHours: 5,
    jobType: "part_time",
    field: "education",
    workMode: "on_site",
    onlineStatus: "archived",
    contactName: "Institutsleitung",
  },
]

async function main() {
  let seedUser = await prisma.user.findUnique({ where: { email: SEED_USER.email } })
  if (!seedUser) {
    const result = await auth.api.signUpEmail({
      body: { email: SEED_USER.email, password: SEED_USER.password, name: SEED_USER.email },
    })
    seedUser = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id } })
  }

  const existingCleanUser = await prisma.user.findUnique({ where: { email: CLEAN_USER.email } })
  if (!existingCleanUser) {
    await auth.api.signUpEmail({
      body: { email: CLEAN_USER.email, password: CLEAN_USER.password, name: CLEAN_USER.email },
    })
  }

  const existingAdminUser = await prisma.user.findUnique({ where: { email: ADMIN_USER.email } })
  if (!existingAdminUser) {
    await auth.api.signUpEmail({
      body: { email: ADMIN_USER.email, password: ADMIN_USER.password, name: ADMIN_USER.email },
    })
  }

  // Seed users are pre-verified — e2e tests exercise job/event submission,
  // not the email-verification flow itself, which is covered separately.
  await prisma.user.updateMany({
    where: {
      email: { in: [SEED_USER.email, CLEAN_USER.email, ADMIN_USER.email] },
      emailVerified: false,
    },
    data: { emailVerified: true },
  })

  // Bootstrap the first admin — a real deployment grants this via a one-off DB update.
  await prisma.user.updateMany({
    where: { email: ADMIN_USER.email, role: null },
    data: { role: "admin" },
  })

  await Promise.all(
    STUDENT_GROUPS.map((group) => {
      const slug = slugify(group.name)
      return prisma.studentGroup.upsert({
        where: { slug },
        create: { ...group, slug },
        update: { ...group, slug },
      })
    })
  )

  const locations = await Promise.all(
    LOCATIONS.map((location) => {
      const { address, ...rest } = location
      const slug = slugify(location.name)
      const data = {
        ...rest,
        slug,
        addressStreet: address?.street,
        addressStreetNumber: address?.streetNumber,
        addressCity: address?.city,
        addressZip: address?.zip,
      }
      return prisma.location.upsert({
        where: { slug },
        create: data,
        update: data,
      })
    })
  )

  const locationIdByName = new Map(locations.map((location) => [location.name, location.id]))

  await Promise.all(
    EVENTS.map((event) => {
      const { mapLocationName, customLocation, ownedBySeedUser, ...rest } = event
      const slug = slugify(event.title)
      const data = {
        ...rest,
        slug,
        mapLocationId: mapLocationName ? locationIdByName.get(mapLocationName) : undefined,
        customLocationName: customLocation?.name,
        customLocationAddress: customLocation?.address,
        customLocationCity: customLocation?.city,
        ownerId: ownedBySeedUser ? seedUser.id : null,
      }
      return prisma.event.upsert({
        where: { externalId: event.externalId },
        create: data,
        update: data,
      })
    })
  )

  await Promise.all(
    JOB_OFFERS.map((job) => {
      const { onlineStatus, ownedBySeedUser, ...rest } = job
      const slug = slugify(`${job.title} ${job.company}`)
      const data = {
        ...rest,
        slug,
        onlineStatus: onlineStatus ?? "published",
        ownerId: ownedBySeedUser ? seedUser.id : null,
        offlineAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
      return prisma.jobOffer.upsert({
        where: { slug },
        create: data,
        update: data,
      })
    })
  )
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
