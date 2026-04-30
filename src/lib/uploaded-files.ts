import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { db } from "@/lib/db/db";
import { ensureAccountSchema } from "@/lib/db/account-db";

export interface UploadedFileRecord {
  id: string;
  workspace_id: string | null;
  created_by_user_id: string | null;
  filename: string;
  mime_type: string | null;
  size_bytes: number;
  checksum_sha256: string;
  source_route: string;
  document_id: string | null;
  library_id: string | null;
  created_at: string;
}

let uploadedFileSchemaReady: Promise<void> | null = null;

export async function ensureUploadedFileSchema(): Promise<void> {
  if (!uploadedFileSchemaReady) {
    uploadedFileSchemaReady = (async () => {
      await ensureAccountSchema();
      await db.query(`
        CREATE TABLE IF NOT EXISTS uploaded_files (
          id                 TEXT PRIMARY KEY,
          workspace_id       TEXT REFERENCES workspaces(id),
          created_by_user_id TEXT REFERENCES users(id),
          filename           TEXT NOT NULL,
          mime_type          TEXT,
          size_bytes         BIGINT NOT NULL,
          checksum_sha256    TEXT NOT NULL,
          source_route       TEXT NOT NULL,
          document_id        TEXT,
          library_id         TEXT,
          created_at         TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_uploaded_files_workspace_id
          ON uploaded_files(workspace_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_uploaded_files_created_by_user_id
          ON uploaded_files(created_by_user_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_uploaded_files_document_id
          ON uploaded_files(document_id);
      `);
    })().catch((error) => {
      uploadedFileSchemaReady = null;
      throw error;
    });
  }

  await uploadedFileSchemaReady;
}

function mapUploadedFileRow(row: Record<string, unknown>): UploadedFileRecord {
  return {
    id: String(row.id),
    workspace_id: row.workspace_id ? String(row.workspace_id) : null,
    created_by_user_id: row.created_by_user_id ? String(row.created_by_user_id) : null,
    filename: String(row.filename ?? ""),
    mime_type: row.mime_type ? String(row.mime_type) : null,
    size_bytes: Number(row.size_bytes ?? 0),
    checksum_sha256: String(row.checksum_sha256 ?? ""),
    source_route: String(row.source_route ?? ""),
    document_id: row.document_id ? String(row.document_id) : null,
    library_id: row.library_id ? String(row.library_id) : null,
    created_at: String(row.created_at ?? ""),
  };
}

export async function recordUploadedFile(input: {
  workspaceId?: string | null;
  createdByUserId?: string | null;
  filename: string;
  mimeType?: string | null;
  sizeBytes: number;
  buffer: Buffer;
  sourceRoute: string;
  documentId?: string | null;
  libraryId?: string | null;
}): Promise<UploadedFileRecord> {
  await ensureUploadedFileSchema();

  const checksum = createHash("sha256").update(input.buffer).digest("hex");
  const { rows } = await db.query(
    `INSERT INTO uploaded_files (
       id, workspace_id, created_by_user_id, filename, mime_type, size_bytes,
       checksum_sha256, source_route, document_id, library_id
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      nanoid(),
      input.workspaceId ?? null,
      input.createdByUserId ?? null,
      input.filename.trim(),
      input.mimeType?.trim() || null,
      input.sizeBytes,
      checksum,
      input.sourceRoute.trim(),
      input.documentId ?? null,
      input.libraryId ?? null,
    ],
  );

  return mapUploadedFileRow(rows[0] as Record<string, unknown>);
}
