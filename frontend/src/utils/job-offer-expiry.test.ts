import { beforeEach, describe, expect, it, vi } from "vitest"

const mockUpdateMany = vi.hoisted(() => vi.fn())
vi.mock("./prisma", () => ({
  default: { jobOffer: { updateMany: mockUpdateMany } },
}))

import { expireJobOffers } from "./job-offer-expiry"

beforeEach(() => {
  mockUpdateMany.mockReset().mockResolvedValue({ count: 0 })
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

describe("expireJobOffers", () => {
  it("flips published offers past their offlineAfter date to expired", async () => {
    mockUpdateMany.mockResolvedValue({ count: 2 })

    await expireJobOffers()

    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        onlineStatus: "published",
        offlineAfter: { lt: expect.any(Date) },
      },
      data: { onlineStatus: "expired" },
    })
  })
})
