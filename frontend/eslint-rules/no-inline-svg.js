export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow <svg> elements in .astro files outside the allowed directory",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedDir: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noInlineSvg:
        "<svg> elements are only allowed in '{{ allowedDir }}'. Use an SVG component instead.",
    },
  },

  create(context) {
    const allowedDir = context.options[0]?.allowedDir ?? "src/components/icons"
    const filePath = context.filename ?? context.getFilename()

    // Normalize path separators (Windows compat)
    const normalizedPath = filePath.replace(/\\/g, "/")

    // If this file is inside the allowed directory, skip all checks
    if (normalizedPath.includes(allowedDir)) return {}

    return {
      // Catches <svg> in the template section of .astro files
      JSXOpeningElement(node) {
        if (node.name.name === "svg") {
          context.report({ node, messageId: "noInlineSvg", data: { allowedDir } })
        }
      },
    }
  },
}
