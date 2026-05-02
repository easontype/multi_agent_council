jest.mock("@/lib/db/db", () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock("@/lib/db/council-db", () => ({
  ensureCouncilSchema: jest.fn().mockResolvedValue(undefined),
}));

import { db } from "@/lib/db/db";
import { backfillPaperAssetsForSessions } from "@/lib/paper-assets";

const mockedDbQuery = jest.mocked(db.query);

describe("backfillPaperAssetsForSessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("backfills an old arXiv-backed session with a paper asset", async () => {
    mockedDbQuery
      .mockResolvedValueOnce({
        rows: [{
          id: "sess-1",
          title: "Attention Is All You Need",
          context: "Source: https://arxiv.org/pdf/1706.03762.pdf. Library: paper:abc",
          paper_asset_id: null,
          workspace_id: "ws-1",
          seats: [{ role: "Methods Critic", library_id: "paper:abc" }],
        }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: "asset-1",
          workspace_id: "ws-1",
          canonical_title: "Attention Is All You Need",
          abstract: null,
          authors: [],
          year: null,
          arxiv_id: "1706.03762",
          canonical_checksum_sha256: null,
          status: "pending",
          processing_error: null,
          marker_processed: false,
          document_id: null,
          primary_library_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          processed_at: null,
        }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [{ id: "doc-1", marker_processed: true }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await backfillPaperAssetsForSessions(10);

    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockedDbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE council_sessions"),
      ["sess-1", "asset-1"],
    );
  });
});
