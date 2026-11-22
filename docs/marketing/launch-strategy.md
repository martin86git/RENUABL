# RENUABL Business launch: "One giant leap"

_22 Nov 2026. A strategy and a draft email series for Martin's review. Nothing here has been sent._

The emails live in code as drafts (`src/lib/domain/marketing/gtm-drafts.ts`), their pictures and GIFs in `public/design/launch/` (drawn by `tools/marketing/launch-art.mjs`; run it with the dev server on, since Sol is filmed off the homepage). In RENUABL's own business, **Marketing → Campaigns → Add the drafts** puts them into Marketing as a draft campaign and a switched-off sequence, pictures included. Keep this copy and the code in step.

---

## 1. The idea

**One giant leap for solar.**

Solar businesses have run the same way for years: leads in a spreadsheet, a CRM you type into, a design tool, a proposal tool, and somebody on the phone chasing. RENUABL Business is the step change. Every part of the business is in one place, and AI does the work in every part of it.

For the retailer it comes down to one thing: **an AI sales force.**

- **Voice agents** ring each new lead in calling hours, answer their questions, meet the usual worries and book them a call with the team. The business names each one and chooses its voice.
- **Sol**, the brain of the business, knows every deal, puts the day in order, drafts the follow-ups in the business's voice and answers questions with his sources.
- **The rest of the business keeps up**: the roof is priced as it's drawn, the proposal is signed online, and the order, the install and the paperwork after the sale carry on in the same place.

**The tone** is Tesla, SpaceX and Apple: short sentences, one idea at a time, big quiet pictures on black, the signal orange used once. It's confident without bragging. We say what it does, never that it's the best.

## 2. What's in it for the retailer

| What they want                 | What RENUABL does                                                              | Where it's said  |
| ------------------------------ | ------------------------------------------------------------------------------ | ---------------- |
| More sales from the same leads | Leads rung in minutes, in calling hours, by a voice agent, and booked in       | Launch, email 1  |
| Not chasing                    | Sol drafts every follow-up; the agents send them once switched on              | Email 2, email 4 |
| Quotes out faster              | Three priced designs in one press; a proposal signed online                    | Email 3          |
| Less admin                     | Calls written up, emailed leads turned into deals, one feed of what needs them | Email 4          |
| A smooth install               | Order, approvals, calendar, job cards and the post-sale agent                  | Email 5          |
| One bill, no lock-in           | One price for everything, cancel any time                                      | Email 6          |

## 3. Who it's for

1. **Solar retailers** (sell, design and install, 1 to 15 people): the main audience. They feel slow lead response and admin the most.
2. **Installers**: free to join, design jobs by the pack. A later, shorter series; not in this one.
3. **Wholesalers' customers**: through the wholesaler partner kit already in `docs/marketing/wholesaler/`. They link to the demo with their own `utm_source`.

Victoria first, then by state.

## 4. The rollout

| When                       | What                                                                                  | Channel            |
| -------------------------- | ------------------------------------------------------------------------------------- | ------------------ |
| Week 0                     | Fix what must be true before sending (section 6), and seed tests to Gmail and Outlook | Product            |
| Week 1, day 1              | **Launch** to the most engaged segment, warm-up caps applied                          | Marketing campaign |
| From the day after an open | **The series**: six emails, a few working days apart, one idea each                   | Marketing sequence |
| Week 1 onwards             | A post a week on LinkedIn using the same pictures and headlines                       | Martin             |
| Week 2                     | Wholesaler partners send their newsletter block linking to the demo                   | Partners           |
| Week 3                     | Ring everyone who clicked twice or more (each campaign's report lists them)           | Martin             |
| Week 4                     | Read the results (section 7) and choose the next series                               | Martin             |

**Warm-up (Marketing → Settings → daily cap):** days 1 to 3: 50; days 4 to 7: 100; days 8 to 14: 200; then 300, and higher only while bounces stay under 2% and complaints near zero. The product sends on working days, 9 am to 5 pm Melbourne time, 100 at a time each hour.

**Stops:** the series stops for anyone who signs up, unsubscribes, bounces or loses consent. Tick "a click ends it" if you'd rather take over by phone after any click.

## 5. The series

**A glance, not a read.** Nobody reads about something before they know it pays them. Each email is one product, sold the way Apple sells a product: a moving or still picture, a headline of four words or so, one or two lines (45 words at most, tested), one button. No greeting, no paragraphs.

**The products are the heroes:** Sol (filmed off the homepage, so he is the same sun with the brain in it), the voice agent (its sound wave on graphite, as on the homepage and in the app) and the AI designer (its orange round). The launch shows them all at once as **a staggered stack of cards** dealt in one by one: Your customers, answered · Your emails, written · Your calls, written up · Your super-intelligent advisor · Your roofs, designed · Your installs, lined up.

**Moving pictures are GIFs**, the only animation email apps play: the cards dealt in, **a voice agent on a call** (its wave beating, the clock running, the words typed as they are said, then Booked), Sol breathing, the designer laying panels row by row with the kW counting up. **Outlook on Windows shows only a GIF's first frame**, so each starts on its finished picture and then plays. Sizes: 0.2 to 0.8 MB each.

**Sol types instead of static text** (22 Nov 2026, Martin): on the Sol pictures he sits in his state for two seconds, then types; and each follow-up has an **explainer card** (the feature's icon and headline) on which Sol, beside his sun, types the line that would otherwise sit in the email as words. The same words are the picture's alt text, so they still read with pictures off. The heading under each hero is the product's name (Voice agents. Meet Sol. The AI designer.), the card says what it does for you. _A trade-off to know:_ email apps and spam filters prefer some real words to all pictures; the heading, a price line and the alt text carry that, and the seed tests (section 8) will show where each lands.

**It ends the 1990s mail-order way**: a coupon with a dashed border and scissors, a starburst, a YES! box, ticks, and a P.S.

### Launch · day 0

**Subject:** One giant leap for solar  
**Preview:** Your AI sales force is here.

- **Picture** `/design/launch/sol-intro.gif`: Sol types: “Hi, I'm Sol. Meet your AI sales force: I answer your leads, write your emails and design your roofs.”
- **Heading:** One giant leap for solar.
- **Picture** `/design/launch/cards.gif`: “Your customers, answered. Your emails, written. Your calls, written up. Your super-intelligent advisor. Your roofs, designed.”
- **Button:** See it work → https://www.renuabl.com.au/

### 1 · two working days after opening

**Subject:** It's on the phone with your new lead  
**Preview:** Voice agents that ring every lead and book them in.

- **Picture** `/design/launch/call.gif`: “A RENUABL voice agent on a call with a new lead, booking them in (example)”
- **Heading:** Voice agents.
- **Picture** `/design/launch/explain-voice.gif`: Sol types: “Your voice agent rings each new lead within minutes, answers their questions and books them in. It always says it's your automated assistant.”
- **Words:** Calls go out in calling hours. Calls & Texts, $29 a month.
- **Button:** Hear it call → https://www.renuabl.com.au/

### 2 · three days on

**Subject:** Meet Sol  
**Preview:** The brain of your business.

- **Picture** `/design/launch/sol.gif`: Sol types: “I know every deal. I write your emails in your voice, and tell you who to ring next.”
- **Heading:** Meet Sol.
- **Button:** Meet Sol → https://www.renuabl.com.au/

### 3 · three days on

**Subject:** Your roofs, designed  
**Preview:** One press. Three priced designs.

- **Picture** `/design/launch/designer.gif`: “RENUABL's AI designer laying panels on a roof in one press (example home)”
- **Heading:** The AI designer.
- **Picture** `/design/launch/explain-designer.gif`: Sol types: “One press lays out three designs, each priced as it lands. Your customer chooses one and signs online.”
- **Button:** Try the designer → https://www.renuabl.com.au/business/demo

### 4 · three days on

**Subject:** The CRM that does the typing  
**Preview:** Calls written up. Follow-ups drafted.

- **Picture** `/design/launch/today.jpg`: “RENUABL's Today screen: calls, deals and what needs you (example data)”
- **Heading:** A CRM that types.
- **Picture** `/design/launch/explain-crm.gif`: Sol types: “I write up your calls, draft your follow-ups and turn emailed leads into deals. You do the selling.”
- **Button:** See Today → https://www.renuabl.com.au/business/demo

### 5 · three days on

**Subject:** Signed. Then it runs itself.  
**Preview:** Ordering, approvals, installs and job cards in one place.

- **Picture** `/design/launch/runs.jpg`: “RENUABL's install calendar after the sale (example data)”
- **Heading:** After the sale.
- **Picture** `/design/launch/explain-runs.gif`: Sol types: “The moment they sign, the order opens, approvals line up and your installer's job card is ready.”
- **Button:** See after the sale → https://www.renuabl.com.au/

### 6 · four days on

**Subject:** YES! Your first month is free  
**Preview:** No contract. Cancel any time. Every feature, every user.

- **Picture** `/design/launch/coupon.jpg`: “YES! I want my AI sales force. First month free. No contract, cancel any time.”
- **Heading:** Here's the deal.
- **Words:** Your first month is free. Then it's $49 a user a month. No contract. Cancel any time. P.S. Leads go to whoever answers soonest. Let yours answer this week.
- **Button:** YES! Start now → https://www.renuabl.com.au/#pricing

## 6. Must be true before anything is sent

1. **Consent of the list.** Only contacts with express or inferred consent are ever emailed; anyone imported as "Not checked" is skipped. Confirm what consent the bought list carries.
2. **A voice agent booking a call with the retailer's own team.** The business page and these emails both say a voice agent books the lead a call with the team. Today the sales agent's booking tool offers RENUABL's own booking page's times. **Before email 1 goes to retailers, check a retailer's agent books into that retailer's own times, or soften the line** to "lines up a call back with your team".
3. **Calls & Texts for a new business.** Buying a number in the app is switched off until the Twilio regulatory bundle is approved, so each business's number is put on by hand in /admin → Add-ons. Be ready for that load, or hold email 1 until buying is on.
4. **Prices.** The emails read the prices from the code (the plan, the first month and Calls & Texts). Check they are the prices you want on the day.
5. **Sender and settings.** An authenticated sending domain (SPF, DKIM, DMARC), `EMAIL_FROM`, `CRON_SECRET`, `SITE_URL` and the provider's event webhook on `/api/m/events`. Marketing → Settings shows what's missing.
6. **Brand kit.** RENUABL's name, ABN, an email or phone and an address (they go in every footer).
7. **Legal.** A lawyer's look at the footer wording and at saying the calls are automated.

## 7. How we'll know it's working

| Measure         | Good                | Act when                                                                    |
| --------------- | ------------------- | --------------------------------------------------------------------------- |
| Opens (launch)  | 35% or more         | Under 20% after 500 sent: try another subject (Sol writes three on Improve) |
| Clicks (series) | 4% or more an email | Under 2%: the picture or headline isn't landing                             |
| Demos opened    | 1 in 20 clickers    | Low: the demo's first screen needs work                                     |
| Sign-ups        | The real goal       | Ring every two-time clicker within a day                                    |
| Bounces         | Under 2%            | Over 3%: pause and clean the list                                           |
| Complaints      | Near zero           | Any handful: pause                                                          |

## 8. Testing the Marketing CRM with these drafts

1. In RENUABL's own business: Marketing → Campaigns → **Add the drafts**. The launch campaign and the series appear, pictures in.
2. Open the launch: **Builder | Preview**, check the picture, headline and button. Press **Send a test**: it goes to you, marked [Test], no tracking.
3. Make a list of only your own addresses (Gmail and Outlook), express consent, and send the launch to it by typing SEND.
4. Open it in each inbox; the series starts for an address that opened it once you **switch the sequence on**. With waits of a few working days, set the first wait to 0 for the test, then put it back.
5. Click a button, unsubscribe from one copy, and check each report: sent, opened, clicked, unsubscribed.
