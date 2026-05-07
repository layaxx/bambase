/**
 * event controller
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreController("api::event.event", ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user
    const existing = (ctx.query.filters ?? {}) as Record<string, unknown>

    if (user) {
      // fetch own events for logged in users
      const results = await strapi.documents("api::event.event").findMany({
        filters: { ...existing, owner: { id: { $eq: user.id } } },
        populate: ctx.query.populate,
        sort: ctx.query.sort,
      })

      return this.transformResponse(results)
    }

    return super.find(ctx)
  },

  async update(ctx) {
    const user = ctx.state.user
    if (!user) return ctx.unauthorized()

    const { id } = ctx.params
    const event = await strapi
      .documents("api::event.event")
      .findOne({ documentId: id, populate: { owner: { fields: ["id"] } } })

    if (!event) return ctx.notFound()
    if (event.owner?.id !== user.id) return ctx.forbidden()

    return super.update(ctx)
  },

  async delete(ctx) {
    const user = ctx.state.user
    if (!user) return ctx.unauthorized()

    const { id } = ctx.params
    const event = await strapi
      .documents("api::event.event")
      .findOne({ documentId: id, populate: { owner: { fields: ["id"] } } })

    if (!event) return ctx.notFound()
    if (event.owner?.id !== user.id) return ctx.forbidden()

    return super.delete(ctx)
  },
}))
