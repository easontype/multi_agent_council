/**
 * debate-strategy.ts — Strategy pattern for selecting the right prompt builders
 * based on session debate_mode and seat composition.
 *
 * Keeps session-orchestrator.ts free of prompt-selection branching logic.
 */

import type { CouncilSession, CouncilSeat, CouncilTurn } from "../core/council-types";
import {
  buildRound1Prompt,
  buildExperimentalRound1Prompt,
  buildBoundedRound2Prompt,
  buildBoundedExperimentalRound2Prompt,
  buildAdversarialRound1Prompt,
  buildAdversarialRound2Prompt,
  buildModeratorSystemPrompt,
  buildAdversarialModeratorSystemPrompt,
  isExperimentalTemplate,
} from "./council-prompts";

type SessionContext = Pick<CouncilSession, "topic" | "context" | "goal" | "seats" | "debate_mode">;

export interface DebateStrategy {
  round1Prompt(session: SessionContext, preferredLanguage?: string): string;
  round2Prompt(
    session: SessionContext,
    seat: CouncilSeat,
    round1Turns: CouncilTurn[],
    round2TurnsSoFar: CouncilTurn[],
    preferredLanguage?: string,
  ): string;
  moderatorSystemPrompt(preferredLanguage?: string): string;
}

const critiqueStrategy = (scientific: boolean): DebateStrategy => ({
  round1Prompt: (session, lang) =>
    scientific
      ? buildExperimentalRound1Prompt(session, lang)
      : buildRound1Prompt(session, lang),

  round2Prompt: (session, _seat, r1, r2so, lang) =>
    scientific
      ? buildBoundedExperimentalRound2Prompt(session, r1, r2so, lang)
      : buildBoundedRound2Prompt(session, r1, r2so, lang),

  moderatorSystemPrompt: buildModeratorSystemPrompt,
});

const adversarialStrategy: DebateStrategy = {
  round1Prompt: (session, lang) =>
    buildAdversarialRound1Prompt(session, lang),

  round2Prompt: (session, seat, r1, r2so, lang) =>
    buildAdversarialRound2Prompt(session, seat, r1, r2so, lang),

  moderatorSystemPrompt: buildAdversarialModeratorSystemPrompt,
};

export function selectDebateStrategy(session: SessionContext): DebateStrategy {
  if (session.debate_mode === "adversarial") return adversarialStrategy;
  return critiqueStrategy(isExperimentalTemplate(session.seats));
}

/** Group seats by their team field for adversarial interleaved round 2. */
export function groupSeatsByTeam(seats: CouncilSeat[]): CouncilSeat[][] {
  const order: string[] = [];
  const map = new Map<string, CouncilSeat[]>();
  for (const seat of seats) {
    const key = seat.team ?? "__no_team__";
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(seat);
  }
  return order.map(k => map.get(k)!);
}
