import { client, withTimeout } from "./client"
import type { ApiResult } from "./types"

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

export async function fetchStudentGroups(limit = 200): Promise<ApiResult<StudentGroup[]>> {
  try {
    const result = await withTimeout(
      client.collection("student-groups").find({
        sort: ["name:asc"],
        pagination: { limit },
      })
    )
    return { data: (result.data ?? []) as unknown as StudentGroup[], apiDown: false }
  } catch (error) {
    console.error("Error fetching student groups", error)
    return { data: [], apiDown: true }
  }
}
