import { vi } from "vitest"

export function makeCookies(token?: string) {
  return {
    get: (name: string) => (name === "auth_token" && token ? { value: token } : undefined),
  }
}

export function getFetchBody() {
  return JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
}
