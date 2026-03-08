import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'worktonix-dev-secret-change-in-production';

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  displayName: string;
  iat: number;
  exp: number;
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(
    JSON.stringify({ ...payload, iat: now, exp: now + 86400 }),
  );
  const signature = base64url(
    crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const [header, body, sig] = token.split('.');
    if (!header || !body || !sig) return null;

    const expected = base64url(
      crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest(),
    );
    if (sig !== expected) return null;

    const payload = JSON.parse(
      Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
    ) as JwtPayload;

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}
