import satori from "satori"
import fs from "fs/promises"
import { Resvg } from "@resvg/resvg-js"

const [interFont, interFont700] = await Promise.all([
  fs.readFile(
    new URL(
      "../../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff",
      import.meta.url
    )
  ),
  fs.readFile(
    new URL(
      "../../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff",
      import.meta.url
    )
  ),
])

const fonts: Parameters<typeof satori>[1]["fonts"] = [
  { name: "Inter", data: interFont, weight: 400, style: "normal" },
  { name: "Inter", data: interFont700, weight: 700, style: "normal" },
]

export const renderToPNG = async (imageContent: Parameters<typeof satori>[0]) => {
  const svg = await satori(imageContent, { width: 1200, height: 630, fonts })

  const png = new Resvg(svg).render().asPng()
  return png
}
