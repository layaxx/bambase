import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { ReportReason } from "@/generated/prisma/enums"
import { canModerateReport } from "@/utils/authz"
import { requireUserId } from "@/utils/action-guards"
import prisma from "@/utils/prisma"
import { getLogger } from "@/utils/logger"

function targetTypeOf(report: {
  eventId: string | null
  jobOfferId: string | null
}): "event" | "job" | undefined {
  if (report.eventId) return "event"
  if (report.jobOfferId) return "job"
  return undefined
}

async function requireReportModerator(
  context: Parameters<typeof requireUserId>[0],
  targetType: "event" | "job" | undefined,
  message: string
): Promise<void> {
  if (!(await canModerateReport(context.locals.user?.role, targetType))) {
    getLogger().warn(
      { role: context.locals.user?.role, targetType },
      "action denied, missing permission"
    )
    throw new ActionError({ code: "FORBIDDEN", message })
  }
}

export const reports = {
  submit: defineAction({
    accept: "form",
    input: z.object({
      target_type: z.enum(["event", "job"]),
      target_id: z.string().min(1),
      reason: z.enum(ReportReason),
      details: z.string().optional(),
    }),
    handler: async ({ target_type, target_id, reason, details }) => {
      try {
        await prisma.report.create({
          data: {
            reason,
            details: details || undefined,
            eventId: target_type === "event" ? target_id : undefined,
            jobOfferId: target_type === "job" ? target_id : undefined,
          },
        })
      } catch (error) {
        getLogger().error(
          { err: error, targetType: target_type, targetId: target_id },
          "report create failed"
        )
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Meldung fehlgeschlagen." })
      }

      getLogger().info({ targetType: target_type, targetId: target_id, reason }, "report submitted")
      return { success: true }
    },
  }),

  dismiss: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1) }),
    handler: async ({ id }, context) => {
      requireUserId(context)

      const report = await prisma.report.findUnique({
        where: { id },
        select: { eventId: true, jobOfferId: true },
      })
      if (!report) throw new ActionError({ code: "NOT_FOUND", message: "Meldung nicht gefunden." })
      await requireReportModerator(context, targetTypeOf(report), "Verwerfen fehlgeschlagen.")

      try {
        await prisma.report.update({ where: { id }, data: { reviewStatus: "dismissed" } })
      } catch (error) {
        getLogger().error({ err: error, reportId: id }, "report dismiss failed")
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Verwerfen fehlgeschlagen.",
        })
      }

      getLogger().info({ reportId: id }, "report dismissed")

      return {}
    },
  }),

  reopen: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1) }),
    handler: async ({ id }, context) => {
      requireUserId(context)

      const report = await prisma.report.findUnique({
        where: { id },
        select: { eventId: true, jobOfferId: true },
      })
      if (!report) throw new ActionError({ code: "NOT_FOUND", message: "Meldung nicht gefunden." })
      await requireReportModerator(context, targetTypeOf(report), "Wiedereröffnen fehlgeschlagen.")

      try {
        await prisma.report.update({ where: { id }, data: { reviewStatus: "open" } })
      } catch (error) {
        getLogger().error({ err: error, reportId: id }, "report reopen failed")
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Wiedereröffnen fehlgeschlagen.",
        })
      }

      getLogger().info({ reportId: id }, "report reopened")

      return {}
    },
  }),

  dismissGroup: defineAction({
    accept: "form",
    input: z.object({
      target_type: z.enum(["event", "job"]),
      target_id: z.string().min(1),
    }),
    handler: async ({ target_type, target_id }, context) => {
      requireUserId(context)
      await requireReportModerator(context, target_type, "Verwerfen fehlgeschlagen.")

      let count: number
      try {
        const result = await prisma.report.updateMany({
          where: {
            reviewStatus: "open",
            eventId: target_type === "event" ? target_id : undefined,
            jobOfferId: target_type === "job" ? target_id : undefined,
          },
          data: { reviewStatus: "dismissed" },
        })
        count = result.count
      } catch (error) {
        getLogger().error(
          { err: error, targetType: target_type, targetId: target_id },
          "report group dismiss failed"
        )
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Verwerfen fehlgeschlagen.",
        })
      }

      getLogger().info(
        { targetType: target_type, targetId: target_id, count },
        "report group dismissed"
      )

      return {}
    },
  }),

  reopenGroup: defineAction({
    accept: "form",
    input: z.object({
      target_type: z.enum(["event", "job"]),
      target_id: z.string().min(1),
    }),
    handler: async ({ target_type, target_id }, context) => {
      requireUserId(context)
      await requireReportModerator(context, target_type, "Wiedereröffnen fehlgeschlagen.")

      let count: number
      try {
        const result = await prisma.report.updateMany({
          where: {
            reviewStatus: "dismissed",
            eventId: target_type === "event" ? target_id : undefined,
            jobOfferId: target_type === "job" ? target_id : undefined,
          },
          data: { reviewStatus: "open" },
        })
        count = result.count
      } catch (error) {
        getLogger().error(
          { err: error, targetType: target_type, targetId: target_id },
          "report group reopen failed"
        )
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Wiedereröffnen fehlgeschlagen.",
        })
      }

      getLogger().info(
        { targetType: target_type, targetId: target_id, count },
        "report group reopened"
      )

      return {}
    },
  }),
}
