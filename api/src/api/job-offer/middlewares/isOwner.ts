"use strict"

/**
 * `isOwner` middleware
 */
// TODO: check if this actually works
export default (config_, { strapi }) => {
  return async (ctx, next) => {
    const user = ctx.state.user
    const entryId = ctx.params.id ? ctx.params.id : undefined
    let entry = { owner: { id: null } }

    if (entryId) {
      entry = await strapi
        .documents("api::job-offer.job-offer")
        .findOne(entryId, { populate: "owner" })
    }

    if (user.id !== entry.owner.id) {
      return ctx.unauthorized("This action is unauthorized.")
    } else {
      return next()
    }
  }
}
