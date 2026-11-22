import { describe, expect, it } from "vitest";
import { KEY_ALPHABET, KEY_LENGTH, keyFrom, readSignInSegment, signInPath, slugOf } from "./sign-in-page";

describe("a business's sign-in page", () => {
  it("makes the name plain", () => {
    expect(slugOf("Primero Solar")).toBe("primerosolar");
    expect(slugOf("Sun & Sons Électrique Pty Ltd")).toBe("sunandsonselectriqueptyltd");
    expect(slugOf("!!")).toBe("team");
    expect(slugOf("x".repeat(50))).toHaveLength(30);
  });

  it("makes keys only from letters that can't be mixed up", () => {
    const key = keyFrom(new Uint8Array([0, 1, 2, 255, 128, 64]));
    expect(key).toHaveLength(KEY_LENGTH);
    expect([...key].every((c) => KEY_ALPHABET.includes(c))).toBe(true);
    expect(KEY_ALPHABET).not.toMatch(/[01ilo]/);
  });

  it("reads back the address it writes", () => {
    const path = signInPath("primerosolar", "k7m3qx");
    expect(path).toBe("/primerosolar-k7m3qx");
    expect(readSignInSegment(path.slice(1))).toEqual({ slug: "primerosolar", key: "k7m3qx" });
    expect(readSignInSegment("PrimeroSolar-K7M3QX")).toEqual({ slug: "primerosolar", key: "k7m3qx" });
  });

  it("isn't fooled by other addresses", () => {
    expect(readSignInSegment("primerosolar")).toBeNull();
    expect(readSignInSegment("primerosolar-k7m3q")).toBeNull();
    expect(readSignInSegment("primerosolar-k7m3q0")).toBeNull();
    expect(readSignInSegment("primero-solar-k7m3qx")).toBeNull();
    expect(readSignInSegment("%E0%A4%A")).toBeNull();
  });
});
