import { projectsRepository } from "../repositories/projects.repository";
import { getDemoUserId } from "./demoUser.service";

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
