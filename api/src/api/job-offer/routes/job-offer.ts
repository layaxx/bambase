/**
 * job-offer router
 */

import { factories } from "@strapi/strapi"

export default factories.createCoreRouter("api::job-offer.job-offer", {
  config: {
    update: {
      middlewares: ["api::job-offer.is-owner"],
    },
    delete: {
      middlewares: ["api::job-offer.is-owner"],
    },
  },
})
