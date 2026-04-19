jest.mock("@/lib/auth-account", () => ({
  resolveAuthAccountContext: jest.fn(),
}));

jest.mock("@/lib/team-templates", () => ({
  listTeamTemplatesForWorkspace: jest.fn(),
  upsertTeamTemplate: jest.fn(),
  deleteTeamTemplate: jest.fn(),
}));

import { GET, POST } from "@/app/api/team-templates/route";
import { DELETE } from "@/app/api/team-templates/[id]/route";
import { resolveAuthAccountContext } from "@/lib/auth-account";
import { listTeamTemplatesForWorkspace, upsertTeamTemplate, deleteTeamTemplate } from "@/lib/team-templates";

const mockedResolveAuthAccountContext = jest.mocked(resolveAuthAccountContext);
const mockedListTeamTemplatesForWorkspace = jest.mocked(listTeamTemplatesForWorkspace);
const mockedUpsertTeamTemplate = jest.mocked(upsertTeamTemplate);
const mockedDeleteTeamTemplate = jest.mocked(deleteTeamTemplate);

describe("team template ownership routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires an authenticated account context for listing templates", async () => {
    mockedResolveAuthAccountContext.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockedListTeamTemplatesForWorkspace).not.toHaveBeenCalled();
  });

  it("lists templates for the active workspace", async () => {
    mockedResolveAuthAccountContext.mockResolvedValue({
      userId: "user-1",
      workspaceId: "ws-1",
      role: "owner",
      email: "user@example.com",
      displayName: "User",
    });
    mockedListTeamTemplatesForWorkspace.mockResolvedValue([
      {
        id: "tmpl-1",
        workspaceId: "ws-1",
        createdByUserId: "user-1",
        name: "Critique Team",
        mode: "critique",
        rounds: 1,
        agents: [],
        createdAt: "2026-04-19T00:00:00.000Z",
        updatedAt: "2026-04-19T00:00:00.000Z",
      },
    ]);

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockedListTeamTemplatesForWorkspace).toHaveBeenCalledWith("ws-1");
    expect(json).toHaveLength(1);
  });

  it("upserts templates using the active workspace and creator ids", async () => {
    mockedResolveAuthAccountContext.mockResolvedValue({
      userId: "user-1",
      workspaceId: "ws-1",
      role: "owner",
      email: "user@example.com",
      displayName: "User",
    });
    mockedUpsertTeamTemplate.mockResolvedValue({
      id: "tmpl-1",
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      name: "Critique Team",
      mode: "critique",
      rounds: 2,
      agents: [],
      createdAt: "2026-04-19T00:00:00.000Z",
      updatedAt: "2026-04-19T00:00:00.000Z",
    });
    mockedListTeamTemplatesForWorkspace.mockResolvedValue([]);

    const response = await POST(new Request("http://localhost/api/team-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "tmpl-1",
        name: "Critique Team",
        mode: "critique",
        rounds: 2,
        agents: [],
      }),
    }));

    expect(response.status).toBe(200);
    expect(mockedUpsertTeamTemplate).toHaveBeenCalledWith({
      id: "tmpl-1",
      workspaceId: "ws-1",
      createdByUserId: "user-1",
      name: "Critique Team",
      mode: "critique",
      rounds: 2,
      agents: [],
    });
  });

  it("deletes templates only within the active workspace", async () => {
    mockedResolveAuthAccountContext.mockResolvedValue({
      userId: "user-1",
      workspaceId: "ws-1",
      role: "owner",
      email: "user@example.com",
      displayName: "User",
    });
    mockedDeleteTeamTemplate.mockResolvedValue(true);
    mockedListTeamTemplatesForWorkspace.mockResolvedValue([]);

    const response = await DELETE(new Request("http://localhost/api/team-templates/tmpl-1"), {
      params: Promise.resolve({ id: "tmpl-1" }),
    });

    expect(response.status).toBe(200);
    expect(mockedDeleteTeamTemplate).toHaveBeenCalledWith("tmpl-1", "ws-1");
  });
});
