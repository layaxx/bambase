import { describe, jest } from "@jest/globals"
import eventControllerFactory from "../../src/api/event/controllers/event"
import { testOwnershipGuards } from "./utils"
import type { ControllerFactory } from "../utils"

jest.mock("@strapi/strapi", () => ({
  factories: {
    createCoreController: (
      _uid: string,
      factory: (args: { strapi: unknown }) => Record<string, unknown>
    ) => {
      const stub = {
        async find() {},
        async update() {},
        async delete() {},
        transformResponse(x: unknown) {
          return x
        },
      }
      return (args: { strapi: unknown }) => {
        const methods = factory(args)
        // Set prototype so super.find/update/delete resolve to no-op stubs
        Object.setPrototypeOf(methods, stub)
        return methods
      }
    },
  },
}))

const createEventController: ControllerFactory =
  eventControllerFactory as unknown as ControllerFactory

describe("event controller: update()", () => {
  testOwnershipGuards("update", createEventController)
})

describe("event controller: delete()", () => {
  testOwnershipGuards("delete", createEventController)
})
