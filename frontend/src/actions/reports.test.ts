import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCreate = vi.hoisted(() => vi.fn())

vi.mock("astro:actions", () => ({
  defineAction: ({ handler }: never) => handler,
  ActionError: class extends Error {
    code: string
    constructor({ code, message }: { code: string; message: string }) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock("astro/zod", async () => await import("zod"))

const mockUpdate = vi.hoisted(() => vi.fn())
const mockUpdateMany = vi.hoisted(() => vi.fn())
const mockFindUnique = vi.hoisted(() => vi.fn())

vi.mock("@/utils/prisma", () => ({
  default: {
    report: {
      create: mockCreate,
      update: mockUpdate,
      updateMany: mockUpdateMany,
      findUnique: mockFindUnique,
    },
  },
}))

const mockCanModerateReport = vi.hoisted(() => vi.fn())

vi.mock("@/utils/authz", () => ({
  canModerateReport: mockCanModerateReport,
}))

import { reports } from "./reports"

function makeContext(userId?: string, role: string | null = null) {
  return { locals: { user: userId ? { id: userId, role } : null } }
}

describe("reports.submit", () => {
  beforeEach(() => mockCreate.mockClear())

  it("passes target_id as eventId when target_type is 'event'", async () => {
    mockCreate.mockResolvedValue({})

    await reports.submit({
      // @ts-expect-error - needed because of mocked defineAction
      target_type: "event",
      target_id: "event-1",
      reason: "spam",
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventId: "event-1" }) })
    )
  })

  it("passes target_id as jobOfferId when target_type is 'job'", async () => {
    mockCreate.mockResolvedValue({})

    await reports.submit({
      // @ts-expect-error - needed because of mocked defineAction
      target_type: "job",
      target_id: "job-456",
      reason: "inappropriate",
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ jobOfferId: "job-456" }) })
    )
  })

  it("does NOT include eventId when target_type is 'job'", async () => {
    mockCreate.mockResolvedValue({})

    await reports.submit({
      // @ts-expect-error - needed because of mocked defineAction
      target_type: "job",
      target_id: "job-456",
      reason: "spam",
    })

    const data = mockCreate.mock.calls[0][0].data
    expect(data.eventId).toBeUndefined()
  })

  it("includes reason in the create payload", async () => {
    mockCreate.mockResolvedValue({})

    await reports.submit({
      // @ts-expect-error - needed because of mocked defineAction
      target_type: "event",
      target_id: "ev-1",
      reason: "outdated",
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reason: "outdated" }) })
    )
  })

  it("passes details when provided", async () => {
    mockCreate.mockResolvedValue({})

    await reports.submit({
      // @ts-expect-error - needed because of mocked defineAction
      target_type: "job",
      target_id: "job-1",
      reason: "other",
      details: "Suspicious content",
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ details: "Suspicious content" }) })
    )
  })

  it("omits details when not provided", async () => {
    mockCreate.mockResolvedValue({})

    await reports.submit({
      // @ts-expect-error - needed because of mocked defineAction
      target_type: "event",
      target_id: "ev-1",
      reason: "spam",
    })

    const data = mockCreate.mock.calls[0][0].data
    expect(data.details).toBeUndefined()
  })

  it("returns { success: true } on success", async () => {
    mockCreate.mockResolvedValue({})

    const result = await reports.submit({
      // @ts-expect-error - needed because of mocked defineAction
      target_type: "event",
      target_id: "ev-1",
      reason: "spam",
    })

    expect(result).toEqual({ success: true })
  })

  it("throws ActionError with INTERNAL_SERVER_ERROR when the create fails", async () => {
    mockCreate.mockRejectedValueOnce(new Error("DB error"))

    await expect(
      reports.submit({
        // @ts-expect-error - needed because of mocked defineAction
        target_type: "event",
        target_id: "ev-1",
        reason: "spam",
      })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})

describe("reports.dismiss", () => {
  beforeEach(() => {
    mockUpdate.mockClear()
    mockFindUnique.mockReset()
    mockCanModerateReport.mockClear()
  })

  it("throws UNAUTHORIZED when not signed in", async () => {
    await expect(
      // @ts-expect-error - needed because of mocked defineAction
      reports.dismiss({ id: "report-1" }, makeContext())
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
    expect(mockFindUnique).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("throws NOT_FOUND when the report doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      // @ts-expect-error - needed because of mocked defineAction
      reports.dismiss({ id: "report-1" }, makeContext("user-1"))
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("throws FORBIDDEN when the caller can't moderate the report's target type", async () => {
    mockFindUnique.mockResolvedValue({ eventId: "event-1", jobOfferId: null })
    mockCanModerateReport.mockResolvedValue(false)

    await expect(
      // @ts-expect-error - needed because of mocked defineAction
      reports.dismiss({ id: "report-1" }, makeContext("user-1"))
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(mockCanModerateReport).toHaveBeenCalledWith(null, "event")
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("sets reviewStatus to dismissed for an event moderator on an event report", async () => {
    mockFindUnique.mockResolvedValue({ eventId: "event-1", jobOfferId: null })
    mockCanModerateReport.mockResolvedValue(true)
    mockUpdate.mockResolvedValue({})

    const result = await reports.dismiss(
      { id: "report-1" },
      // @ts-expect-error - needed because of mocked defineAction
      makeContext("mod-1", "eventModerator")
    )

    expect(mockCanModerateReport).toHaveBeenCalledWith("eventModerator", "event")
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "report-1" },
      data: { reviewStatus: "dismissed" },
    })
    expect(result).toEqual({})
  })

  it("checks the job permission for a job report", async () => {
    mockFindUnique.mockResolvedValue({ eventId: null, jobOfferId: "job-1" })
    mockCanModerateReport.mockResolvedValue(true)
    mockUpdate.mockResolvedValue({})

    await reports.dismiss(
      { id: "report-1" },
      // @ts-expect-error - needed because of mocked defineAction
      makeContext("mod-1", "jobModerator")
    )

    expect(mockCanModerateReport).toHaveBeenCalledWith("jobModerator", "job")
  })

  it("checks with an undefined target type for an orphan report", async () => {
    mockFindUnique.mockResolvedValue({ eventId: null, jobOfferId: null })
    mockCanModerateReport.mockResolvedValue(true)
    mockUpdate.mockResolvedValue({})

    await reports.dismiss(
      { id: "report-1" },
      // @ts-expect-error - needed because of mocked defineAction
      makeContext("mod-1", "eventModerator")
    )

    expect(mockCanModerateReport).toHaveBeenCalledWith("eventModerator", undefined)
  })

  it("throws ActionError with INTERNAL_SERVER_ERROR when the update fails", async () => {
    mockFindUnique.mockResolvedValue({ eventId: "event-1", jobOfferId: null })
    mockCanModerateReport.mockResolvedValue(true)
    mockUpdate.mockRejectedValueOnce(new Error("DB error"))

    await expect(
      reports.dismiss(
        { id: "report-1" },
        // @ts-expect-error - needed because of mocked defineAction
        makeContext("mod-1", "eventModerator")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})

describe("reports.reopen", () => {
  beforeEach(() => {
    mockUpdate.mockClear()
    mockFindUnique.mockReset()
    mockCanModerateReport.mockClear()
  })

  it("throws NOT_FOUND when the report doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      // @ts-expect-error - needed because of mocked defineAction
      reports.reopen({ id: "report-1" }, makeContext("user-1"))
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("throws FORBIDDEN when the caller can't moderate the report's target type", async () => {
    mockFindUnique.mockResolvedValue({ eventId: null, jobOfferId: "job-1" })
    mockCanModerateReport.mockResolvedValue(false)

    await expect(
      // @ts-expect-error - needed because of mocked defineAction
      reports.reopen({ id: "report-1" }, makeContext("user-1"))
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("sets reviewStatus to open for a job moderator on a job report", async () => {
    mockFindUnique.mockResolvedValue({ eventId: null, jobOfferId: "job-1" })
    mockCanModerateReport.mockResolvedValue(true)
    mockUpdate.mockResolvedValue({})

    const result = await reports.reopen(
      { id: "report-1" },
      // @ts-expect-error - needed because of mocked defineAction
      makeContext("mod-1", "jobModerator")
    )

    expect(mockCanModerateReport).toHaveBeenCalledWith("jobModerator", "job")
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "report-1" },
      data: { reviewStatus: "open" },
    })
    expect(result).toEqual({})
  })

  it("throws ActionError with INTERNAL_SERVER_ERROR when the update fails", async () => {
    mockFindUnique.mockResolvedValue({ eventId: null, jobOfferId: "job-1" })
    mockCanModerateReport.mockResolvedValue(true)
    mockUpdate.mockRejectedValueOnce(new Error("DB error"))

    await expect(
      reports.reopen(
        { id: "report-1" },
        // @ts-expect-error - needed because of mocked defineAction
        makeContext("mod-1", "jobModerator")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})

describe("reports.dismissGroup", () => {
  beforeEach(() => {
    mockUpdateMany.mockClear()
    mockCanModerateReport.mockClear()
  })

  it("throws FORBIDDEN when the caller can't moderate the target type", async () => {
    mockCanModerateReport.mockResolvedValue(false)

    await expect(
      reports.dismissGroup(
        { target_type: "event", target_id: "event-1" },
        // @ts-expect-error - needed because of mocked defineAction
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it("dismisses all open reports for an event target when the caller is an event moderator", async () => {
    mockCanModerateReport.mockResolvedValue(true)
    mockUpdateMany.mockResolvedValue({ count: 3 })

    const result = await reports.dismissGroup(
      { target_type: "event", target_id: "event-1" },
      // @ts-expect-error - needed because of mocked defineAction
      makeContext("mod-1", "eventModerator")
    )

    expect(mockCanModerateReport).toHaveBeenCalledWith("eventModerator", "event")
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { reviewStatus: "open", eventId: "event-1", jobOfferId: undefined },
      data: { reviewStatus: "dismissed" },
    })
    expect(result).toEqual({})
  })

  it("dismisses all open reports for a job target when the caller is a job moderator", async () => {
    mockCanModerateReport.mockResolvedValue(true)
    mockUpdateMany.mockResolvedValue({ count: 2 })

    await reports.dismissGroup(
      { target_type: "job", target_id: "job-1" },
      // @ts-expect-error - needed because of mocked defineAction
      makeContext("mod-1", "jobModerator")
    )

    expect(mockCanModerateReport).toHaveBeenCalledWith("jobModerator", "job")
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { reviewStatus: "open", eventId: undefined, jobOfferId: "job-1" },
      data: { reviewStatus: "dismissed" },
    })
  })

  it("throws ActionError with INTERNAL_SERVER_ERROR when the update fails", async () => {
    mockCanModerateReport.mockResolvedValue(true)
    mockUpdateMany.mockRejectedValueOnce(new Error("DB error"))

    await expect(
      reports.dismissGroup(
        { target_type: "event", target_id: "event-1" },
        // @ts-expect-error - needed because of mocked defineAction
        makeContext("mod-1", "eventModerator")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})

describe("reports.reopenGroup", () => {
  beforeEach(() => {
    mockUpdateMany.mockClear()
    mockCanModerateReport.mockClear()
  })

  it("throws FORBIDDEN when the caller can't moderate the target type", async () => {
    mockCanModerateReport.mockResolvedValue(false)

    await expect(
      reports.reopenGroup(
        { target_type: "event", target_id: "event-1" },
        // @ts-expect-error - needed because of mocked defineAction
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it("reopens all dismissed reports for the target", async () => {
    mockCanModerateReport.mockResolvedValue(true)
    mockUpdateMany.mockResolvedValue({ count: 1 })

    const result = await reports.reopenGroup(
      { target_type: "event", target_id: "event-1" },
      // @ts-expect-error - needed because of mocked defineAction
      makeContext("mod-1", "eventModerator")
    )

    expect(mockCanModerateReport).toHaveBeenCalledWith("eventModerator", "event")
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { reviewStatus: "dismissed", eventId: "event-1", jobOfferId: undefined },
      data: { reviewStatus: "open" },
    })
    expect(result).toEqual({})
  })

  it("throws ActionError with INTERNAL_SERVER_ERROR when the update fails", async () => {
    mockCanModerateReport.mockResolvedValue(true)
    mockUpdateMany.mockRejectedValueOnce(new Error("DB error"))

    await expect(
      reports.reopenGroup(
        { target_type: "event", target_id: "event-1" },
        // @ts-expect-error - needed because of mocked defineAction
        makeContext("mod-1", "eventModerator")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})
