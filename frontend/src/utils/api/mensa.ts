import type { Dayjs } from "dayjs"
import type { ApiResult } from "./types"
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
  priceStudents: number
  date: Date
  location: string
  isVegan: boolean
  isVegetarian: boolean
  allergens: string[]
}): MensaMeal {
  return {
    id: row.id,
    name: row.name,
    priceStudents: row.priceStudents,
    date: row.date.toISOString().slice(0, 10),
    location: row.location as MensaMeal["location"],
    isVegan: row.isVegan,
    isVegetarian: row.isVegetarian,
    allergens: row.allergens,
  }
}

export async function fetchMensaMeals(date: Dayjs): Promise<ApiResult<MensaMeal[]>> {
  try {
    const meals = await prisma.mensaMeal.findMany({ where: { date: toDateOnly(date) } })
    return { data: meals.map(toMensaMeal), apiDown: false }
  } catch (error) {
    console.error("Error fetching Mensa meals", error)
    return { data: [], apiDown: true }
  }
}

export async function fetchMensaMealsRange(dates: Dayjs[]): Promise<ApiResult<MensaMeal[]>> {
  if (dates.length === 0) return { data: [], apiDown: false }
  try {
    const meals = await prisma.mensaMeal.findMany({
      where: { date: { in: dates.map(toDateOnly) } },
    })
    return { data: meals.map(toMensaMeal), apiDown: false }
  } catch (error) {
    console.error("Error fetching Mensa meals", error)
    return { data: [], apiDown: true }
  }
}
