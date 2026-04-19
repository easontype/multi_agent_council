// Council UI kit — agent roster data
// Matches src/lib/review-presets.ts roles from the Council repo.

window.COUNCIL_AGENTS = [
  {
    id: "methods-critic",
    initial: "M",
    name: "Methods Critic",
    color: "#43506b",
    focus: ["research design", "analytical rigor", "confounds"],
    role: "Primary critic",
    model: "Claude Sonnet 4.5",
    blurb:
      "Tests whether the paper design, assumptions, and analysis actually support the claims being made.",
  },
  {
    id: "literature-auditor",
    initial: "L",
    name: "Literature Auditor",
    color: "#65505f",
    focus: ["prior work", "novelty", "attribution"],
    role: "Context & attribution",
    model: "Claude Sonnet 4.5",
    blurb:
      "Audits related work, surfaces missing citations, and checks that novelty claims are defensible against the literature.",
  },
  {
    id: "replication-skeptic",
    initial: "R",
    name: "Replication Skeptic",
    color: "#466671",
    focus: ["reproducibility", "artifacts", "ablations"],
    role: "Empirical stress-test",
    model: "Claude Sonnet 4.5",
    blurb:
      "Assumes the reviewer will try to reproduce. Asks for seeds, configs, ablations, and the one plot you left out.",
  },
  {
    id: "contribution-evaluator",
    initial: "C",
    name: "Contribution Evaluator",
    color: "#59674b",
    focus: ["scope", "significance", "positioning"],
    role: "Venue fit",
    model: "Claude Sonnet 4.5",
    blurb:
      "Asks what the paper is actually contributing, to whom, and whether the framing fits the venue it's being sent to.",
  },
  {
    id: "constructive-advocate",
    initial: "A",
    name: "Constructive Advocate",
    color: "#7a4c54",
    focus: ["rebuttal", "presentation", "clarity"],
    role: "Author's proxy",
    model: "Claude Sonnet 4.5",
    blurb:
      "Argues the paper's strongest version and helps prepare for rebuttal. Pushes back when critique overshoots.",
  },
];

window.COUNCIL_SAVED_TEAMS = [
  { name: "ML Systems panel", agents: 5, updated: "Last used · Tue" },
  { name: "Empirical NLP · strict", agents: 4, updated: "Created · Mon" },
  { name: "Theory / proofs", agents: 3, updated: "Created · Oct 12" },
];

window.COUNCIL_PAPER = {
  title: "Scaling Laws for Neural Debate: Does Council Size Matter?",
  authors: "M. Nakamura, J. Li, K. Petrov, R. Okafor",
  venue: "arXiv:2411.07432 · Submitted to ICLR 2026",
  pages: 18,
  abstract:
    "We study how panel size affects the quality of multi-agent review on scientific papers. Across 1,204 papers and five reviewer archetypes, we find diminishing returns beyond five seats but measurable gains in disagreement quality up to seven. We release Council-Bench, an open evaluation of panel-derived review usefulness against expert gold standards.",
};
