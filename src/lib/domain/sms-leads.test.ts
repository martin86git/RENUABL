import { describe, expect, it } from "vitest";
import { SMS_MAX, newLeadStaffSms, staffMobiles, startedPlanSms } from "./sms";

describe("lead texts", () => {
  it("tells the lead who we are, with one link and Reply STOP, within two segments", () => {
    const sms = startedPlanSms({ link: "https://www.renuabl.com.au/book-a-call" });
    expect(sms.startsWith("RENUABL:")).toBe(true);
    expect(sms).toContain("Reply STOP");
    expect(sms.length).toBeLessThanOrEqual(SMS_MAX);
    expect(sms.match(/https:\/\//g)).toHaveLength(1);
  });

  it("tells staff to call now, suburb only", () => {
    const sms = newLeadStaffSms({ contact: "+61412345678", suburb: "Glen Waverley", entry: "Got solar? Add a battery" });
    expect(sms).toContain("+61412345678");
    expect(sms).toContain("Glen Waverley");
    expect(sms).toContain("Get in touch now");
  });

  it("reads staff mobiles, ignoring anything that isn't an Australian mobile", () => {
    expect(staffMobiles("0400 111 222, +61 400 111 222, 03 9999 0000, nope")).toEqual(["+61400111222"]);
    expect(staffMobiles(undefined)).toEqual([]);
  });
});
