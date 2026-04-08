export default {
  loadMensaData: {
    task: async ({ strapi }) => {
      try {
        await strapi.service("api::mensa.mensa").load()
      } catch (error) {
        console.error("Error loading Mensa data:", error)
      }
    },
    options: {
      // every day at 5:00, 8:00, 10:00, 11:00, 12:00, 14:00, and 16:00
      rule: "0 5,8,10,11,12,14,16 * * *",
    },
  },
  unpublishExpiredJobOffers: {
    task: async ({ strapi }) => {
      try {
        await strapi.service("api::job-offer.job-offer").unpublishExpired()
      } catch (error) {
        console.error("Error unpublishing expired job offers:", error)
      }
    },
    options: {
      // every day at 1:00
      rule: "0 1 * * *",
    },
  },
}
