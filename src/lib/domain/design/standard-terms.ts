/**
 * RENUABL's standard terms and conditions for a business's proposals: the
 * contract a business can switch on in Settings so every proposal carries
 * it, in place of (or as well as) its own special conditions.
 *
 * DRAFT FOR LEGAL REVIEW. This wording is RENUABL's own, written in plain
 * English; it is not copied from any other product's or business's contract.
 * It has not been reviewed by a lawyer and must be before any business
 * relies on it. The points marked VERIFY are the ones a reviewer should
 * check first against the Australian Consumer Law, the New Energy Tech
 * Consumer Code (NETCC) and each state's rules.
 *
 * Nothing in it names a particular business: the seller is always the
 * business sending the proposal ("{seller}"), and the customer is
 * "{customer}". `fillTerms` puts the names in.
 */

export const STANDARD_TERMS_VERSION = "draft-2026-10-11";

export interface TermsSection {
  heading: string;
  clauses: string[];
}

/** The consumer guides the NETCC points customers to, linked rather than copied. VERIFY the addresses before launch. */
export const NETCC_INFORMATION = {
  heading: "New Energy Tech consumer information",
  intro:
    "Researching your options before you buy helps you get a system that suits your home. The New Energy Tech Consumer Code (NETCC) sets standards for businesses that sell solar, batteries and other new energy technology, and publishes free guides for consumers.",
  guides: ["Installing solar", "Using solar", "Installing battery storage", "Using battery storage"],
  url: "https://www.newenergytech.org.au/consumers",
  /** Shown only when the business has said it is a NETCC Approved Seller. RENUABL does not check it. */
  approvedSeller: "{seller} is a New Energy Tech Approved Seller and has agreed to follow the Code.",
  /** Shown otherwise: never imply a business is approved when it hasn't said so. */
  notStated: "Ask your seller whether they are a New Energy Tech Approved Seller.",
} as const;

export const STANDARD_TERMS: readonly TermsSection[] = [
  {
    heading: "1. This agreement",
    clauses: [
      "This agreement is between {seller} (we, us) and {customer} (you). It is made up of the proposal you accepted (the system, the price and the payment terms), any special conditions set out in it, and these terms. If they disagree, the special conditions come first, then the proposal, then these terms.",
      "It starts when you accept the proposal. Nothing in it limits any right you have under the Australian Consumer Law that cannot be excluded.",
    ],
  },
  {
    heading: "2. Changing your mind",
    clauses: [
      // VERIFY: the cooling-off period for unsolicited consumer agreements under the ACL (10 business days) and any NETCC cooling-off commitment.
      "If we approached you uninvited (at your door or by phone) and you signed up as a result, the Australian Consumer Law gives you 10 business days to cancel without penalty, and we will not supply anything or take payment during that time.",
      "In any other case you may cancel before installation is booked by telling us in writing. We will refund what you have paid, less any reasonable cost we have already met for your job that we cannot recover, which we will itemise for you.",
    ],
  },
  {
    heading: "3. The price and how you pay",
    clauses: [
      "The price is the one in the proposal, including GST. It stays as quoted for the time the proposal says it stands. It can change only as these terms allow, and never without your agreement in writing first.",
      "You pay the deposit and the later payments in the amounts and at the times the proposal sets out. The system remains ours until it is paid for in full.",
      "If a payment is late we may pause the work until it is made. We will tell you before we do.",
    ],
  },
  {
    heading: "4. Government incentives",
    clauses: [
      "The price allows for the small-scale technology certificates (STCs) your system is expected to create. You assign those certificates to us (or to the agent we name), and sign what is needed to do so. The amount is an estimate until the system is installed: if the rules change before installation and the value is different, we will tell you the new price and you may cancel for a full refund instead of accepting it.",
      // VERIFY: wording about state rebates and loans against each scheme's own terms.
      "A state rebate or loan (such as Solar Victoria's) is shown in a proposal only as what you may receive if you are eligible and are approved. It is decided by the scheme, not by us. If you are not approved, it does not apply and the price without it is the price.",
    ],
  },
  {
    heading: "5. Connecting to the grid",
    clauses: [
      "Your system cannot export to the grid, and in most cases cannot be switched on, until your electricity distributor approves it. Unless the proposal says you will apply yourself, we apply for you and tell you the outcome.",
      "If the distributor refuses, or approves only a smaller system or a limit on exports, we will tell you promptly. You may then choose a changed system at a changed price, or cancel for a full refund.",
      "Your retailer may change your tariff or meter when solar is connected. Those arrangements, and any charges for them, are between you and your retailer.",
    ],
  },
  {
    heading: "6. Before installation",
    clauses: [
      "The design in the proposal is drawn from pictures of your roof and what you have told us. We confirm it on site. If the site is not as expected (for example the roof, the switchboard or the wiring cannot take the system as designed), we will explain what is needed and what it costs before doing any of it. You may accept the change or cancel for a full refund.",
      "You confirm that you own the property or have the owner's written agreement to the installation, and that you will tell us about anything you know that could affect the work, such as asbestos, a fragile roof or a body corporate rule.",
    ],
  },
  {
    heading: "7. Installation",
    clauses: [
      "We install the system on the date we agree with you, or as soon as we can if weather, safety, supply or the distributor's approval causes a delay. Any installation time given in a proposal is an estimate, not a promise; if a delay becomes long we will tell you and you may ask to cancel.",
      "The work is done by people who hold the licences and accreditation the law requires for it, to the Australian Standards that apply. You give us safe access to the property, the roof, the switchboard and power on the day.",
      "When the work is finished we give you the documents you are entitled to, including the system's manuals, its warranties, the electrical safety certificate and a list of what was installed.",
    ],
  },
  {
    heading: "8. What the system will produce",
    clauses: [
      "Figures in the proposal for output, savings and payback are estimates. They rest on the assumptions shown with them (your bill, your tariff, the weather in an average year, shade and how you use power), and your results will differ. We do not guarantee a saving or an amount of electricity unless the proposal says in so many words that we do.",
    ],
  },
  {
    heading: "9. Warranties",
    clauses: [
      // VERIFY: the consumer guarantee wording required by the ACL Regulations for a warranty against defects.
      "Our goods and services come with guarantees that cannot be excluded under the Australian Consumer Law. You are entitled to a replacement or refund for a major failure and to compensation for any other reasonably foreseeable loss or damage. You are also entitled to have the goods repaired or replaced if they fail to be of acceptable quality and the failure does not amount to a major failure.",
      "On top of those rights, we warrant our workmanship for the period the proposal states, and the products carry their manufacturers' warranties, which we will help you claim on. To claim, contact us using the details in the proposal; we will tell you what we need and bear the reasonable cost of putting right a fault we are responsible for.",
      "Our workmanship warranty does not cover damage caused by someone else working on the system, by misuse, or by events outside our control such as storms, pests or a fault in the grid.",
    ],
  },
  {
    heading: "10. Looking after the system",
    clauses: [
      "The system is yours to look after once installed. Follow the manufacturers' instructions, keep it clear of shade and debris where you safely can, and have any work on it done by a licensed person. Tell us promptly if something looks wrong.",
    ],
  },
  {
    heading: "11. If something goes wrong between us",
    clauses: [
      "If you are unhappy, tell us using the details in the proposal. We will acknowledge your complaint promptly, look into it, and tell you the outcome and our reasons.",
      // VERIFY: complaint time frames and escalation bodies required by the NETCC, by state.
      "If we cannot resolve it, you may take it to your state or territory's consumer protection agency or its energy ombudsman, and, where we are a New Energy Tech Approved Seller, to the Code's administrator.",
    ],
  },
  {
    heading: "12. Ending this agreement",
    clauses: [
      "You may end it as set out in clauses 2, 4, 5, 6 and 7. We may end it if you do not pay what is due after we have asked in writing and given you a reasonable time, or if the site makes the installation unsafe or impossible; we then refund what you have paid, less the reasonable cost of work and goods already supplied that you keep.",
    ],
  },
  {
    heading: "13. Your information",
    clauses: [
      "We collect and use your personal information only to quote, install, connect and support your system, including passing what is needed to your distributor, the regulator and the bodies that run the incentives. We handle it in line with the Privacy Act and our privacy policy, which you can ask us for.",
    ],
  },
  {
    heading: "14. General",
    clauses: [
      "We may use subcontractors, and remain responsible to you for their work. Neither of us may hand this agreement to someone else without the other's written agreement, which is not to be unreasonably withheld.",
      "Changes to this agreement are made in writing and agreed by both of us. It is governed by the law of the state or territory where the system is installed.",
    ],
  },
];

/** The terms with the two names in. Neither name is trusted as markup: they are plain text wherever this is shown. */
export function fillTerms(names: { seller: string; customer: string }): TermsSection[] {
  const fill = (text: string) =>
    text.replaceAll("{seller}", names.seller || "the seller").replaceAll("{customer}", names.customer || "the customer");
  return STANDARD_TERMS.map((s) => ({ heading: s.heading, clauses: s.clauses.map(fill) }));
}
