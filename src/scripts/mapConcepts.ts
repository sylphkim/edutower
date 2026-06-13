import { conceptsRepository } from "../repositories/concepts.repository";
import { conceptMappingService } from "../services/conceptMapping.service";
import { getDemoUserId } from "../services/demoUser.service";
import { projectsRepository } from "../repositories/projects.repository";

/**
 * 一次性回填脚本：把 demo 用户各项目的知识点映射进概念账本。
 * 运行：npm run map:concepts
 */
async function main(): Promise<void> {
  const userId = await getDemoUserId();
  const projects = await projectsRepository.listByUser(userId);

  for (const project of projects) {
    const { mapped, skipped } = await conceptMappingService.mapProjectNodes(userId, project.id);
    console.log(`项目「${project.title}」：映射 ${mapped} 个节点，跳过 ${skipped} 个。`);
  }

  const concepts = await conceptsRepository.listConcepts(userId);
  console.log(`\n完成：用户共有 ${concepts.length} 个概念。`);

  for (const concept of concepts) {
    const suffix = concept.subject ? `, subject=${concept.subject}` : "";
    console.log(`  - ${concept.name}  [key=${concept.key}${suffix}]`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
