import prisma from "../prisma"
import { withCache } from "./cache"
import type { ApiResult } from "./types"

export type StudentGroup = {
  id: string
  slug: string
  name: string
  description: string
  website?: string
  email?: string
  facebook?: string
  instagram?: string
}

function toStudentGroup(row: {
  id: string
  slug: string
  name: string
  description: string
  website: string | null
  email: string | null
  facebook: string | null
  instagram: string | null
}): StudentGroup {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    website: row.website ?? undefined,
    email: row.email ?? undefined,
    facebook: row.facebook ?? undefined,
    instagram: row.instagram ?? undefined,
  }
}

export async function fetchStudentGroups(limit = 200): Promise<ApiResult<StudentGroup[]>> {
  const key = `student-groups:${limit}`
  try {
    const groups = await withCache(key, () =>
      prisma.studentGroup.findMany({
        orderBy: { name: "asc" },
        take: limit,
      })
    )
    return { data: groups.map(toStudentGroup), apiDown: false }
  } catch (error) {
    console.error("Error fetching student groups", error)
    return { data: [], apiDown: true }
  }
}
