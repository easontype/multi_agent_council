import { backfillMarkerDocuments } from "../src/lib/paper-ingest";

async function main() {
  const rawLimit = process.argv[2];
  const limit = rawLimit ? Number(rawLimit) : 20;
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error(`Invalid limit: ${rawLimit ?? ""}`);
  }

  const summary = await backfillMarkerDocuments(limit);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
