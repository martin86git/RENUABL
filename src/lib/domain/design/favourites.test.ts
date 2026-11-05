import { describe, expect, it } from "vitest";
import { MAX_FAVOURITES, cleanFavourites, favouritesFirst, isFavouriteKind, noFavourites, withFavourite } from "./favourites";

const list = [{ sku: "A" }, { sku: "B" }, { sku: "C" }, { sku: "D" }];

describe("favourite products", () => {
  it("puts starred products first, newest starred first, the rest in their usual order", () => {
    let favs = withFavourite(noFavourites(), "panels", "C", true);
    favs = withFavourite(favs, "panels", "A", true);
    expect(favouritesFirst(list, favs.panels).map((p) => p.sku)).toEqual(["A", "C", "B", "D"]);
    expect(favouritesFirst(list, []).map((p) => p.sku)).toEqual(["A", "B", "C", "D"]);
  });

  it("takes a star off, and keeps each kind apart", () => {
    let favs = withFavourite(noFavourites(), "batteries", "B", true);
    favs = withFavourite(favs, "inverters", "B", true);
    favs = withFavourite(favs, "batteries", "B", false);
    expect(favs.batteries).toEqual([]);
    expect(favs.inverters).toEqual(["B"]);
  });

  it("starring again moves it to the front without repeating it", () => {
    let favs = withFavourite(noFavourites(), "chargers", "A", true);
    favs = withFavourite(favs, "chargers", "B", true);
    favs = withFavourite(favs, "chargers", "A", true);
    expect(favs.chargers).toEqual(["A", "B"]);
  });

  it("a starred product no longer on the list simply doesn't show", () => {
    expect(favouritesFirst(list, ["GONE", "D"]).map((p) => p.sku)).toEqual(["D", "A", "B", "C"]);
  });

  it("cleans what comes from outside: bad codes, repeats, unknown kinds and too many", () => {
    const many = Array.from({ length: 50 }, (_, i) => `P${i}`);
    const favs = cleanFavourites({ panels: ["A", "A", "<b>", 7, " B "], inverters: many, other: ["X"] });
    expect(favs.panels).toEqual(["A", "B"]);
    expect(favs.inverters).toHaveLength(MAX_FAVOURITES);
    expect(favs).not.toHaveProperty("other");
    expect(cleanFavourites(null)).toEqual(noFavourites());
    expect(isFavouriteKind("batteries")).toBe(true);
    expect(isFavouriteKind("roofs")).toBe(false);
  });
});
