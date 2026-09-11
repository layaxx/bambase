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

    // Change each path separator to "/", because Windows uses a different separator.
    const normalizedPath = filePath.replace(/\\/g, "/")

    if (normalizedPath.includes(allowedDir)) return {}

    return {
      // Finds an <svg> element in the template section of an .astro file.
      JSXOpeningElement(node) {
        if (node.name.name === "svg") {
          context.report({ node, messageId: "noInlineSvg", data: { allowedDir } })
        }
      },
    }
  },
}
