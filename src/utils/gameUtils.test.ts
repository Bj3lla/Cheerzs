import { describe, expect, it, vi, afterEach } from "vitest";
import { categoryColors, getRandomCategory, getRandomItem, getRandomRounds } from "./gameUtils";

describe("gameUtils", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getRandomItem returns an element from the array", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(getRandomItem(["a", "b", "c"])).toBe("a");

    vi.spyOn(Math, "random").mockReturnValue(0.9999);
    expect(getRandomItem(["a", "b", "c"])).toBe("c");
  });

  it("getRandomRounds stays within min/max (inclusive)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(getRandomRounds(10, 20)).toBe(10);

    vi.spyOn(Math, "random").mockReturnValue(0.9999);
    expect(getRandomRounds(10, 20)).toBe(20);
  });

  it("getRandomCategory returns expected category at boundaries", () => {
    const mock = vi.spyOn(Math, "random");

    mock.mockReturnValue(0.0);
    expect(getRandomCategory()).toBe("drinkingbuddy");

    mock.mockReturnValue(0.03); // 3%
    expect(getRandomCategory()).toBe("wildcard");

    mock.mockReturnValue(0.05); // 5%
    expect(getRandomCategory()).toBe("rule");

    mock.mockReturnValue(0.2); // 20%
    expect(getRandomCategory()).toBe("point");

    mock.mockReturnValue(0.5); // 50%
    expect(getRandomCategory()).toBe("never");

    mock.mockReturnValue(0.7); // 70%
    expect(getRandomCategory()).toBe("truth");

    mock.mockReturnValue(0.95); // 95%
    expect(getRandomCategory()).toBe("dare");
  });

  it("categoryColors contains all categories", () => {
    expect(Object.keys(categoryColors).sort()).toEqual(
      [
        "dare",
        "drinkingbuddy",
        "never",
        "point",
        "repeal",
        "rule",
        "truth",
        "wildcard",
      ].sort()
    );
  });
});
