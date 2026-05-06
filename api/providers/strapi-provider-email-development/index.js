/* eslint-disable no-undef */
module.exports = {
  init: (_providerOptions = {}, _settings = {}) => {
    return {
      send: async (options) => {
        strapi.log.info("Email intercepted:")
        strapi.log.info(`To: ${options.to}`)
        strapi.log.info(`Subject: ${options.subject}`)
        strapi.log.info(`Text: ${options.text}`)
      },
    }
  },
}
