import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, cleanBlock, contentProblem, edmLinks, newBlock, renderEdm, type EdmContent } from "./edm";
import { cleanStillKey, playButtonSvg, videoStillKey, youTubeId } from "./edm-video";

const sender = { name: "Sunrise Solar", abn: null, email: "hi@sunrise.example", phone: null, address: null };
const links = {
  click: (i: number) => `https://site.test/api/m/c/tok?l=${i}`,
  pixel: null,
  unsubscribe: "#",
  image: (id: string) => `https://site.test/api/m/i/${id}`,
};
const pic = "mimg_0123456789abcdef01234567";
const email = (url: string | null, imageId: string | null = null, text = ""): EdmContent => ({
  subject: "s",
  preview: "",
  blocks: [
    { ...newBlock("heading"), text: "Watch" },
    { ...newBlock("video"), url, imageId, text },
  ],
});

describe("video links", () => {
  it("reads a YouTube id from its usual links", () => {
    for (const u of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
      "https://m.youtube.com/embed/dQw4w9WgXcQ",
    ])
      expect(youTubeId(u)).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://vimeo.com/123456")).toBeNull();
    expect(youTubeId("https://youtube.com/watch?v=short")).toBeNull();
  });

  it("draws the still from a picture first, else YouTube's", () => {
    expect(videoStillKey(pic, "https://youtu.be/dQw4w9WgXcQ")).toBe(pic);
    expect(videoStillKey(null, "https://youtu.be/dQw4w9WgXcQ")).toBe("yt-dQw4w9WgXcQ");
    expect(videoStillKey(null, "https://vimeo.com/1")).toBeNull();
    expect(cleanStillKey(`${pic}.jpg`)).toBe(pic);
    expect(cleanStillKey("yt-dQw4w9WgXcQ.jpg")).toBe("yt-dQw4w9WgXcQ");
    expect(cleanStillKey("../etc")).toBeNull();
  });

  it("draws a play button in the colour", () => {
    expect(playButtonSvg("ff5a1f")).toContain('fill="#ff5a1f"');
  });
});

describe("video blocks", () => {
  it("starts centred with no link, and keeps only an https link", () => {
    expect(newBlock("video")).toMatchObject({ align: "center", url: null, imageId: null });
    expect(cleanBlock({ kind: "video", url: "mailto:a@b.co" })!.url).toBeNull();
    expect(cleanBlock({ kind: "video", url: "javascript:alert(1)" })!.url).toBeNull();
    expect(cleanBlock({ kind: "video", url: "https://vimeo.com/1", imageId: pic })).toMatchObject({
      url: "https://vimeo.com/1",
      imageId: pic,
    });
  });

  it("won't send without a link, or without a picture unless it's YouTube", () => {
    expect(contentProblem(email(null))).toMatch(/needs a link/);
    expect(contentProblem(email("https://vimeo.com/1"))).toMatch(/needs a picture/);
    expect(contentProblem(email("https://vimeo.com/1", pic))).toBeNull();
    expect(contentProblem(email("https://youtu.be/dQw4w9WgXcQ"))).toBeNull();
  });

  it("sends the still with its play button and a line, both tracked as one link", () => {
    const c = email("https://youtu.be/dQw4w9WgXcQ", null, "Hi {firstName}, see it work");
    expect(edmLinks(c.blocks)).toEqual(["https://youtu.be/dQw4w9WgXcQ"]);
    const r = renderEdm(
      c,
      DEFAULT_BRAND,
      sender,
      { firstName: "Sam", company: null },
      {
        ...links,
        video: (key, colour) => `https://site.test/api/m/v/${key}.jpg?c=${colour}`,
      },
    );
    expect(r.html).toContain('src="https://site.test/api/m/v/yt-dQw4w9WgXcQ.jpg?c=ff5a1f"');
    expect(r.html).toContain('alt="Play: Hi Sam, see it work"');
    expect(r.html.match(/api\/m\/c\/tok\?l=0/g)).toHaveLength(2);
    expect(r.text).toContain("Hi Sam, see it work: https://site.test/api/m/c/tok?l=0");
  });

  it("falls back to the plain picture, or just the line, where no still can be drawn", () => {
    expect(renderEdm(email("https://vimeo.com/1", pic), DEFAULT_BRAND, sender, { firstName: null, company: null }, links).html).toContain(
      `api/m/i/${pic}`,
    );
    const r = renderEdm(email("https://youtu.be/dQw4w9WgXcQ"), DEFAULT_BRAND, sender, { firstName: null, company: null }, links);
    expect(r.html).not.toContain('<img src="https://site.test/api/m/v/');
    expect(r.html).toContain("Watch the video");
  });
});
