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

function makeAssetRow(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe("backfillPaperAssetsForSessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a new paper asset for an arXiv-backed session", async () => {
    // DB call order:
    // 1. scan sessions
    // 2. findPaperAssetByArxivId → miss
    // 3. findPaperAssetByLocator("arxiv", "1706.03762") → miss  (resolvePaperAsset also tries locator)
    // 4. createPaperAsset (INSERT)
    // 5. ensurePaperAssetSource (INSERT)
    // 6. documentLookup
    // 7. UPDATE paper_assets (attach library)
    // 8. INSERT paper_libraries
    // 9. UPDATE council_sessions
    mockedDbQuery
      .mockResolvedValueOnce({ rows: [{ id: "sess-1", title: "Attention Is All You Need", context: "Source: https://arxiv.org/pdf/1706.03762.pdf. Library: paper:abc", paper_asset_id: null, workspace_id: "ws-1", seats: [{ role: "Critic", library_id: "paper:abc" }] }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [makeAssetRow()] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: "doc-1", marker_processed: true }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await backfillPaperAssetsForSessions(10);

    expect(result).toEqual({ scanned: 1, updated: 1, skipped: 0, created: 1 });
    expect(mockedDbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE council_sessions"),
      ["sess-1", "asset-1"],
    );
  });

  it("reuses an existing arXiv asset that already has a primary library", async () => {
    // DB call order:
    // 1. scan sessions
    // 2. findPaperAssetByArxivId → hit (primary_library_id already set)
    // 3. ensurePaperAssetSource (ON CONFLICT DO NOTHING)
    // 4. UPDATE council_sessions
    const existingAsset = makeAssetRow({ primary_library_id: "lib-existing", document_id: "doc-existing" });
    mockedDbQuery
      .mockResolvedValueOnce({ rows: [{ id: "sess-2", title: "Attention Is All You Need", context: "Source: https://arxiv.org/pdf/1706.03762.pdf. Library: paper:abc", paper_asset_id: null, workspace_id: "ws-1", seats: [{ role: "Critic", library_id: "paper:abc" }] }] } as never)
      .mockResolvedValueOnce({ rows: [existingAsset] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await backfillPaperAssetsForSessions(10);

    expect(result).toEqual({ scanned: 1, updated: 1, skipped: 0, created: 0 });
    expect(mockedDbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE council_sessions"),
      ["sess-2", "asset-1"],
    );
  });

  it("creates a new asset for an upload-backed session with a checksum", async () => {
    // DB call order:
    // 1. scan sessions
    // 2. SELECT uploaded_files → [{ checksum_sha256: "sha-abc" }]
    // 3. findPaperAssetBySourceChecksum (by checksum) → miss
    // 4. findPaperAssetByLocator (locator="upload") → miss
    // 5. createPaperAsset (INSERT)
    // 6. ensurePaperAssetSource (INSERT)
    // 7. documentLookup
    // 8. UPDATE paper_assets (attach library)
    // 9. INSERT paper_libraries
    // 10. UPDATE council_sessions
    mockedDbQuery
      .mockResolvedValueOnce({ rows: [{ id: "sess-3", title: "My Upload", context: "Source: upload. Library: lib-upload", paper_asset_id: null, workspace_id: "ws-1", seats: [{ role: "Critic", library_id: "lib-upload" }] }] } as never)
      .mockResolvedValueOnce({ rows: [{ checksum_sha256: "sha-abc" }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [makeAssetRow({ id: "asset-upload", arxiv_id: null })] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: "doc-2", marker_processed: false }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await backfillPaperAssetsForSessions(10);

    expect(result).toEqual({ scanned: 1, updated: 1, skipped: 0, created: 1 });
    expect(mockedDbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE council_sessions"),
      ["sess-3", "asset-upload"],
    );
  });

  it("creates a new asset for an upload session without a checksum using library locator", async () => {
    // DB call order:
    // 1. scan sessions
    // 2. SELECT uploaded_files → [] (no checksum recorded)
    // 3. findPaperAssetByLocator (locator="library:lib-old") → miss
    // 4. createPaperAsset (INSERT)
    // 5. ensurePaperAssetSource (INSERT)
    // 6. documentLookup
    // 7. UPDATE paper_assets (attach library)
    // 8. INSERT paper_libraries
    // 9. UPDATE council_sessions
    mockedDbQuery
      .mockResolvedValueOnce({ rows: [{ id: "sess-4", title: "Old Upload", context: "Source: upload. Library: lib-old", paper_asset_id: null, workspace_id: "ws-1", seats: [{ role: "Critic", library_id: "lib-old" }] }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [makeAssetRow({ id: "asset-old", arxiv_id: null })] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: "doc-3", marker_processed: false }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await backfillPaperAssetsForSessions(10);

    expect(result).toEqual({ scanned: 1, updated: 1, skipped: 0, created: 1 });
    // Verify locator used is library-based, not plain "upload"
    expect(mockedDbQuery).toHaveBeenCalledWith(
      expect.stringContaining("source_locator"),
      ["upload", "library:lib-old"],
    );
    expect(mockedDbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE council_sessions"),
      ["sess-4", "asset-old"],
    );
  });

  it("reuses an existing upload asset found by library locator when no checksum exists", async () => {
    // DB call order:
    // 1. scan sessions
    // 2. SELECT uploaded_files → []
    // 3. findPaperAssetByLocator → hit (primary_library_id set)
    // 4. ensurePaperAssetSource
    // 5. UPDATE council_sessions
    const existingUploadAsset = makeAssetRow({ id: "asset-lib", arxiv_id: null, primary_library_id: "lib-old", document_id: "doc-lib" });
    mockedDbQuery
      .mockResolvedValueOnce({ rows: [{ id: "sess-5", title: "Old Upload", context: "Source: upload. Library: lib-old", paper_asset_id: null, workspace_id: "ws-1", seats: [{ role: "Critic", library_id: "lib-old" }] }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [existingUploadAsset] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await backfillPaperAssetsForSessions(10);

    expect(result).toEqual({ scanned: 1, updated: 1, skipped: 0, created: 0 });
    expect(mockedDbQuery).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE council_sessions"),
      ["sess-5", "asset-lib"],
    );
  });

  it("skips a session with no context and no library_id in seats", async () => {
    mockedDbQuery
      .mockResolvedValueOnce({ rows: [{ id: "sess-6", title: "Ghost", context: null, paper_asset_id: null, workspace_id: "ws-1", seats: [] }] } as never);

    const result = await backfillPaperAssetsForSessions(10);

    expect(result).toEqual({ scanned: 1, updated: 0, skipped: 1, created: 0 });
    expect(mockedDbQuery).toHaveBeenCalledTimes(1);
  });

  it("skips a session with a library in seats but context that cannot be parsed", async () => {
    mockedDbQuery
      .mockResolvedValueOnce({ rows: [{ id: "sess-7", title: "Unparseable", context: "A summary of findings.", paper_asset_id: null, workspace_id: "ws-1", seats: [{ role: "Critic", library_id: "lib-x" }] }] } as never);

    const result = await backfillPaperAssetsForSessions(10);

    expect(result).toEqual({ scanned: 1, updated: 0, skipped: 1, created: 0 });
  });

  it("returns zero counts when there are no sessions to backfill", async () => {
    mockedDbQuery
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await backfillPaperAssetsForSessions(10);

    expect(result).toEqual({ scanned: 0, updated: 0, skipped: 0, created: 0 });
  });

  it("processes a mixed batch and counts each outcome correctly", async () => {
    // Session A: arXiv → creates new asset (updated=1, created=1)
    // Session B: no context → skipped (skipped=1)
    mockedDbQuery
      // scan
      .mockResolvedValueOnce({ rows: [
        { id: "sess-a", title: "Paper A", context: "Source: https://arxiv.org/pdf/2401.00001.pdf. Library: lib-a", paper_asset_id: null, workspace_id: "ws-1", seats: [{ role: "Critic", library_id: "lib-a" }] },
        { id: "sess-b", title: "Paper B", context: null, paper_asset_id: null, workspace_id: "ws-1", seats: [] },
      ] } as never)
      // sess-a: findPaperAssetByArxivId → miss
      .mockResolvedValueOnce({ rows: [] } as never)
      // sess-a: findPaperAssetByLocator("arxiv", "2401.00001") → miss
      .mockResolvedValueOnce({ rows: [] } as never)
      // sess-a: createPaperAsset
      .mockResolvedValueOnce({ rows: [makeAssetRow({ id: "asset-a", arxiv_id: "2401.00001" })] } as never)
      // sess-a: ensurePaperAssetSource
      .mockResolvedValueOnce({ rows: [] } as never)
      // sess-a: documentLookup
      .mockResolvedValueOnce({ rows: [{ id: "doc-a", marker_processed: false }] } as never)
      // sess-a: UPDATE paper_assets
      .mockResolvedValueOnce({ rows: [] } as never)
      // sess-a: INSERT paper_libraries
      .mockResolvedValueOnce({ rows: [] } as never)
      // sess-a: UPDATE council_sessions
      .mockResolvedValueOnce({ rows: [] } as never);
    // sess-b: no DB calls (immediately skipped)

    const result = await backfillPaperAssetsForSessions(10);

    expect(result).toEqual({ scanned: 2, updated: 1, skipped: 1, created: 1 });
  });
});
