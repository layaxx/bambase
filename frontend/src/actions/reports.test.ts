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

vi.mock("@/utils/prisma", () => ({
  default: {
    report: { create: mockCreate },
  },
}))

import { reports } from "./reports"

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
