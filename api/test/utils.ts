import { jest } from "@jest/globals"

interface StrapiMock {
  documents: jest.Mock
}

export type ControllerFactory = (args: { strapi: StrapiMock }) => any

export function makeCtx({
  userId,
  queryFilters = {},
  body = {},
}: {
  userId?: number
  queryFilters?: Record<string, unknown>
  body?: unknown
} = {}) {
  return {
    state: {
      user: userId !== undefined ? { id: userId } : undefined,
    },
    query: {
      filters: queryFilters as Record<string, unknown>,
      populate: undefined as unknown,
      sort: undefined as unknown,
    },
    params: { id: "doc-1" },
    request: { body },
    unauthorized: jest.fn().mockReturnValue("unauthorized"),
    notFound: jest.fn().mockReturnValue("notFound"),
    forbidden: jest.fn().mockReturnValue("forbidden"),
    badRequest: jest.fn().mockReturnValue("badRequest"),
  }
}

export function makeStrapi(existingDocument: unknown = { owner: { id: 1 } }) {
  // Explicit generics are required: jest.fn() alone infers Mock<UnknownFunction>
  // whose mockResolvedValue expects `never`.
  const mockFindOne = jest.fn<(...args: unknown[]) => Promise<unknown>>()
  mockFindOne.mockResolvedValue(existingDocument)
  const mockFindMany = jest.fn<(...args: unknown[]) => Promise<unknown[]>>()
  mockFindMany.mockResolvedValue([])

  // mockReturnValue (not a factory arg) keeps the mock typed as Mock<UnknownFunction>
  // so it remains assignable to jest.Mock. The uid is recorded in .mock.calls.
  const strapi: StrapiMock = {
    documents: jest.fn().mockReturnValue({
      findOne: mockFindOne,
      findMany: mockFindMany,
    }),
  }
  return { strapi, mockFindOne, mockFindMany }
}
