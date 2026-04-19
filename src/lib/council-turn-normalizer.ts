function normalizeHeading(line: string): string {
  return line
    .replace(/^[#>*\-\s]+/, "")
    .replace(/\*\*/g, "")
    .replace(/[:：\-–—\s]+$/g, "")
    .trim()
    .toLowerCase();
}

function clampWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}...`;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitItems(text: string, maxItems: number, perItemWords: number): string[] {
  const explicitBullets = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

  const source = explicitBullets.length > 1
    ? explicitBullets
    : text
      .split(/[\n;]+|(?<=[。.!?])\s+/)
      .map((item) => item.trim())
      .filter(Boolean);

  return source
    .slice(0, maxItems)
    .map((item) => clampWords(item, perItemWords))
    .filter(Boolean);
}

function extractSections(text: string, sectionAliases: Record<string, string[]>): Record<string, string> {
  const aliases = new Map<string, string>();
  for (const [section, names] of Object.entries(sectionAliases)) {
    for (const name of names) aliases.set(name.toLowerCase(), section);
  }

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: Record<string, string[]> = {};
  let currentSection: string | null = null;
  const preamble: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const heading = normalizeHeading(line);
    const matchedSection = aliases.get(heading);
    if (matchedSection) {
      currentSection = matchedSection;
      if (!sections[currentSection]) sections[currentSection] = [];
      continue;
    }

    if (!line.trim()) {
      if (currentSection) sections[currentSection].push("");
      else preamble.push("");
      continue;
    }

    if (currentSection) sections[currentSection].push(line.trim());
    else preamble.push(line.trim());
  }

  const result: Record<string, string> = {};
  const fallbackParagraphs = splitParagraphs(preamble.join("\n"));
  let fallbackIndex = 0;

  for (const section of Object.keys(sectionAliases)) {
    const joined = (sections[section] ?? []).join("\n").trim();
    if (joined) {
      result[section] = joined;
      continue;
    }
    result[section] = fallbackParagraphs[fallbackIndex] ?? "";
    fallbackIndex += 1;
  }

  return result;
}

function formatBullets(items: string[], emptyFallback: string): string {
  const resolved = items.length ? items : [emptyFallback];
  return resolved.map((item) => `- ${item}`).join("\n");
}

function enforceWordBudget(markdown: string, maxWords: number): string {
  const words = markdown.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return markdown.trim();

  const lines: string[] = [];
  let used = 0;
  for (const rawLine of markdown.trim().split("\n")) {
    const lineWords = rawLine.trim().split(/\s+/).filter(Boolean);
    if (!lineWords.length) {
      lines.push("");
      continue;
    }
    if (used >= maxWords) break;
    if (used + lineWords.length <= maxWords) {
      lines.push(rawLine);
      used += lineWords.length;
      continue;
    }
    const remaining = Math.max(1, maxWords - used);
    lines.push(`${lineWords.slice(0, remaining).join(" ")}...`);
    used = maxWords;
    break;
  }

  return lines.join("\n").trim();
}

export function normalizeSeatTurnContent(content: string, round: number): string {
  const trimmed = content.trim();
  if (!trimmed) return trimmed;

  if (round === 1) {
    const sections = extractSections(trimmed, {
      position: ["position"],
      assumptions: ["key assumptions", "assumptions"],
      risks: ["main risks", "risks"],
      counterargument: ["strongest counterargument", "counterargument"],
      evidence: ["evidence"],
    });

    const normalized = [
      "**Position**",
      clampWords(sections.position || "Not clearly stated.", 60),
      "",
      "**Key Assumptions**",
      formatBullets(splitItems(sections.assumptions, 3, 20), "Not clearly stated."),
      "",
      "**Main Risks**",
      formatBullets(splitItems(sections.risks, 2, 24), "Not clearly stated."),
      "",
      "**Strongest Counterargument**",
      clampWords(sections.counterargument || "Not clearly stated.", 70),
      "",
      "**Evidence**",
      formatBullets(splitItems(sections.evidence, 5, 20), "None cited."),
    ].join("\n");

    return enforceWordBudget(normalized, 400);
  }

  if (round === 2) {
    const sections = extractSections(trimmed, {
      challenge: ["challenge"],
      stance: ["stance"],
      evidence: ["evidence"],
    });

    const normalized = [
      "**Challenge**",
      clampWords(sections.challenge || "Not clearly stated.", 110),
      "",
      "**Stance**",
      clampWords(sections.stance || "Not clearly stated.", 45),
      "",
      "**Evidence**",
      formatBullets(splitItems(sections.evidence, 4, 18), "None cited."),
    ].join("\n");

    return enforceWordBudget(normalized, 220);
  }

  return trimmed;
}
