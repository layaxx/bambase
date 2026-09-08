import { z } from "astro/zod"

/**
 * An http(s) URL. The protocol allowlist is necessary: `z.url()` alone accepts each URL that
 * it can parse, `javascript:alert(1)` included, and these values go into hrefs.
 */
export const httpUrl = z
  .url({ protocol: /^https?$/, error: "Nur http(s)-URLs sind erlaubt." })
  .max(2048)
