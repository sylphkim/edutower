import { mockWrongbookItems } from "../mock/wrongbook";
import type { StubPayload, WrongbookItem } from "../types/edutower";
import { createStubPayload } from "./stub.service";

export const wrongbookService = {
  listItems(): StubPayload<{ items: WrongbookItem[] }> {
    return createStubPayload("wrongbook", "Wrongbook retrieval is scaffolded only.", {
      items: mockWrongbookItems
    });
  }
};
