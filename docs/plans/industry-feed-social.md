# The industry feed as RENUABL's social network

16 Nov 2026. Martin asked for news beside solar that people would enjoy (Tesla, driverless cars), a more engaging feed, the
feed as an internal social network, and room for advertising later.

## Built (16 Nov 2026)

- **Beyond solar.** Sol does a second, lighter reading each morning (the cron at 19:30 UTC, half an hour after the solar
  one; the tab catches up when either is missed): **EVs and driving** (Tesla, EV launches and prices, charging,
  driverless cars and robotaxis), **Clean energy** (big batteries, wind and solar farms, the grid, energy and AI,
  records) and **Business and economy** (interest rates, home building, trades and skills, small business rules). World
  news is welcome there. Each story says "Why it's interesting" in place of "For you", and is never matched against a
  business's price lists or customers. The tab has **Solar** and **Beyond solar** chips, each opening its topics.
- **Readings kept inside the time limit.** A reading now stops starting new turns as it nears the 300-second limit, so a
  morning reading isn't cut off and lost.
- **Likes and comments on Sol's stories**, as on posts.
- **Polls.** A post can ask a question with two to four choices, open for a week. Counts show once you've voted, to the
  writer, and to everyone once it closes, so nobody votes with the crowd. You can change your vote while it is open.
- **Most talked about this week**: up to three stories or posts with the most likes, comments and votes, at the top of
  All, each taking you to it.

## Built next (17 Nov 2026, all seven)

All seven below were built on 17 Nov 2026 (CLAUDE.md has the details). Changes from the plan: Connect works from a
business's page even when it isn't listed in the directory (it posted where everyone sees it); the Monday email is
turned off in the News tab's settings rather than by a link; Sol's poll questions come from a fixed list in turn, and
its results are a post of Sol's rather than a story.

## The seven, as planned

1. **A business's page in the network.** Pressing a post's author opens a small card: the business, its kind and suburb
   (from the opt-in directory), its posts, and **Connect** (Connections already exists). This turns the feed into the way
   businesses find each other: an installer posts, a retailer connects and sends them a job.
2. **Notifications that bring people back**: someone commented on your post, liked it, voted on your poll, replied to
   your comment. Shown in the bell, with a weekly email of the week's most talked about.
3. **Sol joins the conversation.** Each week Sol posts one poll the industry would want answered ("Which battery are you
   installing most this month?"), and posts the results the week after as a story ("62% of installers on RENUABL…"). Data
   no one else has, made from the network. Never a business's own figures, only votes.
4. **Ask the industry.** A post kind for questions ("Anyone had trouble with X's firmware update?"), with **Answered**
   marked by the asker, and Sol's own answer offered underneath from his knowledge and sources.
5. **Wins.** A business can share a finished install as a post from its job: the roof drawn with its panels, the system
   size and the suburb (never the address or customer), with a like. Good for pride and for the installer who did it.
6. **Follow topics and businesses**: mute Business and economy, follow Tesla, see a business's posts first.
7. **A weekly digest email** for every member: the week's top five stories and the most talked about post, one email
   on Monday morning. The biggest thing for coming back.

## Advertising, when the network is big enough

The feed is where an advertiser would want to be: every solar retailer, installer and inspector on RENUABL, reading it
daily. Done well it can pay for Sol's readings and more. The rules I'd hold to:

- **Clearly marked.** Every paid item says **Sponsored** and who paid, the same place on every card. Australian Consumer
  Law: no advertising dressed as news, and never in Sol's own stories or his "For you" lines.
- **One sponsored item in every ten or so**, never at the very top and never two together.
- **Relevant only**: wholesalers, makers (panels, inverters, batteries, chargers), finance, training, insurance, tools.
  Nothing that competes with RENUABL Business itself.
- **What advertisers get**: a **Sponsored post** (a post with a picture and a button), a **Product launch card** (a new
  model with its datasheet, which Sol can read into the designer's lists), a **Sponsored poll** (the maker asks a
  question; they see only the totals, never who voted), and a **Webinar or event card** with "Remind me".
- **Targeted by what we know without exposing anyone**: the business's kind, state and the makers on its price lists,
  matched on our side; the advertiser never sees who saw it, only counts.
- **Self-serve later**: start with RENUABL's staff placing them by hand from /admin; a booking page and invoices once
  there is demand.
- **Not before** the feed has enough businesses that an advertiser's money buys real reach. Until then, use the same
  slot for RENUABL's own announcements (the Marketplace opening, a new feature).

## To check before relying on it

- One real "Beyond solar" reading on the live site (cost about US$0.50 a reading at six searches), and that the stories
  are ones people want.
- The 6am cron firing now `CRON_SECRET` is set (it wasn't firing; the feed only filled when someone opened it).
- Legal review of sponsored content wording before the first paid placement.
