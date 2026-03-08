import { SEED_USERS, type SeedUser } from './seed-users';

export interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
}

export interface StaffTaskAssignment {
  userId: string;
  taskCount: number;
  uaStart: number;
  uaEnd: number;
}

export interface StoredWorkspace {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  config: Record<string, unknown>;
  status: 'ACTIVE' | 'PAUSED' | 'READY' | 'PENDING' | 'LAUNCHING' | 'FAILED';
  taskCount: number;
  profileId?: string;
  assignments?: StaffTaskAssignment[];
  createdAt: string;
}

/**
 * In-memory store — resets on serverless cold start.
 * Replace with a real database in production.
 */
class Store {
  users: SeedUser[];
  workspaces: StoredWorkspace[];

  constructor() {
    this.users = [...SEED_USERS];
    this.workspaces = [];
  }

  getPublicUsers(): StoredUser[] {
    return this.users.map(({ id, email, displayName, role }) => ({
      id,
      email,
      displayName,
      role,
      createdAt: new Date().toISOString(),
    }));
  }

  findUserById(id: string): SeedUser | undefined {
    return this.users.find((u) => u.id === id);
  }

  addUser(user: SeedUser): void {
    this.users.push(user);
  }

  addWorkspace(ws: StoredWorkspace): void {
    this.workspaces.push(ws);
  }

  updateWorkspace(id: string, data: Partial<StoredWorkspace>): StoredWorkspace | null {
    const idx = this.workspaces.findIndex((w) => w.id === id);
    if (idx === -1) return null;
    this.workspaces[idx] = { ...this.workspaces[idx], ...data };
    return this.workspaces[idx];
  }
}

export const store = new Store();
