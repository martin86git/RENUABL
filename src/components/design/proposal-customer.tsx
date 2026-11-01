"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicDeposit } from "@/lib/domain/design/deposit";
import { recommendedGoal, viewForChoice, type ProposalState, type ProposalView } from "@/lib/domain/design/proposal";
import type { OptionKey } from "@/lib/domain/design/proposal";
import { acceptProposal, proposalUrls, sayPaid, tellOpened } from "@/lib/services/proposals";
import { ChatDock, ChatGreeting, useCustomerChat } from "./chat-panel";
import { PayDeposit } from "./deposit-panel";
import { ProposalPage } from "./proposal-view";

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
}) {
  const { token, view } = props;
  const [state, setState] = useState(props.state);
  const [accepted, setAccepted] = useState(props.accepted);
  const [deposit, setDeposit] = useState(props.deposit);
  const urls = useMemo(() => proposalUrls(token), [token]);
  useEffect(() => tellOpened(token), [token]);
  const chat = useCustomerChat({ token, business: view.business.name, phone: view.business.phone });
  // With a choice of systems: the one shown (the one chosen once they have gone ahead, else the recommended one to start).
  const [chosen, setChosen] = useState<OptionKey | null>(props.accepted?.option ?? recommendedGoal(view));
  const shown = viewForChoice(view, chosen);

  return (
    <ProposalPage
      view={shown}
      state={state}
      choice={{ chosen, onChoose: state === "accepted" ? undefined : setChosen }}
      accepted={accepted}
      urls={urls}
      deposit={
        // Only once accepted, and only when this proposal asks for a deposit.
        state === "accepted" && deposit ? (
          <PayDeposit
            view={shown}
            deposit={deposit}
            onPaid={async (way) => {
              const res = await sayPaid(token, way);
              if (!res.ok) return res.message;
              setDeposit(res.deposit);
              return null;
            }}
          />
        ) : null
      }
      onOpenChat={() => chat.show(true)}
      greeting={<ChatGreeting chat={chat} />}
      chat={<ChatDock chat={chat} />}
      actions={{
        accept: async (name, agree) => {
          const res = await acceptProposal(token, name, agree, chosen);
          if (!res.ok) return res.message;
          setState(res.state);
          setAccepted(res.accepted);
          setDeposit(res.deposit);
          return null;
        },
        // On an indicative proposal their thoughts go to the business as a message, where they can be answered.
        feedback: async (text) => ((await chat.send(text)) ? null : "That didn't send. Try again, or write to us in the chat."),
      }}
    />
  );
}
