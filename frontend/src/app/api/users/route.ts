import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { verifyJwt } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token || !verifyJwt(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const roleFilter = request.nextUrl.searchParams.get('role');

  const users = store
    .getPublicUsers()
    .filter((u) => !roleFilter || u.role === roleFilter);

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const caller = token ? verifyJwt(token) : null;

  if (!caller) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.email !== 'string' ||
    typeof body.displayName !== 'string' ||
    typeof body.role !== 'string'
  ) {
    return NextResponse.json(
      { message: 'email, displayName, and role are required' },
      { status: 400 },
    );
  }

  const existing = store.getPublicUsers().find((u) => u.email === body.email);
  if (existing) {
    return NextResponse.json({ message: 'A user with this email already exists' }, { status: 409 });
  }

  const newUser = {
    id: crypto.randomUUID(),
    email: body.email as string,
    password: 'changeme123',
    displayName: body.displayName as string,
    role: body.role as 'ADMIN' | 'TECH' | 'MANAGER' | 'OPERATOR' | 'STAFF',
  };

  store.addUser(newUser);

  return NextResponse.json(
    { id: newUser.id, email: newUser.email, displayName: newUser.displayName, role: newUser.role },
    { status: 201 },
  );
}
