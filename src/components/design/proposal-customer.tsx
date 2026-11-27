"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicDeposit } from "@/lib/domain/design/deposit";
import { recommendedGoal, viewForChoice, type ProposalState, type ProposalView } from "@/lib/domain/design/proposal";
import type { OptionKey } from "@/lib/domain/design/proposal";
import { acceptProposal, likeOption, proposalUrls, sayPaid, tellOpened } from "@/lib/services/proposals";
import { CallMe } from "./call-me";
import { ChatDock, ChatGreeting, useCustomerChat } from "./chat-panel";
import { PayDeposit } from "./deposit-panel";
import { PaySchedule } from "./pay-schedule";
import type { PublicPayments } from "@/lib/services/proposals";
import { PoweredByRenuabl, ProposalPage } from "./proposal-view";
import { ProposalOptionBar } from "./proposal-option-bar";
import { ProposalReveal } from "./proposal-reveal";
import { ProposalDatasheets } from "./proposal-datasheets";
import type { ProposalDatasheet } from "@/lib/domain/design/proposal-datasheets";
import { WalkthroughPlayer } from "./walkthrough-player";

/**
 * The customer's own proposal, at their private link: the page itself, with
 * going ahead wired to the server, the deposit to pay once they have gone
 * ahead, and the conversation with the business (its latest message at the
 * top, the chat at the foot of the screen). Opening it is told
 * to the server once the page is really in a browser (so a link preview in a
 * messaging app doesn't count as the customer having read it).
 */
export function CustomerProposal(props: {
  token: string;
  view: ProposalView;
  state: ProposalState;
  accepted: { name: string; at: string; option?: OptionKey | null } | null;
  deposit: PublicDeposit | null;
  payments: PublicPayments | null;
  /** "Call me" with the business's automated assistant, when the business has calls on. */
  callMe?: { assistant: string } | null;
  /** The datasheets for the products it quotes (26 Nov 2026). */
  datasheets?: ProposalDatasheet[];
  /** The systems the customer likes (26 Nov 2026), with a choice of systems. */
  likes?: string[];
}) {
  const { token, view } = props;
  const [state, setState] = useState(props.state);
  const [accepted, setAccepted] = useState(props.accepted);
  const [deposit, setDeposit] = useState(props.deposit);
  const [payments, setPayments] = useState(props.payments);
  const urls = useMemo(() => proposalUrls(token), [token]);
  useEffect(() => tellOpened(token), [token]);
  const chat = useCustomerChat({ token, business: view.business.name, phone: view.business.phone });
  // With a choice of systems: the one shown (the one chosen once they have gone ahead, else the recommended one to start).
  const [chosen, setChosen] = useState<OptionKey | null>(props.accepted?.option ?? recommendedGoal(view));
  const shown = viewForChoice(view, chosen);
  const [likes, setLikes] = useState<string[]>(props.likes ?? []);
  const onLike = (goal: OptionKey, like: boolean) => {
    // Shown at once; the server's answer puts it right.
    setLikes((now) => (like ? [...now.filter((x) => x !== goal), goal] : now.filter((x) => x !== goal)));
    void likeOption(token, goal, like).then((res) => res.ok && setLikes(res.likes));
  };
  const onChoose = state === "accepted" ? undefined : setChosen;
  const many = (view.options?.length ?? 0) > 1 && state !== "withdrawn";

  return (
    <ProposalPage
      view={shown}
      state={state}
      choice={{ chosen, onChoose, liked: likes, onLike: many ? onLike : undefined }}
      accepted={accepted}
      urls={urls}
      deposit={
        // Only once accepted, and only when this proposal asks for a deposit.
        state === "accepted" && (deposit || payments) ? (
          <>
            {payments && <PaySchedule token={token} business={view.business.name} payments={payments} form="proposal" />}
            {deposit && (
              <PayDeposit
                view={shown}
                deposit={deposit}
                cardsHere={Boolean(payments?.cards)}
                onPaid={async (way) => {
                  const res = await sayPaid(token, way);
                  if (!res.ok) return res.message;
                  setDeposit(res.deposit);
                  return null;
                }}
              />
            )}
          </>
        ) : null
      }
      onOpenChat={() => chat.show(true)}
      datasheets={props.datasheets?.length ? <ProposalDatasheets sheets={props.datasheets} chosen={chosen} href={urls.datasheet} /> : null}
      greeting={
        <>
          {state !== "withdrawn" && (
            <div className="mb-4">
              <WalkthroughPlayer token={token} business={view.business.name} />
            </div>
          )}
          <ChatGreeting chat={chat} />
          {/* Floats on the right of the page, always in view. */}
          {props.callMe && state !== "withdrawn" && <CallMe token={token} assistant={props.callMe.assistant} />}
        </>
      }
      chat={
        <>
          <ChatDock chat={chat} />
          <PoweredByRenuabl />
          {state !== "withdrawn" && <ProposalReveal token={token} chat={chat} />}
          {many && view.options && (
            <ProposalOptionBar options={view.options} chosen={chosen} onChoose={onChoose} liked={likes} onLike={onLike} />
          )}
        </>
      }
      actions={{
        accept: async (name, agree) => {
          const res = await acceptProposal(token, name, agree, chosen);
          if (!res.ok) return res.message;
          setState(res.state);
          setAccepted(res.accepted);
          setDeposit(res.deposit);
          setPayments(res.payments);
          return null;
        },
        // On an indicative proposal their thoughts go to the business as a message, where they can be answered.
        feedback: async (text) => ((await chat.send(text)) ? null : "That didn't send. Try again, or write to us in the chat."),
      }}
    />
  );
}
