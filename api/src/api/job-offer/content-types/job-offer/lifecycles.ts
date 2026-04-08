import { add } from "date-fns"

export default {
  async beforeCreate(event) {
    const ctx = strapi.requestContext.get()
    const userId = ctx?.state?.user?.id

    if (userId) {
      event.params.data.owner = userId
    }

    event.params.data.uuid = await strapi.plugins["content-manager"].services.uid.generateUIDField({
      contentTypeUID: "api::job-offer.job-offer",
      field: "uuid",
      data: event.params.data,
    })

    event.params.data.offline_after = add(new Date(), { days: 30 })
    event.params.data.online_status = "submitted"
  },

  async beforeUpdate(event) {
    // TODO: reset to submitted, unless it is a request from the content manager
    // event.params.data.online_status = "submitted"
  },
}
