const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

/**
 * POST /api/auth/login
 *
 * Authenticates any user regardless of role. Role-based access control
 * happens AFTER login — in route guards and frontend routing.
 * All roles (ADMIN, TECH, MANAGER, STAFF/OPERATOR) can log in.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // No role filtering — all roles can authenticate
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
      },
      JWT_SECRET,
      { expiresIn: '24h' },
    );

    return res.json({
      token,
      userId: user.id,
      name: user.displayName,
      role: user.role,
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 *
 * Returns the authenticated user's profile.
 */
router.get('/me', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub || req.user.id },
      select: { id: true, email: true, displayName: true, role: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json(user);
  } catch (err) {
    console.error('Profile fetch error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
