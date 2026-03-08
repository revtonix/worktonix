/**
 * Route definitions with role guards.
 *
 * Role access summary:
 *   ADMIN   — full access to everything
 *   TECH    — workspaces CRUD, staff management, profile creation
 *   MANAGER — workspace operations, view staff
 *   STAFF   — own workspace operations only
 */

const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../guards/roles');

const router = express.Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticate);

// ─── Users ──────────────────────────────────────────────────────────
// GET /api/users?role=OPERATOR  — list users, optionally filtered by role
router.get('/api/users', requirePermission('staff:read'), async (req, res) => {
  try {
    const where = {};
    if (req.query.role) {
      where.role = req.query.role;
    }
    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, displayName: true, role: true, createdAt: true },
      orderBy: { displayName: 'asc' },
    });
    return res.json(users);
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({ message: 'Failed to list users' });
  }
});

// ─── Workspace routes ───────────────────────────────────────────────
router.get('/api/workspaces', requirePermission('workspaces:read'), async (req, res) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(workspaces);
  } catch (err) {
    console.error('List workspaces error:', err);
    return res.status(500).json({ message: 'Failed to list workspaces' });
  }
});

router.post('/api/workspaces', requirePermission('workspaces:create'), async (req, res) => {
  try {
    const { name, ownerId, config, taskCount } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return res.status(400).json({ message: 'Name is required (min 3 characters)' });
    }

    // Validate owner exists if provided
    if (ownerId) {
      const owner = await prisma.user.findUnique({ where: { id: ownerId } });
      if (!owner) {
        return res.status(400).json({ message: 'Assigned user not found' });
      }
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: name.trim(),
        userId: ownerId || null,
        config: config || null,
        taskCount: typeof taskCount === 'number' ? taskCount : 0,
      },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });

    return res.status(201).json(workspace);
  } catch (err) {
    console.error('Create workspace error:', err);
    return res.status(500).json({ message: 'Failed to create workspace' });
  }
});

router.put('/api/workspaces/:id', requirePermission('workspaces:update'), async (req, res) => {
  try {
    const { name, ownerId, config, taskCount, staffTaskAssignments, profileId, status } = req.body;
    const workspace = await prisma.workspace.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(ownerId !== undefined && { userId: ownerId }),
        ...(config !== undefined && { config }),
        ...(typeof taskCount === 'number' && { taskCount }),
        ...(staffTaskAssignments !== undefined && { assignments: staffTaskAssignments }),
        ...(profileId !== undefined && { profileId }),
        ...(status !== undefined && { status }),
      },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
    return res.json(workspace);
  } catch (err) {
    console.error('Update workspace error:', err);
    return res.status(500).json({ message: 'Failed to update workspace' });
  }
});

// PATCH for Electron/external profile updates
router.patch('/api/workspaces/:id', requirePermission('workspaces:update'), async (req, res) => {
  try {
    const { profileId, status, error: errorMsg } = req.body;
    const workspace = await prisma.workspace.update({
      where: { id: req.params.id },
      data: {
        ...(profileId !== undefined && { profileId }),
        ...(status !== undefined && { status }),
        ...(errorMsg !== undefined && { config: { error: errorMsg } }),
      },
    });
    return res.json(workspace);
  } catch (err) {
    console.error('Patch workspace error:', err);
    return res.status(500).json({ message: 'Failed to update workspace' });
  }
});

router.delete('/api/workspaces/:id', requirePermission('workspaces:delete'), async (req, res) => {
  try {
    await prisma.workspace.delete({ where: { id: req.params.id } });
    return res.json({ message: 'Workspace deleted' });
  } catch (err) {
    console.error('Delete workspace error:', err);
    return res.status(500).json({ message: 'Failed to delete workspace' });
  }
});

router.post('/api/workspaces/:id/launch', requirePermission('workspaces:launch'), async (req, res) => {
  try {
    const workspace = await prisma.workspace.update({
      where: { id: req.params.id },
      data: { status: 'running' },
    });
    return res.json(workspace);
  } catch (err) {
    console.error('Launch workspace error:', err);
    return res.status(500).json({ message: 'Failed to launch workspace' });
  }
});

router.post('/api/workspaces/:id/stop', requirePermission('workspaces:stop'), async (req, res) => {
  try {
    const workspace = await prisma.workspace.update({
      where: { id: req.params.id },
      data: { status: 'stopped' },
    });
    return res.json(workspace);
  } catch (err) {
    console.error('Stop workspace error:', err);
    return res.status(500).json({ message: 'Failed to stop workspace' });
  }
});

// ─── Staff management (TECH and above) ─────────────────────────────
router.get('/api/staff', requirePermission('staff:read'), async (req, res) => {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ['OPERATOR', 'STAFF'] } },
      select: { id: true, email: true, displayName: true, role: true, createdAt: true },
      orderBy: { displayName: 'asc' },
    });
    return res.json(staff);
  } catch (err) {
    console.error('List staff error:', err);
    return res.status(500).json({ message: 'Failed to list staff' });
  }
});

router.post('/api/staff', requirePermission('staff:create'), (req, res) => {
  res.json({ message: 'create staff' });
});

router.put('/api/staff/:id', requirePermission('staff:update'), (req, res) => {
  res.json({ message: 'update staff' });
});

router.delete('/api/staff/:id', requirePermission('staff:delete'), (req, res) => {
  res.json({ message: 'delete staff — ADMIN only' });
});

// ─── Profile creation (TECH and above) ──────────────────────────────
router.post('/api/profiles', requirePermission('profiles:create'), (req, res) => {
  res.json({ message: 'create profile' });
});

router.get('/api/profiles', requirePermission('profiles:read'), (req, res) => {
  res.json({ message: 'list profiles' });
});

// ─── Billing (ADMIN only) ───────────────────────────────────────────
router.get('/api/billing', requirePermission('billing:read'), (req, res) => {
  res.json({ message: 'view billing — ADMIN only' });
});

router.put('/api/billing', requirePermission('billing:update'), (req, res) => {
  res.json({ message: 'update billing — ADMIN only' });
});

// ─── System settings (ADMIN only) ───────────────────────────────────
router.get('/api/settings', requirePermission('settings:read'), (req, res) => {
  res.json({ message: 'view settings — ADMIN only' });
});

router.put('/api/settings', requirePermission('settings:update'), (req, res) => {
  res.json({ message: 'update settings — ADMIN only' });
});

module.exports = router;
