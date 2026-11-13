/**
 * Updates: what has changed in RENUABL, a day a row, newest first, each change in a few words with where it applies
 * (1 Nov 2026, Martin: Primero's copied across, wave 7). Written by hand: add a line here with each change someone
 * using the product would notice, in plain words, never a file or function name. Everyone sees the same list; a count
 * on the gear says how many came in since that person last opened it. Pure, tested.
 */
import type { ISODate } from "../types";

export interface Update {
  day: ISODate;
  area: string;
  words: string;
}

export const UPDATES: readonly Update[] = [
  {
    day: "2026-11-13",
    area: "Calls",
    words: "Your chief of staff always speaks in a different voice from your phone assistant, and can't take its name, so nobody takes the two for the same person.",
  },
  {
    day: "2026-11-13",
    area: "Calls",
    words: "Search a contact at the top of your assistant's chat, then call them or send them a text from there.",
  },
  {
    day: "2026-11-13",
    area: "Calls",
    words: "Your team's own voice assistant, a chief of staff: call it from the app (or ring the team line with your PIN) and ask about your deals. Customers never reach it.",
  },
  {
    day: "2026-11-13",
    area: "Calls",
    words: "Until you give your phone assistant a picture, it shows as a sound wave in a colour of its own, in place of a letter.",
  },
  {
    day: "2026-11-13",
    area: "Calls",
    words: "Hang up on your assistant's call from its call window, if it says something you don't agree with.",
  },
  {
    day: "2026-11-13",
    area: "Calls",
    words: "Your assistant answers in short bubbles, one point each, and its chat can be minimised and sits beside its call window.",
  },
  {
    day: "2026-11-13",
    area: "Calls",
    words: "The cog in your assistant's chat opens its settings beside it: Voice, and Script, everything it has been told to say.",
  },
  {
    day: "2026-11-13",
    area: "Calls",
    words: "Change your phone assistant's picture, name and voice from its chat: the pencil on its face, or just ask it.",
  },
  {
    day: "2026-11-13",
    area: "Everywhere",
    words: "The round at the top right is now a settings cog, in place of your initials.",
  },
  {
    day: "2026-11-12",
    area: "Calls",
    words: "Talk to your phone assistant from its face on the rail: tell it what to say and how, and it keeps your notes for every call.",
  },
  {
    day: "2026-11-12",
    area: "Designer",
    words: "When a panel is shaded, Sol lists your options: an optimiser on it, rewiring the string, moving it or taking it off.",
  },
  {
    day: "2026-11-12",
    area: "Calls",
    words: "Read the transcript of a call from the deal timeline, under the call: your assistant's calls and yours from the computer.",
  },
  {
    day: "2026-11-12",
    area: "Designer",
    words: "When a panel is shaded, Sol lists your options: an optimiser on it, rewiring the string, moving it or taking it off.",
  },
  {
    day: "2026-11-12",
    area: "Team chat",
    words: "Drag team chat's window from its left edge, foot or corner, and its list of conversations from its edge, so long names show.",
  },
  {
    day: "2026-11-12",
    area: "Deals",
    words: 'Sol\'s design requests are short now: "Call with Michelle complete. Design required." What they said is behind Why.',
  },
  {
    day: "2026-11-12",
    area: "Calls",
    words: "While your assistant is on a call, the window pulses and its clock is lit; type to tell it an answer or what to mention.",
  },
  {
    day: "2026-11-12",
    area: "Calls",
    words: "Hand a call to your phone assistant from Call and watch it: its face, how long the call has run and what's said, live.",
  },
  {
    day: "2026-11-12",
    area: "Calls",
    words: "Call a customer from your computer through a headset, with Mute and Hang up; the call is recorded and played back on the deal.",
  },
  {
    day: "2026-11-12",
    area: "Designer",
    words: "No more block tray: once the panel is chosen your pointer lays panels, and Sol counts down how many until the target.",
  },
  {
    day: "2026-11-12",
    area: "Calls",
    words: "Call on a deal or a Today card asks who calls: you, you with the note-taker, or your phone assistant.",
  },
  {
    day: "2026-11-12",
    area: "Designer",
    words:
      "Roof faces are no longer read by themselves: trace them by hand. A block of panels tapped anywhere is laid there to move into place.",
  },
  {
    day: "2026-11-12",
    area: "Calls",
    words: "Pick your phone assistant's voice in Settings, an Australian one included, and ring your own mobile to hear it.",
  },
  {
    day: "2026-11-12",
    area: "Designer",
    words: "Sol asks whether existing panels are being replaced or worked around, and the battery can be any size you type.",
  },
  {
    day: "2026-11-12",
    area: "Calls",
    words:
      "Name your phone assistant and give it a picture in Settings. Calls on a deal lead with what came of them; a booked call shows its time.",
  },
  {
    day: "2026-11-12",
    area: "Designer",
    words: "When Sol can't string every panel, he says why and offers an inverter with more inputs, taking them off, or stringing by hand.",
  },
  {
    day: "2026-11-12",
    area: "Designer",
    words: "Sol asks for the bill or a system size; the battery sizes itself, and the 3 free hours can make a second design.",
  },
  {
    day: "2026-11-12",
    area: "Deals",
    words:
      "A deal has one menu down the left: Design, Proposal, Call, Email, Notes and Files; the job card once sold, service once installed.",
  },
  {
    day: "2026-11-12",
    area: "Today",
    words: "New in lists the leads waiting for a design, each with Design; Needs you is for deals whose proposal has gone out.",
  },
  {
    day: "2026-11-11",
    area: "Designer",
    words: "Sol leads a new design: the home, the size from the bill, the panel, placing, inverter, strings, battery and backup.",
  },
  {
    day: "2026-11-11",
    area: "Today",
    words:
      "New in shows who arrived this week and whether anyone has called. Owners see a line per salesperson and choose who new leads go to.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "A roof opens on Nearmap where it has one, its faces read and offered to confirm before any panel goes down.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "Panels come as blocks to place: pick a block, see where it lands on a face, tap to lay it. Resize, split or join them.",
  },
  {
    day: "2026-11-10",
    area: "Jobs",
    words: "CRM, Procurement and Installation are one menu, Jobs: every job by stage, Selling to Done, as a list, board, calendar or map.",
  },
  {
    day: "2026-11-10",
    area: "Today",
    words:
      "Today is one page: what needs you, what Sol does next, what is in hand, and the industry news. Each deal says what it needs once.",
  },
  {
    day: "2026-11-10",
    area: "Installation",
    words:
      "The install calendar breathes: each week's booked and can-do sits in its own row, reminders are a bell, and the month sits under the title.",
  },
  {
    day: "2026-11-10",
    area: "Team chat",
    words: "The bell is gone: customers' messages and your mentions are under Customers, a switch at the top of team chat.",
  },
  {
    day: "2026-11-10",
    area: "Installation",
    words:
      "Click a day on the install calendar to add a tentative install, a day off or a note. Tentative installs show on the week's capacity.",
  },
  {
    day: "2026-11-10",
    area: "Installation",
    words: "The install calendar fits the whole month in view: one toolbar row, a slimmer capacity strip and shorter days.",
  },
  {
    day: "2026-11-10",
    area: "Customers",
    words: "A Compact switch on Customers and Contacts: each person on one line, so many more fit on the screen.",
  },
  {
    day: "2026-11-10",
    area: "Job card",
    words: "The job card is titled by what is installed (solar kW, battery kWh) with the address, the drawings top right.",
  },
  {
    day: "2026-11-10",
    area: "Deals",
    words: "Sol on a deal opens with the box in view: the suggested questions are gone.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "On a Nearmap picture the roof's pitch is read from Nearmap's heights: by itself on a new roof, or from the pitch mark.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "The day now plays in a low bar along the foot of the roof picture, so the roof and the sun stay in view.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "Before laying panels on a home that has some, Sol asks whether they are being replaced or added to.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "Show me where: tap a roof face and it fills with the panels Sol sized, face by face.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "A Day button plays a design through a summer, autumn or winter day: the sun across the roof, the battery filling and emptying.",
  },
  {
    day: "2026-11-10",
    area: "Proposals",
    words: "A proposal's output now shows a day with the system, hour by hour, for the system the customer is looking at.",
  },
  {
    day: "2026-11-10",
    area: "Menu",
    words: "The menu at the top is one tidy white bar, and the place you are in is lit in black with orange words.",
  },
  {
    day: "2026-11-10",
    area: "Today",
    words: "A News tab: each morning Sol reads the solar industry's news and says what each story means for you, with its source.",
  },
  {
    day: "2026-11-10",
    area: "Today",
    words: "News has more stories each day, new products among them, with a picture on each and a mark for confirmed or rumoured.",
  },
  {
    day: "2026-11-10",
    area: "Today",
    words: "News reports recalls, approved-list changes and maker notices, and says which of your customers' systems they touch.",
  },
  {
    day: "2026-11-10",
    area: "Today",
    words: "Saving a supplier price list shows on the News tab what went up and down since your last prices.",
  },
  {
    day: "2026-11-10",
    area: "Today",
    words: "News stories each carry a picture, or a drawn one for their topic, and stand apart from posts so the feed is easy to scan.",
  },
  {
    day: "2026-11-10",
    area: "Today",
    words: "Post to every business on RENUABL from the News tab: words, a photo or a link, with likes, comments and Report.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "Photo or Drawn, bottom right of the roof picture: Drawn shows the roof as a drawing, panels as panels and the kit on its wall.",
  },
  {
    day: "2026-11-10",
    area: "Today",
    words: "Today is tidier: a new deal is the orange + beside the tabs, and whose deals and which pipeline are one menu.",
  },
  {
    day: "2026-11-10",
    area: "Deals",
    words:
      "A deal's banner shows its panels, battery, inverter and charger as icons with their sizes. Details and Activity keep their tabs at the top.",
  },
  {
    day: "2026-11-10",
    area: "Deals",
    words: "A deal's banner shows the system in figures beside its roof. On wide screens its tools and pages sit down either side.",
  },
  {
    day: "2026-11-10",
    area: "Deals",
    words: "A deal's Call sits beside Email in its tabs, with the note-taker inside it. Sol is his own round there too.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "The kit rounds at the top light up when on the design, showing the inverter's kW and battery's kWh. No parts line under them.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "In the designs menu, New design is orange and each design's label sits in its own card.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "Design it for me puts the whole system on one roof face when one holds it, east or west as well as north.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "The inverter and battery go on the home's own south wall, not on the house next door.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "Sol's panel closes with its cross, Escape or a press on the map; Ask Sol brings it back as you left it.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "Pergolas, clear roofs and the house next door are left off when the roof's faces are read.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "Did you know? tips point out quicker ways as you design. The lightbulb switches them off.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "When one face holds every panel, Sol offers to split some onto a face looking another way.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words: "Sol's calculator puts in the solar size for the home's use, and says why. Type over it to use your own.",
  },
  {
    day: "2026-11-10",
    area: "Designer",
    words:
      "The corner button now opens your designs: start a new one, copy one or publish. Under the kit, the make and model on the design.",
  },
  {
    day: "2026-11-09",
    area: "Designer",
    words: "When the sunnier roof is full, panels go on the south side too. Faces look wrong? Ask Sol to read the roof again.",
  },
  {
    day: "2026-11-09",
    area: "Designer",
    words: "A Sides button beside Google and Nearmap shows the house in Nearmap's angled photos, from the north, east, south and west.",
  },
  {
    day: "2026-11-09",
    area: "Designer",
    words: "Panels fill more of an awkwardly shaped roof face, and a roof outline left from an earlier try is read into its faces again.",
  },
  {
    day: "2026-11-09",
    area: "Design tool",
    words: "Click an inverter, battery, switchboard or EV charger on the roof to pick it; Remove (or Delete) takes it off.",
  },
  {
    day: "2026-11-09",
    area: "Designer",
    words: "Existing panels being replaced? Say so and their roof is used. Open roof past them is used too, and Sol shows he's working.",
  },
  {
    day: "2026-11-09",
    area: "Designer",
    words: "Nearmap's angled photos replace the 3D view, which wasn't sharp enough to be of use.",
  },
  {
    day: "2026-11-09",
    area: "Deals",
    words: "A new deal asks what they're interested in: Solar, Battery, EV charger, any together, or something else.",
  },
  {
    day: "2026-11-09",
    area: "Designer",
    words: "On a Nearmap picture, Design it for me reads the roof's faces from Nearmap's heights, each with its own pitch and direction.",
  },
  {
    day: "2026-11-09",
    area: "Designer",
    words: "Sol speaks first on a new roof: a system from what they use, or what it should achieve. Plus a calculator in his box.",
  },
  {
    day: "2026-11-09",
    area: "Designer",
    words: "Ask Sol can delete a design for you. He asks first, and nothing goes until you say yes.",
  },
  {
    day: "2026-11-09",
    area: "Designer",
    words: "Design it for me looks for panels, vents and skylights already on the roof first, keeps clear of them and marks them.",
  },
  {
    day: "2026-11-09",
    area: "Designer",
    words: "On a Nearmap picture, traced roof faces and the shade analysis use Nearmap's newer heights, and say when they were measured.",
  },
  {
    day: "2026-11-09",
    area: "Designer",
    words:
      "Ask Sol now sees the design's price, costs and payback, so he can say how to bring the payback down. His box is black and rises from Sol.",
  },
  {
    day: "2026-11-09",
    area: "Today",
    words: "A deal that needs you has Done and Later. Needs you counts down as you clear it, and at zero says what you got done today.",
  },
  {
    day: "2026-11-09",
    area: "Today",
    words: "The pipeline has a New deal button, and the pipeline picker on the feed opens wherever you press it.",
  },
  {
    day: "2026-11-08",
    area: "Designer",
    words: "Ask Sol to add a battery or storage and he picks the inverter maker's battery, stacked to what the home needs.",
  },
  {
    day: "2026-11-08",
    area: "Sol",
    words: "When Sol offers a few ways forward, they come as a card of numbered choices: press one, or type something else.",
  },
  {
    day: "2026-11-08",
    area: "Today",
    words: "Filter your deals on Today by pipeline, and show everyone's or only yours.",
  },
  {
    day: "2026-11-08",
    area: "Installation",
    words:
      "Grid connections lists installed, inspected jobs to connect, with the retailer and distributor. The distributor fills in from the address.",
  },
  {
    day: "2026-11-08",
    area: "Deals",
    words:
      "Every email sent from a deal is listed under its Email box, with whether the customer opened it. Your team opening it never counts.",
  },
  {
    day: "2026-11-08",
    area: "Everywhere",
    words: "Search sits beside the RENUABL wordmark, and the calculator is on the bar down the right, under team chat.",
  },
  {
    day: "2026-11-08",
    area: "Deals",
    words: "A deal's Email tab has its lists, symbols, pictures and files along the bottom of the message box.",
  },
  {
    day: "2026-11-08",
    area: "Email",
    words: "Sol's summary of an email reads at a glance: the takeaway first, then the next step in a box of its own.",
  },
  {
    day: "2026-11-08",
    area: "Everywhere",
    words: "A calculator by the search: sums, and a bill or a day's use turned into a rough solar and battery size at once.",
  },
  {
    day: "2026-11-08",
    area: "Everywhere",
    words: "CRM sits in the menu again; procurement, installation and service stay folded behind the layers icon.",
  },
  {
    day: "2026-11-08",
    area: "Sol",
    words: "New chat at the top of Sol's panel starts afresh in one press; the last conversation is kept in Past conversations.",
  },
  {
    day: "2026-11-08",
    area: "Email",
    words: "Compact, beside Refresh, makes the inbox smaller so you see more emails at once. It stays as you left it.",
  },
  {
    day: "2026-11-08",
    area: "Today",
    words: "Today's first tab is Deals, with Sol's mark. Calls beside it logs Sol's phone calls and the ones your team logs on a deal.",
  },
  {
    day: "2026-11-08",
    area: "Deals",
    words:
      "New deal starts on someone new, with a way to find an existing customer you are selling to again. On Today it sits at the left.",
  },
  {
    day: "2026-11-08",
    area: "Today",
    words: "Type in a deal's team chat on Today and it opens larger over the page, headed by the deal, its address and roof.",
  },
  {
    day: "2026-11-08",
    area: "Today",
    words: "The box at the foot of Your deals is gone: ask Sol in a deal's chat or from his round. Show me my day sits by the greeting.",
  },
  {
    day: "2026-11-08",
    area: "Email",
    words:
      "New emails take pictures and files (paste a screenshot in), links and a text size. Polish tidies the words; Sol writes it for you.",
  },
  {
    day: "2026-11-08",
    area: "Deals",
    words: "Proposals sent and Proposals signed are on the bar down the right: a paper plane, and a proposal with a tick.",
  },
  {
    day: "2026-11-08",
    area: "Deals",
    words: "A deal opens on Activity, with the deal at a glance above its record. Team chat, Sol, files and the job card are icons.",
  },
  {
    day: "2026-11-08",
    area: "Installation",
    words: "The install calendar, Upcoming and In the works are one Installations page, shown as a calendar or a list.",
  },
  {
    day: "2026-11-08",
    area: "Installation",
    words:
      "After install takes each installed job through four steps in order: invoice, follow up the CoES, claim the STCs, raise the grid connection.",
  },
  {
    day: "2026-11-08",
    area: "Deals",
    words: "A deal's system reads at a glance: the home first, then solar, inverter and battery a line each with how many and the size.",
  },
  {
    day: "2026-11-08",
    area: "Email",
    words: "Write a new email from the inbox with Compose (or press C). It goes through your own Gmail and lands in your Sent.",
  },
  {
    day: "2026-11-08",
    area: "Today",
    words: "Each deal card lights the one thing to do now: reply, review, design, send the proposal, call or book. The rest go quiet.",
  },
  {
    day: "2026-11-08",
    area: "Today",
    words: "Review Sol's email on the card: change it, send now, put it off an hour or to tomorrow at 9, hold it, or don't send it.",
  },
  {
    day: "2026-11-08",
    area: "Today",
    words: "New deal is on Today, and each card has a Deal button in place of Open.",
  },
  {
    day: "2026-11-08",
    area: "Service",
    words:
      "Start a new service case with the + by the cases, or ask Sol: a card finds the deal as you type. Sol on Service keeps to its own chat.",
  },
  {
    day: "2026-11-08",
    area: "Everywhere",
    words: "The section you're in is now marked in orange in the menu at the top.",
  },
  {
    day: "2026-11-08",
    area: "Sol",
    words: "Sol's questions can be answered where they are: Yes or No in one press, or Reply to answer one from earlier in the chat.",
  },
  {
    day: "2026-11-08",
    area: "Design tool",
    words: "The quote stays open until you go back to the design. Its lines run down one side and scroll in their own box.",
  },
  {
    day: "2026-11-08",
    area: "Design tool",
    words: "What needs deciding on the quote sits beside the lines: roof, storeys, phase, Solar Victoria and costs decided on each job.",
  },
  {
    day: "2026-11-08",
    area: "Today",
    words: "The first tab on Today is now Your deals, and the RENUABL logo lines up with the menu beside it.",
  },
  {
    day: "2026-11-08",
    area: "Sol",
    words: "Ask Sol to fix a product's datasheet and he finds, reads and swaps it himself, Australian sheet first, marked to check.",
  },
  {
    day: "2026-11-08",
    area: "Calls",
    words: "The note-taker sums up the call as it listens, then sorts the points for the design, proposal and price when you finish.",
  },
  {
    day: "2026-11-08",
    area: "Today",
    words: "Each deal's team chat is its own card beside it. Tell Sol what to write in the card's field, and Call opens the note-taker.",
  },
  {
    day: "2026-11-08",
    area: "Proposals",
    words:
      "A proposal with a battery opens on the battery: your customer's evenings laid over the roof, or their home's day when it's a battery alone.",
  },
  {
    day: "2026-11-08",
    area: "Proposals",
    words:
      "A deal's proposal opens in the same window as the designer, from the deal, its card on Today or the menu, and you can switch between them.",
  },
  {
    day: "2026-11-08",
    area: "Designer",
    words:
      "The designer opens as a window in the middle of the page, from a deal, Today or anywhere else, and closes back to where you were.",
  },
  {
    day: "2026-11-08",
    area: "Design tool",
    words: "Save (or Ctrl+S) and Make primary are in the bar. The side panel tucks away: hover the tab on the right.",
  },
  {
    day: "2026-11-08",
    area: "Team chat",
    words: "Deal chats you follow are in the team chat window too, with their unread. Press # there to open any deal's chat.",
  },
  {
    day: "2026-11-08",
    area: "Deals",
    words: "A deal's design is its first tab, the orange round: the roof opens right there in the deal.",
  },
  {
    day: "2026-11-08",
    area: "Design tool",
    words: "With Select, point just past a panel's edge to see the next one: click to add it, or drag for a row.",
  },
  {
    day: "2026-11-08",
    area: "Deals",
    words: "A deal's call button opens the note-taker: ring the customer from your phone while it listens and writes up the call.",
  },
  {
    day: "2026-11-08",
    area: "Deals",
    words:
      "A deal opens on its roof: the design across the top with the customer over it, and the tabs underneath. Its fields are under Details.",
  },
  {
    day: "2026-11-08",
    area: "Menu",
    words:
      "CRM, Procurement, Installation and Service fold behind the layers button at the top. Rest on it to open them, or pin them open.",
  },
  {
    day: "2026-11-08",
    area: "Deals",
    words:
      "Every deal has a team chat, beside its card on Today and on its Team tab. Sol leaves notes there and asks for help, like a design.",
  },
  {
    day: "2026-11-07",
    area: "Today",
    words:
      "Today opens on your deals as a live feed. Write to a customer with Sol, have Sol call, or bring in a teammate, right on the card.",
  },
  {
    day: "2026-11-06",
    area: "Deals",
    words: "A deal opens on a card of who it's for, each line changed where it is. Service is the spanner at the end of the tabs.",
  },
  {
    day: "2026-11-06",
    area: "Sol",
    words: "Try another answer under Sol's latest reply, and ask him to take you to a page, a deal or a design.",
  },
  {
    day: "2026-11-06",
    area: "Sol",
    words: "Sol's draft emails are changed and sent from his card, with Cc, also on a deal's Email tab.",
  },
  {
    day: "2026-11-06",
    area: "Deals",
    words: "Email opens count only the customer's, and each email says how many times it was opened.",
  },
  {
    day: "2026-11-06",
    area: "Messages",
    words: "In a customer's chat, copy or reply to a message, tell Sol what to write, and keep your own unread count.",
  },
  {
    day: "2026-11-06",
    area: "Design tool",
    words: "Unsaved designs are kept as a draft and open where you left off; star products to keep them at the top.",
  },
  {
    day: "2026-11-06",
    area: "Design tool",
    words: "Add an EV charger from your price lists to a design, and the kit is drawn smaller on the roof.",
  },
  {
    day: "2026-11-06",
    area: "Team chat",
    words: "Ask @Sol to move an install, add to an order or mark a stage, and he answers with a Yes or No card.",
  },
  {
    day: "2026-11-06",
    area: "Today",
    words: "To action has coloured pills, a customer search and Work through; the top bar makes room on narrow windows.",
  },
  {
    day: "2026-11-05",
    area: "Proposals",
    words:
      "An email or chat reply to the customer counts as the follow-up due; Sol drafts follow-ups only once a proposal has reached them.",
  },
  {
    day: "2026-11-05",
    area: "Sol",
    words: "Sol always answers in words after checking something, and answers each of a customer's questions in its own paragraph.",
  },
  {
    day: "2026-11-05",
    area: "Deals",
    words: "The call note-taker keeps a neighbour's home or a past job off this customer's system, and lists anything unclear to check.",
  },
  {
    day: "2026-11-05",
    area: "Design tool",
    words: "The designer slides over the page you're on as a drawer, so you're back where you were the moment it's done.",
  },
  {
    day: "2026-11-05",
    area: "Today",
    words: "Each Sol on the pipeline says what it does, with an on and off switch, and sends in business hours.",
  },
  {
    day: "2026-11-05",
    area: "Sol",
    words:
      "Sol's answers read at a glance: short paragraphs, round bullets, key points and questions highlighted. Speak or attach on Today.",
  },
  {
    day: "2026-11-05",
    area: "Today",
    words: "Sol welcomes you on your first visit: connect email and calendar, add your team as Admin or User, then a quick tour.",
  },
  {
    day: "2026-11-05",
    area: "Your account",
    words: "Your first sign-in asks your name, so Today greets you properly. You can set a password there too, to sign in with next time.",
  },
  {
    day: "2026-11-05",
    area: "Design tool",
    words:
      "On a Nearmap picture, the roof's outline can go down as a face to check (right-click the picture), with panels laid on a flat roof.",
  },
  {
    day: "2026-11-05",
    area: "Email",
    words:
      "Opening an email marks it read in Gmail, and you can archive it or mark it unread here. Connected before today? Connect it again once.",
  },
  {
    day: "2026-11-05",
    area: "Billing",
    words:
      "A new retailer chooses its users and pays for its plan right after signing in. Your first month is $29 a user, and you can cancel any time.",
  },
  {
    day: "2026-11-05",
    area: "Email",
    words: "Connect more than one Gmail, say your own and sales@, and read them as one inbox. Inbox is also a tab on Today.",
  },
  {
    day: "2026-11-05",
    area: "Everywhere",
    words:
      "Press the date in the top corner to see your calendar. Connect Google Calendar or Outlook in one press, without leaving the page.",
  },
  {
    day: "2026-11-05",
    area: "Today",
    words: "Sol at work on each stage of the Pipeline board: see what he has lined up, and when each email goes.",
  },
  {
    day: "2026-11-05",
    area: "Today",
    words: "On the Pipeline board, an envelope shows a deal has been emailed, with an eye on it once the latest email is opened.",
  },
  {
    day: "2026-11-03",
    area: "Design tool",
    words: "The three designs follow the bill: change it and they are made again for it, unless you have changed them by hand.",
  },
  {
    day: "2026-11-03",
    area: "Everywhere",
    words:
      "The top bar is cleaner: the menu sits in the middle, Settings is under your profile, and notifications and email are on the right.",
  },
  {
    day: "2026-11-03",
    area: "Sol",
    words:
      "Ask Sol to show you a deal's roof design and he draws it in the chat: the panel layout and strings on the roof photo, with Open the design.",
  },
  {
    day: "2026-11-03",
    area: "Marketplace",
    words:
      "The Marketplace has its own menu from a blue home, and a look inside before it opens: job listings, buy and sell, find partners.",
  },
  {
    day: "2026-11-03",
    area: "Today",
    words: "Today is one conversation with Sol: press Show me my day and he writes it up for you, then answers your questions below.",
  },
  {
    day: "2026-11-03",
    area: "Design tool",
    words: "A pitch for each roof: add a garage or patio at its own angle; the pitch card is smaller and you can type the figure.",
  },
  {
    day: "2026-11-03",
    area: "Design tool",
    words: "Panels and inverters with no datasheet figures: RENUABL finds the datasheet online, reads it and marks it to check.",
  },
  {
    day: "2026-11-03",
    area: "Everywhere",
    words: "RENUABL Marketplace has its own blue button beside the sections, and Sol a new mark: a sun, with the AI's stars above it.",
  },
  {
    day: "2026-11-03",
    area: "Design tool",
    words: "Nearmap pictures in the designer: choose a capture date, fetch it once, and see what your plan includes at the roof.",
  },
  {
    day: "2026-11-03",
    area: "My Jobs",
    words: "Installers open on My Jobs: today, tomorrow, this week or this month, each job with its roof, the kit and where to collect it.",
  },
  {
    day: "2026-11-03",
    area: "Marketplace",
    words: "Equipment trading is now Buy & sell, and Messages gathers every conversation you have with other businesses.",
  },
  {
    day: "2026-11-02",
    area: "Design tool",
    words: "Designing a large roof no longer freezes the page: laying panels on hundreds of roof spots now takes a moment.",
  },
  {
    day: "2026-11-02",
    area: "Deals",
    words: "Emails to customers take bullets, numbering, symbols, pictures and files. Paste a screenshot or drop it on the box.",
  },
  {
    day: "2026-11-02",
    area: "Sol",
    words: "Sol's side panel sees the page beside it: ask about the design or deal you have open. Press Looking at to leave it out.",
  },
  {
    day: "2026-11-02",
    area: "Sol",
    words: "Drag the left edge of Sol's panel to make it wider or narrower; double-click it to reset.",
  },
  {
    day: "2026-11-02",
    area: "Settings",
    words:
      "An installer's Billing is design jobs only: the jobs left, buying a pack, its tax invoices and billing details, no plan or users.",
  },
  {
    day: "2026-11-02",
    area: "Today",
    words: "An installer's and an inspector's Today now says what waits: jobs to answer, inspections to book and requests to connect.",
  },
  {
    day: "2026-11-02",
    area: "Design tool",
    words: "For installers the design tool is for sites: no deal search, publishing or proposals, and a job card no longer asks your name.",
  },
  {
    day: "2026-11-02",
    area: "Design tool",
    words: "Share live: the customer watches their roof designed on their phone during the call, switches designs and picks one.",
  },
  {
    day: "2026-11-02",
    area: "Design tool",
    words: "Publishing a site with no deal now says why and puts the design on a deal from the Publish button.",
  },
  {
    day: "2026-11-02",
    area: "Marketplace",
    words: "Installers bid on job listings and inspectors trade equipment; a bid won by an installer lands in its Jobs as the job card.",
  },
  {
    day: "2026-11-02",
    area: "Installation",
    words: "Installers nominate the inspector: they see the design and photos, then book, pass or note defects, with the certificate.",
  },
  {
    day: "2026-11-02",
    area: "Installation",
    words: "Send a job to an installer you're connected with: it waits in their Jobs, and once they accept they see its job card.",
  },
  {
    day: "2026-11-02",
    area: "Connections",
    words: "Find the installers and inspectors you work with and connect, like a friend request. Listing your business is up to you.",
  },
  {
    day: "2026-11-02",
    area: "Design tool",
    words: "Keyboard shortcuts: a key for each tool, arrows to nudge, Ctrl+A for every panel, and ? to see them all.",
  },
  {
    day: "2026-11-02",
    area: "Installation",
    words: "As built on the job card: the installer records what went on the roof with every serial, held against the design.",
  },
  {
    day: "2026-11-02",
    area: "Design tool",
    words: "A photo of the switchboard: Sol reads it and suggests the switchboard upgrade and RCBO, put on the quote in one press.",
  },
  {
    day: "2026-11-02",
    area: "Design tool",
    words: "The bill box reads a photo or PDF of the customer's bill, then one press sizes the system to it.",
  },
  {
    day: "2026-11-02",
    area: "Design tool",
    words:
      "Ask Sol to change it (press /): type or say “fit 8 kW on the north face”, “use the Sigenergy battery”, “why is string B failing?”",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "A new roof designs itself as it opens: the three designs are ready to check, unless Google's roof data is out of date.",
  },
  {
    day: "2026-11-01",
    area: "Sol",
    words: "Sol searches the web for networks, rebates, approvals, products and wholesalers, with a sources icon under each answer.",
  },
  {
    day: "2026-11-01",
    area: "Sol",
    words: "Sol keeps what he finds for the whole team, with its sources: see What Sol knows on his page, or press Remember this.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "A Ready to install light in the bar: green only when the design would pass, with what to fix and a button to each.",
  },
  {
    day: "2026-11-01",
    area: "Sol",
    words: "Ready for you on Today: Sol drafts each proposal follow-up as it falls due, ready to check and send in one press.",
  },
  {
    day: "2026-11-01",
    area: "Deals",
    words: "After a call, one press adds the notes, fills in the deal's fields, sets your reminder and drafts the recap email.",
  },
  {
    day: "2026-11-01",
    area: "Sol",
    words: "Past conversations behind the clock in Sol's chat; after a while away he asks whether to carry on or start afresh.",
  },
  {
    day: "2026-11-01",
    area: "Proposals",
    words:
      "Customers can pay their deposit and each payment milestone by card from their proposal, once you connect your own Stripe account.",
  },
  {
    day: "2026-11-01",
    area: "Settings",
    words: "Billing shows your Sol credits, every invoice as a tax invoice to download, and the business details printed on them.",
  },
  {
    day: "2026-11-01",
    area: "Settings",
    words: "A Standards library: upload the standards you've bought (AS/NZS 3000, 3008, 5139 and more) for your whole team to download.",
  },
  {
    day: "2026-11-01",
    area: "Sol",
    words: "Sol helps with the electrical rules, names the clause to look up in your copy, and reads your datasheets' figures.",
  },
  {
    day: "2026-11-01",
    area: "Settings",
    words: "Product datasheets now keep the sheet itself, for anyone in your team to open again.",
  },
  {
    day: "2026-11-01",
    area: "Sol",
    words: "Sol has a new mark and his own round at the end of the sections; the search asks him too, and on a phone he's mid-bar.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "A landscape panel clicks flush against a portrait one (and back), the shared edge lit; a joined panel faces its array's way.",
  },
  {
    day: "2026-11-01",
    area: "Quotes",
    words:
      "Switchboard, RCBO and a battery's bollard, fire sheeting and awning are decided on each job; left out, the proposal says they may apply.",
  },
  {
    day: "2026-11-01",
    area: "Proposals",
    words: "Up to ten designs a roof; offer up to four beside the primary as options, and mark the one you recommend.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "A new home: one bar for a deal or an address, the orange + for a new design, Up next on its roof, and the queue as roof cards.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "The bill box takes kWh as well as dollars, and Sol can find the customer's usage in their file.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "The customer's name in the bar opens their deal; a chat round lights orange while the customer is waiting.",
  },
  {
    day: "2026-11-01",
    area: "Proposals",
    words: "Send a new lead an indicative proposal: systems to compare, a site visit, then the final one. They reply in the chat.",
  },
  {
    day: "2026-11-01",
    area: "Proposals",
    words: "Sol can answer customers in their proposal's chat as they write, saying he's an AI (Settings, Emails).",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words:
      "The figures over the picture are three boxes: Solar, Battery, and For this home, which stays red until the customer's bill is in.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words:
      "Panels let go near a traced roof edge or guide line turn square to it and sit clear of it; a new array offers its tilt to change or keep.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "Opens zoomed in on the roof; the hand drags the picture at any zoom; model numbers in the panel, inverter and battery lists.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "A new site asks for the roof pitch first (or that it is flat), then keeps it as a small mark on the picture to change.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "Add a panel opens a card: portrait, landscape, or follow the roof face.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "The whole roof picture fits on the screen, and scrolling moves the page: hold Ctrl (⌘ on a Mac) to zoom.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "Designer, Quote and Proposal sit at the top of the column beside the picture; right click the picture for every tool.",
  },
  {
    day: "2026-11-01",
    area: "Sol",
    words: "Copy or pin any message in Sol's chat; pinned ones stay at the top and through Clear.",
  },
  {
    day: "2026-11-01",
    area: "Everywhere",
    words: "The design tool is an orange button in the top bar, and search is the round magnifier beside it.",
  },
  {
    day: "2026-11-01",
    area: "Marketplace",
    words: "Equipment: sell spare panels, inverters and batteries to other businesses, or buy theirs, and message about it.",
  },
  {
    day: "2026-11-01",
    area: "Marketplace",
    words: "Job listings: list a sold job for installers to bid on, or bid on jobs near you.",
  },
  {
    day: "2026-11-01",
    area: "Email",
    words: "Your own Gmail inbox in RENUABL: each email with its customer's deal, private notes, and Sol to sum up or draft a reply.",
  },
  {
    day: "2026-11-01",
    area: "Deals",
    words: "The note-taker: listens to your side of a call and writes up the notes for the deal.",
  },
  {
    day: "2026-11-01",
    area: "Users",
    words: "View as: the owner sees RENUABL exactly as someone in the team does, read only.",
  },
  {
    day: "2026-11-01",
    area: "Settings",
    words: "Updates and Feedback, under the gear: what's new, and a place to raise ideas and issues.",
  },
  {
    day: "2026-11-01",
    area: "Procurement",
    words: "Pre-approvals, Solar Victoria and Book an installation: every sold job at the approval it's waiting on.",
  },
  {
    day: "2026-11-01",
    area: "Installation",
    words: "The install calendar shows the next six weeks booked against what you can do.",
  },
  {
    day: "2026-11-01",
    area: "Installation",
    words: "Job cards: the system, layout and strings for each install, emailed to your installer with a link for their phone.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "A design home: deals waiting for a design, designs done this week, recent designs.",
  },
  {
    day: "2026-11-01",
    area: "Design tool",
    words: "Designer, Quote and Proposal beside the roof, with a timeline of every proposal sent.",
  },
  {
    day: "2026-11-01",
    area: "Users",
    words: "A Designer role: sees every deal, designs and publishes, no settings.",
  },
  {
    day: "2026-11-01",
    area: "Customers",
    words: "Customers and contacts apart, with solar, battery and EV marks, and a group email with unsubscribe.",
  },
  {
    day: "2026-11-01",
    area: "Deals",
    words: "The deal clock and hot, warm or cold with reasons; email opens; attachments on each deal.",
  },
  {
    day: "2026-11-01",
    area: "Today",
    words: "Today: up first, before you call, to action, a calendar and your pipeline in one pad.",
  },
  {
    day: "2026-11-01",
    area: "Team chat",
    words: "Team chat: channels and direct messages, deal cards, files, and @Sol.",
  },
  {
    day: "2026-11-01",
    area: "Sol",
    words: "Sol, your assistant: finds deals, drafts emails, keeps reminders, draws charts.",
  },
  {
    day: "2026-10-31",
    area: "Everywhere",
    words: "A new look: sections across the top, search with Ctrl K, and every page on one pad.",
  },
];

/** The days, newest first, each with its changes. */
export function updatesByDay(list: readonly Update[] = UPDATES): { day: ISODate; items: Update[] }[] {
  const days = [...new Set(list.map((u) => u.day))].sort((a, b) => b.localeCompare(a));
  return days.map((day) => ({ day, items: list.filter((u) => u.day === day) }));
}

/** How many changes came in after the day someone last opened Updates; never opened, the newest day's. */
export function unseenUpdates(seenDay: ISODate | null, list: readonly Update[] = UPDATES): number {
  if (!list.length) return 0;
  if (!seenDay) {
    const newest = list.reduce((d, u) => (u.day > d ? u.day : d), list[0].day);
    return list.filter((u) => u.day === newest).length;
  }
  return list.filter((u) => u.day > seenDay).length;
}

/** The newest day on the list: what opening Updates marks as seen. */
export const newestDay = (list: readonly Update[] = UPDATES): ISODate | null =>
  list.length ? list.reduce((d, u) => (u.day > d ? u.day : d), list[0].day) : null;
