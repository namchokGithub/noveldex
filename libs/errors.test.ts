import { expect, it } from "vitest";
import { ResourceNotFoundError } from "./errors";

it("identifies missing resources without treating network failures as not found", () => {
  const error = new ResourceNotFoundError("chapter");

  expect(error).toBeInstanceOf(Error);
  expect(error.name).toBe("ResourceNotFoundError");
  expect(error.resource).toBe("chapter");
});
