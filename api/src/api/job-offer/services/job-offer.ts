/**
 * job-offer service
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreService("api::job-offer.job-offer", {
  unpublishExpired: async () => {
    const now = new Date()
    const expiredOffers = await strapi.documents("api::job-offer.job-offer").findMany({
      filters: {
        offline_after: { $lte: now },
        online_status: "published",
      },
    })

    const result = await Promise.allSettled(
      expiredOffers.map(async (offer) => {
        await strapi.documents("api::job-offer.job-offer").update({
          documentId: offer.documentId,
          data: { online_status: "expired" },
        })
      })
    )

    // log the number of successfully unpublished offers
    const unpublishedCount = result.filter((r) => r.status === "fulfilled").length
    console.log(`Unpublished ${unpublishedCount} expired job offers.`)

    // log any errors
    result
      .filter((r) => r.status === "rejected")
      .forEach((r) => console.error("Error unpublishing job offer:", r.status))
  },
})
