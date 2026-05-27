import type { ModuleStatus, StubPayload } from "../types/edutower";

export function createStubPayload<T>(
  module: string,
  message: string,
  result: T,
  status: ModuleStatus = "mock"
): StubPayload<T> {
  return {
    meta: {
      module,
      status,
      message
    },
    result
  };
}
