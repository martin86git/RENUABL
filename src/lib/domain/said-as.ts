/**
 * How a name is said out loud on a phone call (15 Nov 2026, Martin: "he isnt pronouncing renuabl as RENEWABLE").
 *
 * A voice reads what it is given letter by letter, so a made-up spelling comes out wrong however the assistant is told
 * to pronounce it: a coaching note changes what the model writes, not how the voice says a word. So the words the
 * assistant is given to say carry the spoken form in place of the written one, and its instructions say which is which.
 */
export const SAID_AS: readonly { written: RegExp; spelled: string; said: string }[] = [
  { written: /\brenuabl\b/gi, spelled: "Renuabl", said: "Renewable" },
];

/** The text with every name in `SAID_AS` written the way it is said. */
export function saidAs(text: string): string {
  return SAID_AS.reduce((t, n) => t.replace(n.written, n.said), text);
}

/**
 * The line of a call's instructions that says how the business's name is spoken, or "" when it is said as written.
 * Takes the name as it is really spelled.
 */
export function saidAsNote(business: string): string {
  const names = SAID_AS.filter((n) => business.search(n.written) >= 0);
  if (!names.length) return "";
  return names
    .map(
      (n) =>
        `- The business's name is spelled "${n.spelled}" and said exactly like the word "${n.said.toLowerCase()}". Your words are read out by a voice that says what it sees, so whenever you say the name, write it as "${n.said}" (as these instructions do). It is the same business, not another one. Only if someone asks how it's spelled, spell it out: ${n.spelled.toUpperCase().split("").join("-")}.`,
    )
    .join("\n");
}
