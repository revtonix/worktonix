const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'worktonix-dev-secret';

/**
 * Express middleware — verify JWT and attach user to req.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, role, displayName }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate, JWT_SECRET };
