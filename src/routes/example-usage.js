/**
 * Example route definitions showing role guard usage.
 *
 * Role access summary:
 *   ADMIN   — full access to everything
 *   TECH    — workspaces CRUD, staff management, profile creation
 *   MANAGER — workspace operations, view staff
 *   STAFF   — own workspace operations only
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireRole, requirePermission } = require('../guards/roles');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// --- Workspace routes (STAFF and above can read/launch/stop) ---
router.get('/api/workspaces', requirePermission('workspaces:read'), (req, res) => {
  res.json({ message: 'list workspaces' });
});

router.post('/api/workspaces', requirePermission('workspaces:create'), (req, res) => {
  res.json({ message: 'create workspace' });
});

router.put('/api/workspaces/:id', requirePermission('workspaces:update'), (req, res) => {
  res.json({ message: 'update workspace' });
});

router.delete('/api/workspaces/:id', requirePermission('workspaces:delete'), (req, res) => {
  res.json({ message: 'delete workspace' });
});

router.post('/api/workspaces/:id/launch', requirePermission('workspaces:launch'), (req, res) => {
  res.json({ message: 'launch workspace' });
});

router.post('/api/workspaces/:id/stop', requirePermission('workspaces:stop'), (req, res) => {
  res.json({ message: 'stop workspace' });
});

// --- Staff management (TECH and above) ---
router.get('/api/staff', requirePermission('staff:read'), (req, res) => {
  res.json({ message: 'list staff' });
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

// --- Profile creation (TECH and above) ---
router.post('/api/profiles', requirePermission('profiles:create'), (req, res) => {
  res.json({ message: 'create profile' });
});

router.get('/api/profiles', requirePermission('profiles:read'), (req, res) => {
  res.json({ message: 'list profiles' });
});

// --- Billing (ADMIN only) ---
router.get('/api/billing', requirePermission('billing:read'), (req, res) => {
  res.json({ message: 'view billing — ADMIN only' });
});

router.put('/api/billing', requirePermission('billing:update'), (req, res) => {
  res.json({ message: 'update billing — ADMIN only' });
});

// --- System settings (ADMIN only) ---
router.get('/api/settings', requirePermission('settings:read'), (req, res) => {
  res.json({ message: 'view settings — ADMIN only' });
});

router.put('/api/settings', requirePermission('settings:update'), (req, res) => {
  res.json({ message: 'update settings — ADMIN only' });
});

module.exports = router;
