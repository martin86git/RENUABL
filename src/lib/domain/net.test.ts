import { describe, expect, it } from "vitest";
import { fetchableUrl, isPrivateAddress } from "./net";

describe("addresses the server may fetch", () => {
  it("knows private and local addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.5",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
    ])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "203.0.113.9", "172.32.0.1", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
  it("takes plain https links to public hosts only", () => {
    expect(fetchableUrl("https://www.jinkosolar.com/uploads/sheet.pdf")?.hostname).toBe("www.jinkosolar.com");
    for (const bad of [
      "http://maker.com/a.pdf",
      "https://localhost/a.pdf",
      "https://127.0.0.1/a.pdf",
      "https://user:pw@maker.com/a",
      "https://intranet/a.pdf",
      "ftp://maker.com/a.pdf",
      "not a url",
      "https://169.254.169.254/latest",
    ])
      expect(fetchableUrl(bad), bad).toBeNull();
  });
});
