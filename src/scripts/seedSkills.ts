import { prisma } from "../lib/prisma";
import { getDemoProjectId } from "../services/demoProject.service";
import type { KnowledgeNodeLearningState } from "../generated/prisma/client";

interface SeedSkillNode {
  id: string;
  title: string;
  description: string;
  parentId?: string;
  learningState: KnowledgeNodeLearningState;
  isUnlocked: boolean;
  unlockedAt?: Date;
  mastery: number;
  order: number;
  archivedAt?: Date;
}

interface SeedPrerequisite {
  nodeId: string;
  prerequisiteId: string;
}

const UNLOCKED_AT = new Date("2026-06-01T00:00:00.000Z");
const ARCHIVED_AT = new Date("2026-06-09T00:00:00.000Z");

const SEED_SKILLS: SeedSkillNode[] = [
  {
    id: "seed-skill-quadratic-definition",
    title: "二次函数定义",
    description: "理解形如 y = ax^2 + bx + c 且 a 不为 0 的函数，并能判断表达式是否属于二次函数。",
    learningState: "mastered",
    isUnlocked: true,
    unlockedAt: UNLOCKED_AT,
    mastery: 100,
    order: 1
  },
  {
    id: "seed-skill-quadratic-standard-form",
    title: "一般式与参数",
    description: "认识一般式中 a、b、c 的含义，理解参数变化对函数图像与性质的影响。",
    parentId: "seed-skill-quadratic-definition",
    learningState: "learning",
    isUnlocked: true,
    unlockedAt: UNLOCKED_AT,
    mastery: 55,
    order: 1
  },
  {
    id: "seed-skill-quadratic-graph-opening",
    title: "图像与开口方向",
    description: "根据二次项系数判断抛物线开口方向和开口大小，建立代数式与图像的联系。",
    parentId: "seed-skill-quadratic-definition",
    learningState: "not_started",
    isUnlocked: true,
    unlockedAt: UNLOCKED_AT,
    mastery: 20,
    order: 2
  },
  {
    id: "seed-skill-quadratic-vertex-form",
    title: "顶点式",
    description: "掌握 y = a(x - h)^2 + k 的结构，能从顶点式直接读出顶点坐标。",
    parentId: "seed-skill-quadratic-standard-form",
    learningState: "not_started",
    isUnlocked: false,
    mastery: 0,
    order: 1
  },
  {
    id: "seed-skill-quadratic-axis",
    title: "对称轴",
    description: "理解抛物线对称轴的含义，能用顶点式或一般式求出对称轴。",
    parentId: "seed-skill-quadratic-vertex-form",
    learningState: "not_started",
    isUnlocked: false,
    mastery: 0,
    order: 1
  },
  {
    id: "seed-skill-quadratic-roots",
    title: "零点与方程",
    description: "理解二次函数零点与一元二次方程根之间的关系，并能结合图像判断交点。",
    parentId: "seed-skill-quadratic-standard-form",
    learningState: "not_started",
    isUnlocked: false,
    mastery: 0,
    order: 2
  },
  {
    id: "seed-skill-quadratic-extreme-value",
    title: "最值问题",
    description: "结合图像开口方向与顶点坐标，解决二次函数最大值或最小值问题。",
    parentId: "seed-skill-quadratic-vertex-form",
    learningState: "not_started",
    isUnlocked: false,
    mastery: 0,
    order: 2
  },
  {
    id: "seed-skill-quadratic-read-graph",
    title: "从图像读参数",
    description: "根据抛物线图像中的开口、顶点、对称轴和截距反推函数参数。",
    parentId: "seed-skill-quadratic-graph-opening",
    learningState: "not_started",
    isUnlocked: false,
    mastery: 0,
    order: 1
  },
  {
    id: "seed-skill-quadratic-modeling",
    title: "实际应用建模",
    description: "把利润、面积、抛物运动等实际问题抽象为二次函数，并结合定义域解释答案。",
    parentId: "seed-skill-quadratic-graph-opening",
    learningState: "not_started",
    isUnlocked: false,
    mastery: 0,
    order: 2
  },
  {
    id: "seed-skill-quadratic-completing-square-legacy",
    title: "配方法旧版练习",
    description: "旧版配方法专项练习节点，保留用于验证归档节点仍可持久记录。",
    parentId: "seed-skill-quadratic-vertex-form",
    learningState: "not_started",
    isUnlocked: true,
    unlockedAt: UNLOCKED_AT,
    mastery: 30,
    order: 3,
    archivedAt: ARCHIVED_AT
  }
];

const SEED_PREREQUISITES: SeedPrerequisite[] = [
  {
    nodeId: "seed-skill-quadratic-standard-form",
    prerequisiteId: "seed-skill-quadratic-definition"
  },
  {
    nodeId: "seed-skill-quadratic-graph-opening",
    prerequisiteId: "seed-skill-quadratic-definition"
  },
  {
    nodeId: "seed-skill-quadratic-vertex-form",
    prerequisiteId: "seed-skill-quadratic-standard-form"
  },
  {
    nodeId: "seed-skill-quadratic-axis",
    prerequisiteId: "seed-skill-quadratic-vertex-form"
  },
  {
    nodeId: "seed-skill-quadratic-roots",
    prerequisiteId: "seed-skill-quadratic-standard-form"
  },
  {
    nodeId: "seed-skill-quadratic-roots",
    prerequisiteId: "seed-skill-quadratic-graph-opening"
  },
  {
    nodeId: "seed-skill-quadratic-extreme-value",
    prerequisiteId: "seed-skill-quadratic-graph-opening"
  },
  {
    nodeId: "seed-skill-quadratic-extreme-value",
    prerequisiteId: "seed-skill-quadratic-vertex-form"
  },
  {
    nodeId: "seed-skill-quadratic-read-graph",
    prerequisiteId: "seed-skill-quadratic-graph-opening"
  },
  {
    nodeId: "seed-skill-quadratic-read-graph",
    prerequisiteId: "seed-skill-quadratic-axis"
  },
  {
    nodeId: "seed-skill-quadratic-modeling",
    prerequisiteId: "seed-skill-quadratic-extreme-value"
  },
  {
    nodeId: "seed-skill-quadratic-modeling",
    prerequisiteId: "seed-skill-quadratic-roots"
  }
];

async function seedSkills(): Promise<void> {
  const projectId = await getDemoProjectId();
  const seedSkillIds = SEED_SKILLS.map((skill) => skill.id);

  await prisma.$transaction(async (tx) => {
    for (const skill of SEED_SKILLS) {
      await tx.knowledgeNode.upsert({
        where: {
          id: skill.id
        },
        update: {
          projectId,
          parentId: skill.parentId ?? null,
          title: skill.title,
          description: skill.description,
          learningState: skill.learningState,
          isUnlocked: skill.isUnlocked,
          unlockedAt: skill.unlockedAt ?? null,
          mastery: skill.mastery,
          order: skill.order,
          archivedAt: skill.archivedAt ?? null
        },
        create: {
          id: skill.id,
          projectId,
          parentId: skill.parentId,
          title: skill.title,
          description: skill.description,
          learningState: skill.learningState,
          isUnlocked: skill.isUnlocked,
          unlockedAt: skill.unlockedAt,
          mastery: skill.mastery,
          order: skill.order,
          archivedAt: skill.archivedAt
        }
      });
    }

    await tx.knowledgeNodePrerequisite.deleteMany({
      where: {
        nodeId: {
          in: seedSkillIds
        }
      }
    });

    await tx.knowledgeNodePrerequisite.createMany({
      data: SEED_PREREQUISITES
    });
  });

  console.log(
    `Seeded ${SEED_SKILLS.length} skills and ${SEED_PREREQUISITES.length} prerequisite links into ${projectId}.`
  );
}

seedSkills()
  .catch((error: unknown) => {
    console.error("Failed to seed skills.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
