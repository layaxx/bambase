import prisma from "../prisma"
import type { StudentGroupModel } from "@/generated/prisma/models"

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

function toStudentGroup(row: StudentGroupModel): StudentGroup {
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

export async function fetchStudentGroups(limit = 200): Promise<StudentGroup[]> {
  const groups = await prisma.studentGroup.findMany({
    orderBy: { name: "asc" },
    take: limit,
  })
  return groups.map(toStudentGroup)
}

export async function fetchStudentGroupForAdmin(slug: string): Promise<StudentGroup | null> {
  const row = await prisma.studentGroup.findFirst({ where: { slug } })
  return row && toStudentGroup(row)
}

export async function fetchAllStudentGroupsForAdmin(limit = 500): Promise<StudentGroup[]> {
  const rows = await prisma.studentGroup.findMany({
    orderBy: { name: "asc" },
    take: limit,
  })
  return rows.map(toStudentGroup)
}
