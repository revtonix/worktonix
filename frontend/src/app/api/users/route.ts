import { NextRequest, NextResponse } from 'next/server';
import { SEED_USERS } from '@/lib/seed-users';
import { verifyJwt } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token || !verifyJwt(token)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const roleFilter = request.nextUrl.searchParams.get('role');

  const users = SEED_USERS
    .filter((u) => !roleFilter || u.role === roleFilter)
    .map(({ id, email, displayName, role }) => ({ id, email, displayName, role }));

  return NextResponse.json(users);
}
