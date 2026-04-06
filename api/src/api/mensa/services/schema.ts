import { z } from "zod"

export const SWCanteenMenuFoodSchema = z.object({
  name: z.string(),
  price: z.number(),
  price_servant: z.number(),
  price_guest: z.number(),
  food: z.number().nullable(),
  food_type: z.array(z.string()).nullable(),
  additives: z.array(z.string()).nullable(),
})

export const SWCanteenMenuDaySchema = z.object({
  day: z.string(),
  menu_entries: z.array(SWCanteenMenuFoodSchema).nullish(),
  empty_notices: z.array(z.object({ message: z.string() })).nullable(),
})

export const SWCanteenMenuWeekSchema = z.object({
  year: z.number(),
  week_number: z.number(),
  menu_per_day: z.record(z.string(), SWCanteenMenuDaySchema).optional(),
})

export const SWCanteenMenuResponseSchema = z.object({
  menu: z.array(SWCanteenMenuWeekSchema),
  additives: z.array(
    z.object({
      identifier: z.string(),
      name: z.string(),
      label: z.string(),
    })
  ),
})
