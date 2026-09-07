import prisma from "../prisma"
import { withCache } from "./cache"
import { apiResult, type ApiResult } from "./types"

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

export function fetchStudentGroups(limit = 200): Promise<ApiResult<StudentGroup[]>> {
  return apiResult("Error fetching student groups", [], async () => {
    const groups = await withCache(`student-groups:${limit}`, () =>
      prisma.studentGroup.findMany({
        orderBy: { name: "asc" },
        take: limit,
      })
    )
    return groups.map(toStudentGroup)
  })
}

export function fetchStudentGroupForAdmin(slug: string): Promise<ApiResult<StudentGroup | null>> {
  return apiResult("Error fetching student group for admin", null, async () => {
    const row = await prisma.studentGroup.findFirst({ where: { slug } })
    return row && toStudentGroup(row)
  })
}

/** Fetch all student groups for the admin overview. */
export function fetchAllStudentGroupsForAdmin(limit = 500): Promise<ApiResult<StudentGroup[]>> {
  return apiResult("Error fetching student groups for admin", [], async () => {
    const rows = await prisma.studentGroup.findMany({
      orderBy: { name: "asc" },
      take: limit,
    })
    return rows.map(toStudentGroup)
  })
}
