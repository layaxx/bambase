export default {
  async beforeCreate(event) {
    event.params.data.review_status = "open"
  },
}
