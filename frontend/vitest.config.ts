import { getViteConfig } from "astro/config"

// getViteConfig accepts Vite's UserConfig; vitest extends it with 'test' via
// module augmentation that TypeScript can't see here, hence the cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default getViteConfig({ test: { environment: "node" } } as any)
