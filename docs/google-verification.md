# Google verification for RENUABL Business

What to fill in and send so that more than 100 people can connect Gmail and Google Calendar. Prepared 5 Nov 2026. Check every line against the app before submitting: Google rejects a submission whose words don't match what the app does.

## 1. Branding (Google Auth Platform → Branding)

| Field              | Value                                                     |
| ------------------ | --------------------------------------------------------- |
| App name           | RENUABL                                                   |
| User support email | hello@renuabl.com.au                                      |
| App logo           | The RENUABL wordmark, 120 × 120 px square PNG, under 1 MB |
| App home page      | https://www.renuabl.com.au/business                       |
| Privacy policy     | https://www.renuabl.com.au/privacy                        |
| Terms of service   | https://www.renuabl.com.au/design/terms                   |
| Authorised domain  | renuabl.com.au                                            |
| Developer contact  | martin@renuabl.com.au                                     |

- **Prove you own renuabl.com.au** in Google Search Console (a DNS TXT record), signed in with an owner of the Google Cloud project.
- **The home page has to be reachable and describe the app.** `/business` explains RENUABL Business and links the privacy policy and terms. It is noindex while `BUSINESS_LINK_SHOWN` is false. That should be fine for Google, which only needs to open the page, but switch on the business link if reviewers ask for it to be found from the main site.
- **The terms at `/design/terms` are a draft** awaiting legal review. Have them reviewed before submitting.

## 2. Scopes and why each is needed (Data Access)

| Scope                      | Kind          | Why RENUABL needs it                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openid`, `userinfo.email` | Non-sensitive | Sign in with Google, and to know which Google account a connected mailbox belongs to.                                                                                                                                                                                                                                                                                                   |
| `gmail.modify`             | Restricted    | Each person at a solar business sees their own inbox inside RENUABL beside their customers' deals. They can open an email and its attachments, see which customer it is from, and mark it read or unread or archive it, which has to show the same in Gmail. RENUABL never sends, deletes or forwards email. `gmail.readonly` can't change read or archived status, so it isn't enough. |
| `gmail.readonly`           | Restricted    | **Remove it** from Data Access: since 5 Nov 2026 the sign-in asks only for `gmail.modify` (`GMAIL_SCOPE` in `src/lib/domain/design/inbox.ts`; `GMAIL_READONLY_SCOPE` is kept only to recognise mailboxes connected before).                                                                                                                                                             |
| `calendar.events.readonly` | Sensitive     | Each person sees their own calendar's events in RENUABL's calendar (month and day views), read only. Nothing is created, changed or deleted.                                                                                                                                                                                                                                            |

Words for the "How will the scopes be used?" box:

> RENUABL is software for solar retailers and installers. A signed-in member of a business can connect their own Gmail to see their inbox inside RENUABL next to their customer records. We read their inbox messages and attachments to show them, match the sender's address to the business's own customers, and change labels only when the member asks (mark read, mark unread, archive). When the member presses Summarise or Draft a reply on one email, that email's text is sent to our AI provider (Anthropic) to write the summary or draft, which is shown to the member and not stored. Emails and attachments are not stored, except a copy of one email's sender, subject, date and text when the member tags a teammate on it. Tokens are stored encrypted. Data is never sold, used for advertising or used to train AI models. Calendar events are read only, to show the member their own calendar.

## 3. The demo video (unlisted YouTube link)

Record on the live site (https://www.renuabl.com.au) with the browser's address bar showing. Cover each step:

1. Open /business, then sign in to RENUABL Business.
2. Open the inbox and press Connect with Google. Show Google's consent screen with the app name and **each permission it asks for**, then the client ID in the address bar (`710557701126-…`).
3. Show the inbox: emails listed, one opened with an attachment, the customer match.
4. Mark one read, mark one unread, and archive one. Then show the same change in Gmail itself.
5. Press Summarise on one email and show the result.
6. Open the calendar from the date tile, connect Google Calendar, and show the month and day views.
7. Disconnect both, and show that access was removed in the Google account's third-party connections.

## 4. Security assessment (CASA), for Gmail only

`gmail.modify` is a restricted scope, and RENUABL's server reads the mail, so Google requires an annual CASA assessment by one of its approved assessors. Google sends the instructions once the rest of the review has been accepted.

- Get quotes from the approved assessors Google lists.
- Points the assessor will look at: tokens are encrypted at rest (AES-256-GCM, `seal` in `src/lib/server/gmail.ts`), revoked on disconnect, never logged or sent to a browser; email content isn't stored, apart from the tagged-email copy.
- To start without waiting: verify sign-in and Calendar first with the Gmail scopes taken out of Data Access, then add Gmail back once the assessment is through.

## 5. Until verification is through

- **Test users:** at most 100 over the app's life. Testing-mode connections expire after 7 days.
- **Google Workspace businesses** can let their own staff connect before verification: their admin marks the app as trusted (Admin console → Security → Access and data control → API controls → Manage third-party app access, add the client ID `710557701126-9ufk2t9ipt5r8vldpaa3iecc9pnchlhb.apps.googleusercontent.com`, set to Trusted).
- **Project:** this is in the "Renuabl dev" Google Cloud project. Verification belongs to the project, so verify the one the live site uses.

## 6. Outlook (Microsoft)

Outlook calendars go through Microsoft Entra, not Google. For people outside your own Microsoft organisation to connect without a warning, complete Microsoft's publisher verification (needs a Microsoft Partner Network account) on the app registration behind `MICROSOFT_OAUTH_CLIENT_ID`.
