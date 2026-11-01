/**
 * View as (1 Nov 2026, Martin: Primero's copied across, wave 7): the owner opens the whole product as another member of
 * their business sees it (their role, permissions, deals, Today), to check what that person sees. It is read only:
 * while viewing, nothing can be changed (the proxy refuses every change to the designer's API but going back), and a
 * bar over every page says whose view it is. Only the owner, and only someone in their own business. Pure, tested.
 */

/** The cookie that holds whose view the owner is in: an email, nothing else. */
export const VIEW_AS_COOKIE = "renuabl_view_as";
export const VIEW_AS_PATH = "/api/design/view-as";
export const VIEWING_REFUSAL = "You're viewing as someone else, so nothing can be changed. Go back to your own view to make changes.";

/** Whether a request may go through while viewing as someone: reading anything, and going back to your own view. */
export function passesWhileViewing(method: string, path: string): boolean {
  const m = method.toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS" || (m === "DELETE" && path === VIEW_AS_PATH);
}

/** Whose view to open: only another member of the owner's own business. */
export function mayViewAs(
  viewer: { role: string; email: string; businessId: string },
  other: { email: string; businessId: string } | null,
): boolean {
  return viewer.role === "owner" && Boolean(other) && other!.businessId === viewer.businessId && other!.email !== viewer.email;
}
