import { describe, expect, it } from "vitest";
import { answerRefusal, jobAnsweredEmail, jobSentEmail, sendRefusal, shareLive, statusWords, type ShareStatus } from "./job-shares";

const share = (state: ShareStatus["state"]): ShareStatus => ({ id: "s", to: "Sparks Electrical", state, sentAt: "", answeredAt: null });

describe("sending a job to an installer", () => {
  it("goes only to a connected installer, and to one at a time", () => {
    expect(sendRefusal({ connected: true, kind: "installer", live: null })).toBeNull();
    expect(sendRefusal({ connected: false, kind: "installer", live: null })).toMatch(/connected with/);
    expect(sendRefusal({ connected: true, kind: "inspector", live: null })).toMatch(/nominated by the installer/);
    expect(sendRefusal({ connected: true, kind: "installer", live: share("accepted") })).toMatch(/already with Sparks Electrical/);
  });

  it("is live while waiting or accepted", () => {
    expect(shareLive("sent")).toBe(true);
    expect(shareLive("accepted")).toBe(true);
    expect(shareLive("declined")).toBe(false);
    expect(shareLive("withdrawn")).toBe(false);
  });

  it("can't be answered once taken back or declined, or accepted twice", () => {
    expect(answerRefusal("sent", "accept")).toBeNull();
    expect(answerRefusal("sent", "decline")).toBeNull();
    expect(answerRefusal("withdrawn", "accept")).toMatch(/taken this job back/);
    expect(answerRefusal("declined", "accept")).toMatch(/declined/);
    expect(answerRefusal("accepted", "accept")).toMatch(/already accepted/);
    expect(answerRefusal("accepted", "decline")).toBeNull();
  });

  it("says where it stands in words", () => {
    expect(statusWords(share("sent"))).toBe("Sent to Sparks Electrical, waiting for them to accept");
    expect(statusWords(share("accepted"))).toBe("Accepted by Sparks Electrical");
    expect(statusWords(share("withdrawn"))).toBe("Taken back from Sparks Electrical");
  });
});

describe("the emails", () => {
  it("tell the installer the suburb and day only, and the retailer the answer", () => {
    const sent = jobSentEmail({ from: "Sunrise <Solar>", suburb: "Clayton", day: "2026-11-20", link: "https://x.example/design/jobs" });
    expect(sent.subject).toBe("Sunrise <Solar> sent you a job in Clayton");
    expect(sent.html).toContain("Sunrise &lt;Solar&gt;");
    expect(sent.text).toContain("for 2026-11-20");
    const answered = jobAnsweredEmail({ installer: "Sparks", accepted: false, suburb: "Clayton", link: "https://x.example" });
    expect(answered.subject).toBe("Sparks declined the job in Clayton");
  });
});
