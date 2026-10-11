/**
 * What a member who may not see costs is sent in place of them. Pure. The
 * server uses these before answering, so the figures never leave it: hiding
 * them on the screen alone would leave them one click away in the browser.
 *
 * Such a member still designs: they need the business's products (names,
 * sizes, outputs) to draw with, and the bill figures for the savings
 * estimate. What they are not sent: what anything costs the business, its
 * margin and commission, its installation rates, and the costs typed over a
 * quote's lines. The proposal a customer gets is worked out on the server
 * from the real figures either way.
 */
import type { WorkspaceSettings } from "./account";
import { DEFAULT_WORKSPACE, type SupplierList } from "./pricing";
import type { DesignExtras } from "./quote";

/**
 * What stands where a product's cost would be. Not a price: a product with no
 * cost at all is dropped from the designer's lists, so this keeps it there to
 * be drawn with. The screens show no quote to someone sent this.
 */
export const HIDDEN_COST = 0.01;

/**
 * The business's settings and price lists with every cost taken out: the
 * products stay (for the designer's lists), the rows of the price lists go,
 * and the rates, margin and commission are the placeholder ones every new
 * business starts with. The electricity figures and the price a certificate
 * is credited at stay: neither is a cost, and the savings estimate needs them.
 */
export function withoutCosts(
  settings: WorkspaceSettings | null,
  lists: readonly SupplierList[],
): { settings: WorkspaceSettings; lists: SupplierList[] } {
  const hide = <T extends { cost: number }>(item: T): T => ({ ...item, cost: HIDDEN_COST });
  return {
    settings: {
      components: structuredClone(DEFAULT_WORKSPACE.components),
      install: { ...DEFAULT_WORKSPACE.install },
      settings: {
        ...structuredClone(DEFAULT_WORKSPACE.settings),
        ...(settings ? { bill: { ...settings.settings.bill }, stcPrice: settings.settings.stcPrice } : {}),
      },
    },
    lists: lists.map((list) => ({
      name: list.name,
      uploadedAt: list.uploadedAt,
      items: [],
      panels: list.panels.map(hide),
      inverters: list.inverters.map(hide),
      batteries: list.batteries.map(hide),
    })),
  };
}

/** A roof's bill and quotes without the costs typed over the quote's lines (each is a cost someone entered by hand). */
export function withoutCostEdits(extras: DesignExtras): DesignExtras {
  return { ...extras, quotes: extras.quotes.map((q) => ({ ...q, edits: {} })) };
}

/**
 * What a member who can't see costs saves: everything they sent, except the
 * costs typed over the quote's lines, which stay as the business had them
 * (they were never sent those, so what came back is empty, and keeping it
 * would wipe them). A design they added starts with none.
 */
export function keepCostEdits(sent: DesignExtras, stored: DesignExtras | null): DesignExtras {
  return { ...sent, quotes: sent.quotes.map((q, i) => ({ ...q, edits: stored?.quotes[i]?.edits ?? {} })) };
}
