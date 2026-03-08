import { NextRequest, NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/jwt';
import { store } from '@/lib/store';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token || !verifyJwt(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(store.workspaces);
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

  const ownerId = typeof body.ownerId === 'string' ? body.ownerId : payload.sub;
  const owner = store.findUserById(ownerId);
  const taskCount = typeof body.taskCount === 'number' ? body.taskCount : 0;

  store.addWorkspace({
    id: crypto.randomUUID(),
    name: body.name.trim(),
    ownerId,
    ownerName: owner?.displayName ?? 'Unknown',
    config: typeof body.config === 'object' && body.config !== null ? body.config : {},
    status: 'PENDING',
    taskCount,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json(store.workspaces[store.workspaces.length - 1], { status: 201 });
}

export async function PUT(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const payload = token ? verifyJwt(token) : null;

  if (!payload) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== 'string') {
    return NextResponse.json({ message: 'Workspace id is required' }, { status: 400 });
  }

  const updated = store.updateWorkspace(body.id, {
    ...(body.staffTaskAssignments && { assignments: body.staffTaskAssignments }),
    ...(body.profileId && { profileId: body.profileId }),
    ...(body.status && { status: body.status }),
  });

  if (!updated) {
    return NextResponse.json({ message: 'Workspace not found' }, { status: 404 });
  }

  return NextResponse.json(updated);
}
