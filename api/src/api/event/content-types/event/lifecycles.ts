export default {
  async beforeCreate(event) {
    const ctx = strapi.requestContext.get()
    const userId = ctx?.state?.user?.id

    if (userId) {
      event.params.data.owner = userId
    }

    event.params.data.slug = await strapi.plugins["content-manager"].services.uid.generateUIDField({
      contentTypeUID: "api::event.event",
      field: "slug",
      data: event.params.data,
    })
  },
}
