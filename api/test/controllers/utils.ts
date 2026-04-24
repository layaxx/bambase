import { type ControllerFactory, makeCtx, makeStrapi } from "../utils"

/* eslint-disable jest/no-export */
export function getTransformedPayload(controller: any): unknown {
  return (controller.transformResponse as jest.Mock).mock.calls[0][0]
}

export function testOwnershipGuards(
  method: "update" | "delete",
  createController: ControllerFactory
): void {
  it("calls ctx.unauthorized() when there is no authenticated user", async () => {
    const { strapi } = makeStrapi()
    const controller = createController({ strapi })
    const ctx = makeCtx({})
    ctx.state.user = undefined

    const result = await controller[method](ctx)

    expect(ctx.unauthorized).toHaveBeenCalled()
    expect(result).toBe("unauthorized")
  })

  it("calls ctx.notFound() when the document does not exist", async () => {
    const { strapi } = makeStrapi(null)
    const controller = createController({ strapi })
    const ctx = makeCtx({ userId: 1 })

    const result = await controller[method](ctx)

    expect(ctx.notFound).toHaveBeenCalled()
    expect(result).toBe("notFound")
  })

  it("calls ctx.forbidden() when the user is not the owner", async () => {
    const { strapi } = makeStrapi({ owner: { id: 99 } })
    const controller = createController({ strapi })
    const ctx = makeCtx({ userId: 1 })

    const result = await controller[method](ctx)

    expect(ctx.forbidden).toHaveBeenCalled()
    expect(result).toBe("forbidden")
  })

  it("does not call any error handler when the user is the owner", async () => {
    const { strapi } = makeStrapi({ owner: { id: 1 } })
    const controller = createController({ strapi })
    const ctx = makeCtx({ userId: 1 })

    await controller[method](ctx)

    expect(ctx.unauthorized).not.toHaveBeenCalled()
    expect(ctx.forbidden).not.toHaveBeenCalled()
    expect(ctx.notFound).not.toHaveBeenCalled()
  })
}
