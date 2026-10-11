"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProposalState, ProposalView } from "@/lib/domain/design/proposal";
import { acceptProposal, askQuestion, proposalUrls, tellOpened } from "@/lib/services/proposals";
import { ProposalPage } from "./proposal-view";

/**
 * The customer's own proposal, at their private link: the page itself, with
 * going ahead and asking a question wired to the server. Opening it is told
 * to the server once the page is really in a browser (so a link preview in a
 * messaging app doesn't count as the customer having read it).
 */
export function CustomerProposal(props: {
  token: string;
  view: ProposalView;
  state: ProposalState;
  accepted: { name: string; at: string } | null;
}) {
  const { token, view } = props;
  const [state, setState] = useState(props.state);
  const [accepted, setAccepted] = useState(props.accepted);
  const urls = useMemo(() => proposalUrls(token), [token]);
  useEffect(() => tellOpened(token), [token]);

  return (
    <ProposalPage
      view={view}
      state={state}
      accepted={accepted}
      urls={urls}
      actions={{
        accept: async (name, agree) => {
          const res = await acceptProposal(token, name, agree);
          if (!res.ok) return res.message;
          setState(res.state);
          setAccepted(res.accepted);
          return null;
        },
        ask: async (text) => {
          const res = await askQuestion(token, text);
          return res.ok ? null : res.message;
        },
      }}
    />
  );
}
