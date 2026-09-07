import { z } from "astro/zod"

/**
 * An http(s) URL. The protocol allowlist matters: `z.url()` on its own accepts any
 * parseable URL, `javascript:alert(1)` included, and these values end up in hrefs.
 */
export const httpUrl = z
  .url({ protocol: /^https?$/, error: "Nur http(s)-URLs sind erlaubt." })
  .max(2048)
