/**
 * Disallow text-base-content opacity values other than /40 (muted) or /70 (secondary).
 * See ROADMAP P13: text opacity is standardised to two semantic levels.
 */

const RE = /\btext-base-content\/(?!(?:40|70)\b)\d+\b/g

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce text-base-content opacity to /40 (muted) or /70 (secondary) only",
    },
    schema: [],
    messages: {
      invalidOpacity:
        "Use 'text-base-content/40' (muted) or 'text-base-content/70' (secondary) instead of '{{ token }}'.",
    },
  },

  create(context) {
    function check(str, node) {
      RE.lastIndex = 0
      let match
      while ((match = RE.exec(str)) !== null) {
        context.report({ node, messageId: "invalidOpacity", data: { token: match[0] } })
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") check(node.value, node)
      },
      TemplateLiteral(node) {
        node.quasis.forEach((q) => check(q.value.cooked ?? q.value.raw, q))
      },
    }
  },
}
