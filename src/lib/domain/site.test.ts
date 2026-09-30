import { describe, expect, it } from "vitest";
import { publicSiteUrl, searchIndexing } from "./site";

describe("search indexing", () => {
  it("lets Google index the production deployment only", () => {
    expect(searchIndexing({ VERCEL_ENV: "production" })).toBe(true);
    expect(searchIndexing({ VERCEL_ENV: "preview" })).toBe(false);
    expect(searchIndexing({})).toBe(false);
  });

  it("can be switched on or off explicitly", () => {
    expect(searchIndexing({ VERCEL_ENV: "production", ALLOW_INDEXING: "false" })).toBe(false);
    expect(searchIndexing({ ALLOW_INDEXING: "true" })).toBe(true);
  });

  it("points search engines at the www domain", () => {
    expect(publicSiteUrl()).toBe("https://www.renuabl.com.au");
  });
});
