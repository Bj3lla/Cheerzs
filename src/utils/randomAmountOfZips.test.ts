import { describe, expect, it } from "vitest";
import { getRandomAmountOfZips } from "./randomAmountOfZips";

describe("randomAmountOfZips", () => {
  it("returns singular for 1", () => {
    expect(getRandomAmountOfZips(1, 1)).toBe("1 sip");
  });

  it("returns plural for > 1", () => {
    expect(getRandomAmountOfZips(2, 2)).toBe("2 sips");
  });
});
