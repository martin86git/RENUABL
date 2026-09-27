/**
 * Deployment-level settings read from environment variables.
 *
 * NEXT_PUBLIC_PREVIEW_MODE defaults to on: every deployment shows a
 * "sample data" banner and asks search engines not to index it. Set it to
 * "false" only once real data, payments and legal terms are in place.
 */
export const PREVIEW_MODE = process.env.NEXT_PUBLIC_PREVIEW_MODE !== "false";
