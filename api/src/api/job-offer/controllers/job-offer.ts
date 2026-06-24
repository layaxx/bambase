/**
 * job-offer controller
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreController("api::job-offer.job-offer", ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user
    const existing = (ctx.query.filters ?? {}) as Record<string, unknown>

    if (user) {
      const results = await strapi.documents("api::job-offer.job-offer").findMany({
        filters: {
          ...existing,
          $or: [{ online_status: { $eq: "published" } }, { owner: { id: { $eq: user.id } } }],
        },
        populate: ctx.query.populate,
        sort: ctx.query.sort,
      })

      return this.transformResponse(results)
    }

    ctx.query.filters = { ...existing, online_status: { $eq: "published" } }
    return super.find(ctx)
  },

  async update(ctx) {
    const user = ctx.state.user
    if (!user) return ctx.unauthorized()

    const { id } = ctx.params
    const offer = await strapi
      .documents("api::job-offer.job-offer")
      .findOne({ documentId: id, populate: { owner: { fields: ["id"] } } })

    if (!offer) return ctx.notFound()
    if (offer.owner?.id !== user.id) return ctx.forbidden()

    const body = ctx.request.body as { data?: Record<string, unknown> } | undefined
    const incomingStatus = body?.data?.online_status
    if (incomingStatus !== undefined && incomingStatus !== "archived") {
      return ctx.badRequest("Owners may only set online_status to 'archived'.")
    }

    return super.update(ctx)
  },

  async delete(ctx) {
    const user = ctx.state.user
    if (!user) return ctx.unauthorized()

    const { id } = ctx.params
    const offer = await strapi
      .documents("api::job-offer.job-offer")
      .findOne({ documentId: id, populate: { owner: { fields: ["id"] } } })

    if (!offer) return ctx.notFound()
    if (offer.owner?.id !== user.id) return ctx.forbidden()

    return super.delete(ctx)
  },
}))
