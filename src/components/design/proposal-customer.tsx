"use client";

import { useEffect, useMemo, useState } from "react";
import type { PublicDeposit } from "@/lib/domain/design/deposit";
import type { ProposalState, ProposalView } from "@/lib/domain/design/proposal";
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
  accepted: { name: string; at: string } | null;
  deposit: PublicDeposit | null;
}) {
  const { token, view } = props;
  const [state, setState] = useState(props.state);
  const [accepted, setAccepted] = useState(props.accepted);
  const [deposit, setDeposit] = useState(props.deposit);
  const urls = useMemo(() => proposalUrls(token), [token]);
  useEffect(() => tellOpened(token), [token]);
  const chat = useCustomerChat({ token, business: view.business.name, phone: view.business.phone });

  return (
    <ProposalPage
      view={view}
      state={state}
      accepted={accepted}
      urls={urls}
      deposit={
        // Only once accepted, and only when this proposal asks for a deposit.
        state === "accepted" && deposit ? (
          <PayDeposit
            view={view}
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
      greeting={<ChatGreeting chat={chat} />}
      chat={<ChatDock chat={chat} />}
      actions={{
        accept: async (name, agree) => {
          const res = await acceptProposal(token, name, agree);
          if (!res.ok) return res.message;
          setState(res.state);
          setAccepted(res.accepted);
          setDeposit(res.deposit);
          return null;
        },
      }}
    />
  );
}
