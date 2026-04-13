export default {
  async beforeCreate(event) {
    event.params.data.slug = await strapi.plugins["content-manager"].services.uid.generateUIDField({
      contentTypeUID: "api::location.location",
      field: "slug",
      data: event.params.data,
    })
  },
}
