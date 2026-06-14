import { usersRepository } from "../repositories/users.repository";
import { projectsRepository } from "../repositories/projects.repository";
import type { User } from "../generated/prisma/client";

// Demo 种子单例：用 Prisma 懒加载并缓存 demo 用户 / demo 项目，失败时清空缓存以便重试。
// 原 demoUser.service + demoProject.service 合并而来（同属一类「demo 种子」）。

let demoUserPromise: Promise<User> | undefined;

export async function getDemoUserId(): Promise<string> {
  demoUserPromise ??= usersRepository.upsertDemoUser().catch((error) => {
    demoUserPromise = undefined;
    throw error;
  });

  const user = await demoUserPromise;
  return user.id;
}

let demoProjectPromise: Promise<string> | undefined;

export async function getDemoProjectId(): Promise<string> {
  demoProjectPromise ??= (async () => {
    const userId = await getDemoUserId();
    const project = await projectsRepository.upsertDemoProject(userId);
    return project.id;
  })().catch((error) => {
    demoProjectPromise = undefined;
    throw error;
  });

  return demoProjectPromise;
}
