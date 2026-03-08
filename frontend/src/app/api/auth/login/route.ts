import { NextResponse } from 'next/server';
import { SEED_USERS } from '@/lib/seed-users';
import { signJwt } from '@/lib/jwt';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
  }

  const user = SEED_USERS.find(
    (u) => u.email === body.email && u.password === body.password,
  );

  if (!user) {
    return NextResponse.json({ message: 'Invalid email or password' }, { status: 401 });
  }

  const token = signJwt({
    sub: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
  });

  return NextResponse.json({
    token,
    accessToken: token,
    userId: user.id,
    name: user.displayName,
    role: user.role,
  });
}
