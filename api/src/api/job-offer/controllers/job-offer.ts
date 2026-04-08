/**
 * job-offer controller
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreController("api::job-offer.job-offer", ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user
    const existing = (ctx.query.filters ?? {}) as Record<string, unknown>

    if (user) {
      // Fetch published + own offers separately, then merge
      const [published, own] = await Promise.all([
        strapi.documents("api::job-offer.job-offer").findMany({
          filters: { ...existing, online_status: { $eq: "published" } },
          populate: ctx.query.populate,
          sort: ctx.query.sort,
        }),
        strapi.documents("api::job-offer.job-offer").findMany({
          filters: { ...existing, owner: { id: { $eq: user.id } } },
          populate: ctx.query.populate,
          sort: ctx.query.sort,
        }),
      ])

      const seen = new Set<string>()
      const results = [...published, ...own].filter((item) => {
        if (seen.has(item.documentId)) return false
        seen.add(item.documentId)
        return true
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
      .findOne({ documentId: id, populate: ["owner"] })

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
      .findOne({ documentId: id, populate: ["owner"] })

    if (!offer) return ctx.notFound()
    if (offer.owner?.id !== user.id) return ctx.forbidden()

    return super.delete(ctx)
  },
}))
