import { Router, Request, Response } from 'express';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

const router = Router();
const service = new WorkspacesService();

// GET /api/workspaces
router.get('/', async (_req: Request, res: Response) => {
  try {
    const workspaces = await service.findAll();
    return res.json(workspaces);
  } catch (err) {
    console.error('List workspaces error:', err);
    return res.status(500).json({ message: 'Failed to list workspaces' });
  }
});

// GET /api/workspaces/:id
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const workspace = await service.findById(req.params.id);
    if (!workspace) return res.status(404).json({ message: 'Workspace not found' });
    return res.json(workspace);
  } catch (err) {
    console.error('Get workspace error:', err);
    return res.status(500).json({ message: 'Failed to get workspace' });
  }
});

// POST /api/workspaces
router.post('/', async (req: Request, res: Response) => {
  try {
    const dto: CreateWorkspaceDto = req.body;
    if (!dto.name || dto.name.trim().length < 3) {
      return res.status(400).json({ message: 'Name is required (min 3 characters)' });
    }
    const workspace = await service.create(dto);
    return res.status(201).json(workspace);
  } catch (err) {
    console.error('Create workspace error:', err);
    return res.status(500).json({ message: 'Failed to create workspace' });
  }
});

// PUT /api/workspaces/:id
router.put('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const dto: UpdateWorkspaceDto = req.body;
    const workspace = await service.update(req.params.id, dto);
    return res.json(workspace);
  } catch (err) {
    console.error('Update workspace error:', err);
    return res.status(500).json({ message: 'Failed to update workspace' });
  }
});

// PATCH /api/workspaces/:id
router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const dto: UpdateWorkspaceDto = req.body;
    const workspace = await service.update(req.params.id, dto);
    return res.json(workspace);
  } catch (err) {
    console.error('Patch workspace error:', err);
    return res.status(500).json({ message: 'Failed to update workspace' });
  }
});

// DELETE /api/workspaces/:id
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    await service.delete(req.params.id);
    return res.status(204).send();
  } catch (err) {
    console.error('Delete workspace error:', err);
    return res.status(500).json({ message: 'Failed to delete workspace' });
  }
});

export default router;
