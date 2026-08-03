import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { ReportReason } from "@/generated/prisma/enums"
import prisma from "@/utils/prisma"

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
      } catch {
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Meldung fehlgeschlagen." })
      }

      return { success: true }
    },
  }),
}
