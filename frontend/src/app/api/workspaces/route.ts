import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/jwt';

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  config: Record<string, unknown>;
  createdAt: string;
}

// In-memory store (resets on cold start — replace with a real DB in production)
const workspaces: Workspace[] = [];

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token || !verifyJwt(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(workspaces);
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = token ? verifyJwt(token) : null;

  if (!payload) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ message: 'Workspace name is required' }, { status: 400 });
  }

  const workspace: Workspace = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    ownerId: typeof body.ownerId === 'string' ? body.ownerId : payload.sub,
    config: typeof body.config === 'object' && body.config !== null ? body.config : {},
    createdAt: new Date().toISOString(),
  };

  workspaces.push(workspace);

  return NextResponse.json(workspace, { status: 201 });
}
