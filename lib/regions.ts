/**
 * Region packs, and which agent each one talks to.
 *
 * Keyterms live on the agent, not on the session. So one agent per region is the
 * dependable way to swap a country mid-demo: pick the pack, and the browser opens
 * its socket to the agent that already has that pack's words loaded. No mid-call
 * reconfiguration to get wrong in front of judges.
 *
 * A region without its own agent falls back to the shared one, and says so on
 * screen. Quietly running Lahore addresses through Lagos keyterms would make the
 * pack switch look like it works while measuring nothing.
 */

import lagos from "../regions/ng-lagos.json" with { type: "json" };
import lahore from "../regions/pk-lahore.json" with { type: "json" };
import london from "../regions/uk-london.json" with { type: "json" };

export interface Pack {
  id: string;
  label: string;
  currency?: string;
  currency_symbol?: string;
  vocabulary?: { place?: string; entrance?: string };
  relationship_aliases?: Record<string, string>;
  keyterms?: string[];
}

export const PACKS: Pack[] = [lagos as Pack, lahore as Pack, london as Pack];

export function packFor(id: string | null | undefined): Pack | undefined {
  return PACKS.find((p) => p.id === id);
}

/**
 * The agent ids this build knows about.
 *
 * Next only inlines a NEXT_PUBLIC_ variable into the browser bundle where it is
 * written out in full, so these cannot be looked up by a built name. The page
 * passes this map in; the logic below stays testable without a bundler.
 */
export type AgentIds = {
  shared?: string;
  byRegion: Record<string, string | undefined>;
};

export function agentFor(
  regionId: string,
  ids: AgentIds,
): { agentId: string; dedicated: boolean } {
  const own = ids.byRegion[regionId]?.trim();
  if (own) return { agentId: own, dedicated: true };
  return { agentId: ids.shared?.trim() ?? "", dedicated: false };
}

/** The stops on today's route that belong to this region, in route order. */
export function stopsFor<T extends { region?: string; seq: number }>(
  regionId: string,
  drops: T[],
): T[] {
  return drops.filter((d) => d.region === regionId).sort((a, b) => a.seq - b.seq);
}

/**
 * The local words, as lines to add to the agent's instructions.
 *
 * Keyterms help the recogniser hear "chowkidar". This tells the model what a
 * chowkidar is in the record. Without it the right word is transcribed and then
 * filed as "other".
 */
export function localWordsPrompt(pack: Pack): string {
  const lines: string[] = [];
  if (pack.vocabulary?.place) {
    lines.push(`- Call the place "${pack.vocabulary.place}".`);
  }
  if (pack.vocabulary?.entrance) {
    lines.push(`- Call the entrance "${pack.vocabulary.entrance}".`);
  }
  const aliases = Object.entries(pack.relationship_aliases ?? {});
  if (aliases.length) {
    lines.push(
      "- These local words map to recipient.relationship: " +
        aliases.map(([word, value]) => `"${word}" means ${value}`).join(", ") +
        ".",
    );
  }
  if (pack.currency) {
    lines.push(`- Money is in ${pack.currency}. Record the number the driver says, nothing else.`);
  }
  if (!lines.length) return "";
  return `\n\nLocal words for ${pack.label}:\n\n` + lines.join("\n");
}
