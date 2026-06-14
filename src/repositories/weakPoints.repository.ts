import { prisma } from "../lib/prisma";
import type { WeakPoint } from "../generated/prisma/client";

export const weakPointsRepository = {
  // 某项目下「仍在生效」的薄弱点（已解决/忽略的不带入聊天上下文）。
  listActiveByProject(projectId: string): Promise<WeakPoint[]> {
    return prisma.weakPoint.findMany({
      where: {
        projectId,
        status: "active"
      },
      orderBy: [
        {
          createdAt: "asc"
        },
        {
          id: "asc"
        }
      ]
    });
  }
};
