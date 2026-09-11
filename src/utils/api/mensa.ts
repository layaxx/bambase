import type { Dayjs } from "dayjs"
import { apiResult, type ApiResult } from "./types"
import type { Prisma } from "@/generated/prisma/client"
import prisma from "../prisma"

export type MensaMeal = {
  name: string
  priceStudents: number
  date: string
  location: "Feki" | "Austraße" | "Erba"
  isVegan: boolean
  isVegetarian: boolean
  allergens?: string[]
  id: string
}

function toDateOnly(date: Dayjs): Date {
  return new Date(`${date.format("YYYY-MM-DD")}T00:00:00.000Z`)
}

function toMensaMeal(row: {
  id: string
  name: string
  priceStudents: Prisma.Decimal
  date: Date
  location: string
  isVegan: boolean
  isVegetarian: boolean
  allergens: string[]
}): MensaMeal {
  return {
    id: row.id,
    name: row.name,
    priceStudents: row.priceStudents.toNumber(),
    date: row.date.toISOString().slice(0, 10),
    location: row.location as MensaMeal["location"],
    isVegan: row.isVegan,
    isVegetarian: row.isVegetarian,
    allergens: row.allergens,
  }
}

export function fetchMensaMeals(date: Dayjs): Promise<ApiResult<MensaMeal[]>> {
  return apiResult("Error fetching Mensa meals", [], async () => {
    const meals = await prisma.mensaMeal.findMany({ where: { date: toDateOnly(date) } })
    return meals.map(toMensaMeal)
  })
}

export function fetchMensaMealsRange(dates: Dayjs[]): Promise<ApiResult<MensaMeal[]>> {
  return apiResult("Error fetching Mensa meals", [], async () => {
    if (dates.length === 0) return []
    const meals = await prisma.mensaMeal.findMany({
      where: { date: { in: dates.map(toDateOnly) } },
    })
    return meals.map(toMensaMeal)
  })
}
