import { client } from "./client"

export type StudentGroup = {
  documentId: string
  slug: string
  name: string
  description: string
  website?: string
  email?: string
  facebook?: string
  instagram?: string
}

export async function fetchStudentGroups(limit = 200): Promise<StudentGroup[]> {
  try {
    const result = await client.collection("student-groups").find({
      sort: ["name:asc"],
      pagination: { limit },
    })
    return (result.data ?? []) as unknown as StudentGroup[]
  } catch (error) {
    console.error("Error fetching student groups", error)
    return []
  }
}
