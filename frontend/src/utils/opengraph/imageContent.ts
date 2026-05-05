import type { Event, JobOffer } from "../api"
import { useTranslations } from "@/i18n/translations"

const t = useTranslations("de")

function makeLabelSpan(children: string): object {
  return {
    type: "span",
    props: { style: { fontSize: 26, color: "#64748b" }, children },
  }
}

function makeBadgeSpan(label: string, color: string): object {
  return {
    type: "span",
    props: {
      style: {
        display: "flex",
        fontSize: 20,
        fontWeight: 600,
        backgroundColor: "#1e293b",
        color,
        borderRadius: 6,
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 14,
        paddingRight: 14,
      },
      children: label,
    },
  }
}

export const makeImageContent = ({
  titleContent,
  subtitleItems,
  category,
}: {
  titleContent: string
  subtitleItems: object[]
  category: string
}) => {
  const title = titleContent.length > 60 ? `${titleContent.slice(0, 57)}…` : titleContent
  const titleSize = title.length > 45 ? 50 : 60

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundImage: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        paddingTop: 52,
        paddingBottom: 52,
        paddingLeft: 72,
        paddingRight: 72,
        fontFamily: "Inter",
        borderTop: "8px solid #1447e6",
      },
      children: [
        {
          type: "span",
          props: {
            style: { fontSize: 50, fontWeight: 700, color: "#475569" },
            children: `BamBase - ${category}`,
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              gap: 24,
              marginTop: 70,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    fontSize: titleSize,
                    fontWeight: 700,
                    color: "#f1f5f9",
                    lineHeight: 1.2,
                  },
                  children: title,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                  },
                  children: subtitleItems,
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              color: "#64748b",
            },
            children: [
              {
                type: "span",
                props: {
                  style: { fontSize: 28 },
                  children: "BamBase - Das Studierendenportal für Bamberg",
                },
              },
              {
                type: "span",
                props: { style: { fontSize: 28 }, children: "bambase.de" },
              },
            ],
          },
        },
      ],
    },
  }
}

export const makeJobOfferSubtitleItems = (
  jobOffer: Pick<JobOffer, "job_type" | "company">
): object[] => {
  const jobTypeLabel = jobOffer.job_type ? t.jobs.jobTypes[jobOffer.job_type] : null

  const items: object[] = [makeLabelSpan(jobOffer.company)]

  if (jobTypeLabel) {
    items.push(makeBadgeSpan(jobTypeLabel, "#86efac"))
  }

  return items
}

export const makeEventSubtitleItems = (event: Pick<Event, "category" | "start">): object[] => {
  const date = new Date(event.start).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const items: object[] = [makeLabelSpan(date)]

  const categoryLabel = event.category ? t.events.categories[event.category] : null
  if (categoryLabel) {
    items.push(makeBadgeSpan(categoryLabel, "#7dd3fc"))
  }

  return items
}
