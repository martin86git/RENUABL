/**
 * Server only. Whether a business may text its customers from RENUABL (13 Nov 2026, Martin: call or text a contact
 * from the phone assistant's window). Only RENUABL's own business for now, as its calls are: the number a text comes
 * from is RENUABL's (`TWILIO_FROM`). Each business's own number comes later.
 */
import { dbConfigured } from "./db";
import { renuablCrm } from "./renuabl-crm";
import { smsConfigured } from "./sms";

export async function textsOnFor(businessId: string): Promise<boolean> {
  if (!smsConfigured() || !dbConfigured()) return false;
  return (await renuablCrm().catch(() => null))?.businessId === businessId;
}
