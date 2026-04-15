import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { client } from "@/utils/api"

export const reports = {
  submit: defineAction({
    accept: "form",
    input: z.object({
      target_type: z.enum(["event", "job"]),
      target_id: z.string().min(1),
      reason: z.enum(["spam", "inappropriate", "outdated", "other"]),
      details: z.string().optional(),
    }),
    handler: async ({ target_type, target_id, reason, details }) => {
      const target = target_type === "event" ? { event: target_id } : { job_offer: target_id }

      try {
        await client.collection("reports").create({
          reason,
          details: details || undefined,
          ...target,
        })
      } catch {
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Meldung fehlgeschlagen." })
      }

      return { success: true }
    },
  }),
}
