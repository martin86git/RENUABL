import { describe, expect, it } from "vitest";
import { cleanMailboxChoice, cleanPrefs, DEFAULT_PREFS } from "./prefs";
import { installReminderEmail } from "./schedule";

describe("the installation reminder's mailbox", () => {
  it("keeps a mailbox chosen, lower-cased, and nothing else", () => {
    expect(cleanMailboxChoice({ owner: "Sam@Sunrise.example", address: "Sales@Sunrise.example" })).toEqual({
      owner: "sam@sunrise.example",
      address: "sales@sunrise.example",
    });
    expect(cleanMailboxChoice({ owner: "sam", address: "x@y.z" })).toBeNull();
    expect(cleanMailboxChoice("sales@sunrise.example")).toBeNull();
    expect(DEFAULT_PREFS.reminderFrom).toBeNull();
    expect(cleanPrefs({ reminderFrom: { owner: "a@b.co", address: "c@d.co" } }).reminderFrom).toEqual({
      owner: "a@b.co",
      address: "c@d.co",
    });
  });

  it("sent from the business's own mailbox, says nothing of RENUABL", () => {
    const e = installReminderEmail({ business: "Sunrise Solar", firstName: "Jo", date: "2026-12-04", contact: "03 9000 0000" });
    expect(e.body).not.toMatch(/RENUABL/);
    expect(e.body).toMatch(/^Hi Jo,/);
    expect(e.body).toMatch(/• Clear a path/);
    expect(e.body).toMatch(/Sunrise Solar$/);
  });
});
