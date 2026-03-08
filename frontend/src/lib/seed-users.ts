import type { Role } from './auth';

export interface SeedUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
  role: Role;
}

/**
 * Seed users for development / demo.
 * In production, replace with a real database.
 */
export const SEED_USERS: SeedUser[] = [
  {
    id: '1',
    email: 'admin@worktonix.io',
    password: 'admin1234',
    displayName: 'Admin User',
    role: 'ADMIN',
  },
  {
    id: '2',
    email: 'tech@worktonix.io',
    password: 'tech1234',
    displayName: 'Tech Lead',
    role: 'TECH',
  },
  {
    id: '3',
    email: 'manager@worktonix.io',
    password: 'manager1234',
    displayName: 'Manager One',
    role: 'MANAGER',
  },
  {
    id: '4',
    email: 'operator@worktonix.io',
    password: 'operator1234',
    displayName: 'Operator One',
    role: 'OPERATOR',
  },
  {
    id: '5',
    email: 'staff@worktonix.io',
    password: 'staff1234',
    displayName: 'Staff Member',
    role: 'STAFF',
  },
];
