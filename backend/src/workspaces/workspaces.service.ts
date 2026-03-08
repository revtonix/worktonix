import { PrismaClient, Workspace, Prisma } from '@prisma/client';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

const prisma = new PrismaClient();

export class WorkspacesService {
  async findAll(): Promise<Workspace[]> {
    return prisma.workspace.findMany({
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<Workspace | null> {
    return prisma.workspace.findUnique({
      where: { id },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
  }

  async create(dto: CreateWorkspaceDto): Promise<Workspace> {
    // Build the data object matching Prisma's WorkspaceUncheckedCreateInput exactly.
    // taskCount has @default(0) — only set it when the caller provides a value.
    // profileId is String? — not set during creation; left as null by default.
    const data: Prisma.WorkspaceUncheckedCreateInput = {
      name: dto.name,
      userId: dto.ownerId ?? null,
      config: dto.config ? (dto.config as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    };

    if (dto.taskCount !== undefined) {
      data.taskCount = dto.taskCount;
    }

    return prisma.workspace.create({
      data,
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
  }

  async update(id: string, dto: UpdateWorkspaceDto): Promise<Workspace> {
    // Build a Prisma-safe update payload.
    // For nullable String fields: use `null` (not `undefined`) to clear the value.
    // For optional Int fields with defaults: only include when explicitly provided.
    const data: Prisma.WorkspaceUncheckedUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.ownerId !== undefined) {
      data.userId = dto.ownerId;
    }
    if (dto.taskCount !== undefined) {
      data.taskCount = dto.taskCount;
    }
    if (dto.profileId !== undefined) {
      // profileId is String? — Prisma accepts string | null, never undefined
      data.profileId = dto.profileId ?? null;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.staffTaskAssignments !== undefined) {
      data.assignments = dto.staffTaskAssignments as unknown as Prisma.InputJsonValue;
    }

    return prisma.workspace.update({
      where: { id },
      data,
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
  }

  async delete(id: string): Promise<Workspace> {
    return prisma.workspace.delete({ where: { id } });
  }
}
