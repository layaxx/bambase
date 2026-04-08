/**
 * event controller
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreController("api::event.event", ({ strapi }) => ({
  async update(ctx) {
    const user = ctx.state.user
    if (!user) return ctx.unauthorized()

    const { id } = ctx.params
    const event = await strapi
      .documents("api::event.event")
      .findOne({ documentId: id, populate: ["owner"] })

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
      .findOne({ documentId: id, populate: ["owner"] })

    if (!event) return ctx.notFound()
    if (event.owner?.id !== user.id) return ctx.forbidden()

    return super.delete(ctx)
  },
}))
