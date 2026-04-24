import { describe, expect, it, jest } from "@jest/globals"
import jobOfferControllerFactory from "../../src/api/job-offer/controllers/job-offer"
import { getTransformedPayload, testOwnershipGuards } from "./utils"
import { makeCtx, makeStrapi, type ControllerFactory } from "../utils"

const createJobOfferController: ControllerFactory =
  jobOfferControllerFactory as unknown as ControllerFactory

jest.mock("@strapi/strapi", () => ({
  factories: {
    createCoreController: (
      _uid: string,
      factory: (args: { strapi: unknown }) => Record<string, unknown>
    ) => {
      const stub = {
        async find() {},
        async update() {},
        async delete() {},
        transformResponse(x: unknown) {
          return x
        },
      }
      return (args: { strapi: unknown }) => {
        const methods = factory(args)
        // Set prototype so super.find/update/delete resolve to no-op stubs
        Object.setPrototypeOf(methods, stub)
        return methods
      }
    },
  },
}))

describe("job-offer controller: find()", () => {
  it("applies a published-only filter for unauthenticated requests", async () => {
    const { strapi } = makeStrapi()
    const controller = createJobOfferController({ strapi })
    const ctx = makeCtx({ queryFilters: {} })
    ctx.state.user = undefined

    await controller.find(ctx)

    expect(ctx.query.filters).toMatchObject({ online_status: { $eq: "published" } })
  })

  it("preserves existing query filters when adding the published-only filter", async () => {
    const { strapi } = makeStrapi()
    const controller = createJobOfferController({ strapi })
    const ctx = makeCtx({ queryFilters: { category: { $eq: "tech" } } })
    ctx.state.user = undefined

    await controller.find(ctx)

    expect(ctx.query.filters).toMatchObject({
      category: { $eq: "tech" },
      online_status: { $eq: "published" },
    })
  })

  it("overrides a conflicting online_status filter to enforce 'published'", async () => {
    const { strapi } = makeStrapi()
    const controller = createJobOfferController({ strapi })
    const ctx = makeCtx({ queryFilters: { online_status: { $eq: "draft" } } })
    ctx.state.user = undefined

    await controller.find(ctx)

    // Regardless of any client-supplied online_status value, unauthenticated
    // responses must always be restricted to 'published'.
    expect(ctx.query.filters).toMatchObject({ online_status: { $eq: "published" } })
  })

  it("passes published and ownership filters to the data layer for authenticated users", async () => {
    const { strapi, mockFindMany } = makeStrapi()
    const controller = createJobOfferController({ strapi })
    controller.transformResponse = jest.fn((x: unknown) => x)
    const ctx = makeCtx({ userId: 5 })

    await controller.find(ctx)

    expect(strapi.documents).toHaveBeenCalledWith(expect.stringContaining("job-offer"))
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ online_status: { $eq: "published" } }),
      })
    )
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ owner: { id: { $eq: 5 } } }),
      })
    )
  })

  it("returns merged published and own results for authenticated users", async () => {
    const publishedItem = { documentId: "pub-1", title: "Published" }
    const ownItem = { documentId: "own-1", title: "Draft" }
    const { strapi, mockFindMany } = makeStrapi()
    mockFindMany.mockResolvedValueOnce([publishedItem]).mockResolvedValueOnce([ownItem])

    const controller = createJobOfferController({ strapi })
    controller.transformResponse = jest.fn((x: unknown) => x)
    const ctx = makeCtx({ userId: 5 })

    await controller.find(ctx)

    const returned = getTransformedPayload(controller) as Array<{ documentId: string }>
    expect(returned).toHaveLength(2)
    expect(returned.map((i) => i.documentId)).toEqual(expect.arrayContaining(["pub-1", "own-1"]))
  })

  it("deduplicates results that appear in both published and own queries", async () => {
    const sharedItem = { documentId: "shared-1", title: "Job" }
    const ownOnly = { documentId: "own-2", title: "Draft" }
    const { strapi, mockFindMany } = makeStrapi()
    mockFindMany
      .mockResolvedValueOnce([sharedItem]) // published
      .mockResolvedValueOnce([sharedItem, ownOnly]) // own — sharedItem appears in both

    const controller = createJobOfferController({ strapi })
    controller.transformResponse = jest.fn((x: unknown) => x)
    const ctx = makeCtx({ userId: 5 })

    await controller.find(ctx)

    const merged = getTransformedPayload(controller) as Array<{ documentId: string }>
    expect(merged).toHaveLength(2)
    expect(merged.map((i) => i.documentId)).toEqual(expect.arrayContaining(["shared-1", "own-2"]))
  })
})

describe("job-offer controller: update()", () => {
  testOwnershipGuards("update", createJobOfferController)

  it("calls ctx.badRequest() when online_status is set to a non-'archived' value", async () => {
    const { strapi } = makeStrapi()
    const controller = createJobOfferController({ strapi })
    const ctx = makeCtx({ userId: 1, body: { data: { online_status: "published" } } })

    const result = await controller.update(ctx)

    expect(ctx.badRequest).toHaveBeenCalledWith(expect.stringContaining("archived"))
    expect(String(result)).toContain("badRequest")
  })

  it.each([
    ["body is absent", undefined],
    ["body.data is absent", {}],
    ["status is 'archived'", { data: { online_status: "archived" } }],
    ["there is no status change", { data: { title: "New Title" } }],
  ])("does not call any error handler when %s and user matches", async (_, body) => {
    const { strapi } = makeStrapi()
    const controller = createJobOfferController({ strapi })
    const ctx = makeCtx({ userId: 1, body })

    await controller.update(ctx)

    expect(ctx.unauthorized).not.toHaveBeenCalled()
    expect(ctx.forbidden).not.toHaveBeenCalled()
    expect(ctx.badRequest).not.toHaveBeenCalled()
    expect(ctx.notFound).not.toHaveBeenCalled()
  })
})

describe("job-offer controller: delete()", () => {
  testOwnershipGuards("delete", createJobOfferController)
})
