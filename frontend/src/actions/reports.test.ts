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

vi.mock("@/utils/api", () => ({
  client: {
    collection: vi.fn().mockReturnValue({ create: mockCreate }),
  },
}))

import { reports } from "./reports"

describe("reports.submit", () => {
  beforeEach(() => mockCreate.mockClear())

  it("passes target_id as 'event' field when target_type is 'event'", async () => {
    mockCreate.mockResolvedValue({})

    await reports.submit({
      // @ts-expect-error - needed because of mocked defineAction
      target_type: "event",
      target_id: "event-doc-123",
      reason: "spam",
    })

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ event: "event-doc-123" }))
  })

  it("passes target_id as 'job_offer' field when target_type is 'job'", async () => {
    mockCreate.mockResolvedValue({})

    await reports.submit({
      // @ts-expect-error - needed because of mocked defineAction
      target_type: "job",
      target_id: "job-doc-456",
      reason: "inappropriate",
    })

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ job_offer: "job-doc-456" }))
  })

  it("does NOT include an 'event' field when target_type is 'job'", async () => {
    mockCreate.mockResolvedValue({})

    await reports.submit({
      // @ts-expect-error - needed because of mocked defineAction
      target_type: "job",
      target_id: "job-doc-456",
      reason: "spam",
    })

    const call = mockCreate.mock.calls[0][0]
    expect(call.event).toBeUndefined()
  })

  it("includes reason in the create payload", async () => {
    mockCreate.mockResolvedValue({})

    await reports.submit({
      // @ts-expect-error - needed because of mocked defineAction
      target_type: "event",
      target_id: "ev-1",
      reason: "outdated",
    })

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ reason: "outdated" }))
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
      expect.objectContaining({ details: "Suspicious content" })
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

    const call = mockCreate.mock.calls[0][0]
    expect(call.details).toBeUndefined()
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

  it("throws ActionError with INTERNAL_SERVER_ERROR when client.create rejects", async () => {
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
