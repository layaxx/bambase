import { add } from "date-fns"

export default {
  async beforeCreate(event) {
    const ctx = strapi.requestContext.get()
    const userId = ctx?.state?.user?.id

    if (userId) {
      event.params.data.owner = userId
    }

    event.params.data.slug = await strapi.plugins["content-manager"].services.uid.generateUIDField({
      contentTypeUID: "api::job-offer.job-offer",
      field: "slug",
      data: event.params.data,
    })

    event.params.data.offline_after = add(new Date(), { days: 30 })
    event.params.data.online_status = "submitted"
  },
}
