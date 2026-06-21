import { vi } from "vitest"

export function makeContext(token?: string) {
  return {
    cookies: {
      get: (_name: string) => undefined,
    },
    locals: { token: token ?? null },
  }
}

export function getFetchBody() {
  return JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)
}
