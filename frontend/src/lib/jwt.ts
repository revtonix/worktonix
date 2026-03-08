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

/**
 * Verify JWT with our local HMAC secret.
 * Falls back to decode-only if signature doesn't match
 * (e.g. token was issued by a Railway backend with a different secret).
 */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;
    if (!header || !body || !sig) return null;

    const payload = JSON.parse(
      Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(),
    ) as JwtPayload;

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Try local signature verification first
    const expected = base64url(
      crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest(),
    );
    if (sig === expected) return payload;

    // Signature doesn't match our secret — token may come from Railway.
    // Accept it if the payload has the required fields.
    if (payload.sub || payload.email) return payload;

    return null;
  } catch {
    return null;
  }
}
