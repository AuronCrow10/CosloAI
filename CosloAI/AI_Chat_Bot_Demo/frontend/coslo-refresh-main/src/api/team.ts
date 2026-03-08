// src/api/team.ts
import { authFetchJson } from "./authorizedClient";

export type TeamBotAccess = {
  id: string;
  name: string;
};

export type TeamMemberItem = {
  userId: string;
  email: string;
  name: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  bots: TeamBotAccess[];
};

export type TeamInviteItem = {
  id: string;
  email: string;
  createdAt: string;
  bots: TeamBotAccess[];
};

export type TeamMembersResponse = {
  members: TeamMemberItem[];
  invites: TeamInviteItem[];
};

export async function createTeamInvite(
  email: string,
  botIds: string[]
): Promise<TeamInviteItem> {
  return authFetchJson<TeamInviteItem>("/team/invites", {
    method: "POST",
    body: JSON.stringify({ email, botIds })
  });
}

export async function fetchTeamMembers(): Promise<TeamMembersResponse> {
  return authFetchJson<TeamMembersResponse>("/team/members");
}

export async function revokeTeamInvite(inviteId: string): Promise<{ ok: boolean }> {
  return authFetchJson<{ ok: boolean }>(`/team/invites/${encodeURIComponent(inviteId)}`, {
    method: "DELETE"
  });
}

export async function revokeTeamMember(userId: string): Promise<{ ok: boolean }> {
  return authFetchJson<{ ok: boolean }>(`/team/members/${encodeURIComponent(userId)}`, {
    method: "DELETE"
  });
}

export async function updateTeamMemberBots(
  userId: string,
  botIds: string[]
): Promise<{ ok: boolean }> {
  return authFetchJson<{ ok: boolean }>(`/team/members/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify({ botIds })
  });
}
