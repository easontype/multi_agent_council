jest.mock("@/lib/db/db", () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock("@/lib/tools/handlers/rag", () => ({
  embedDocumentById: jest.fn(),
}));

import { ingestPaper } from "@/lib/paper-ingest";
import { db } from "@/lib/db/db";
import { embedDocumentById } from "@/lib/tools/handlers/rag";

const mockedDbQuery = jest.mocked(db.query);
const mockedEmbedDocumentById = jest.mocked(embedDocumentById);

describe("ingestPaper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("waits for the inserted document to be embedded before resolving", async () => {
    mockedDbQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: "doc-123" }] } as never);
    mockedEmbedDocumentById.mockResolvedValue({
      chunkCount: 3,
      embeddedChunkCount: 3,
      fallbackChunkCount: 0,
    });

    const result = await ingestPaper({
      title: "Test Paper",
      text: "This is a test paper body that is long enough to be chunked and embedded.",
      sourceUrl: "https://example.com/paper.pdf",
      libraryId: "paper:test-lib",
    });

    expect(mockedEmbedDocumentById).toHaveBeenCalledWith("doc-123");
    expect(result.documentId).toBe("doc-123");
    expect(result.libraryId).toBe("paper:test-lib");
  });

  it("fails the ingest when embedding the inserted document fails", async () => {
    mockedDbQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [{ id: "doc-456" }] } as never);
    mockedEmbedDocumentById.mockRejectedValue(new Error("embedding unavailable"));

    await expect(ingestPaper({
      title: "Broken Paper",
      text: "This paper should fail because embedding did not complete successfully.",
      sourceUrl: "https://example.com/broken.pdf",
    })).rejects.toThrow("embedding unavailable");

    expect(mockedEmbedDocumentById).toHaveBeenCalledWith("doc-456");
  });
});
