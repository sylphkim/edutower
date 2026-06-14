import { prisma } from "../lib/prisma";
import type {
  ProjectStatus,
  StudyProject,
  StudyTaskStatus,
  StudyTaskType
} from "../generated/prisma/client";
import type {
  StudyProjectGetPayload,
  StudyProjectInclude
} from "../generated/prisma/models";

const DEMO_PROJECT_ID = "demo-project";
const DEMO_PROJECT_TITLE = "Demo Study Project";

export interface CreateStudyTaskRecordInput {
  id: string;
  title: string;
  type: StudyTaskType;
  day?: number;
  order: number;
  knowledgeNodeId?: string;
  materialId?: string;
  status: StudyTaskStatus;
}

export interface SaveProjectPlanInput {
  userId: string;
  title: string;
  goal: string;
  status: ProjectStatus;
  materialIds: string[];
  tasks: CreateStudyTaskRecordInput[];
}

export interface UpdateProjectSetupRecord {
  title?: string;
  subject?: string;
  goal?: string;
  targetScore?: string | null;
  deadline?: Date | null;
  startDate?: Date | null;
  dailyMinutes?: number | null;
  goalConfirmedAt?: Date | null;
}

const planInclude = {
  materialLinks: true,
  knowledgeNodes: true,
  studyTasks: {
    orderBy: [
      {
        day: "asc"
      },
      {
        order: "asc"
      },
      {
        createdAt: "asc"
      }
    ]
  }
} satisfies StudyProjectInclude;

export type StudyProjectWithPlan = StudyProjectGetPayload<{
  include: typeof planInclude;
}>;

export const projectsRepository = {
  upsertDemoProject(userId: string): Promise<StudyProject> {
    return prisma.studyProject.upsert({
      where: {
        id: DEMO_PROJECT_ID
      },
      update: {},
      create: {
        id: DEMO_PROJECT_ID,
        userId,
        title: DEMO_PROJECT_TITLE,
        subject: "General Study",
        goal: "",
        status: "planning"
      }
    });
  },

  listByUser(userId: string): Promise<StudyProjectWithPlan[]> {
    return prisma.studyProject.findMany({
      where: {
        userId
      },
      include: planInclude,
      orderBy: [
        {
          createdAt: "asc"
        },
        {
          id: "asc"
        }
      ]
    });
  },

  findByIdForUser(id: string, userId: string): Promise<StudyProjectWithPlan | null> {
    return prisma.studyProject.findFirst({
      where: {
        id,
        userId
      },
      include: planInclude
    });
  },

  findExistingMaterialIdsForUser(ids: string[], userId: string): Promise<string[]> {
    return prisma.material
      .findMany({
        where: {
          id: {
            in: ids
          },
          userId
        },
        select: {
          id: true
        }
      })
      .then((items) => items.map((item) => item.id));
  },

  findSetupByIdForUser(id: string, userId: string): Promise<StudyProject | null> {
    return prisma.studyProject.findFirst({
      where: {
        id,
        userId
      }
    });
  },

  updateSetup(
    id: string,
    userId: string,
    data: UpdateProjectSetupRecord
  ): Promise<StudyProject> {
    return prisma.studyProject.update({
      where: {
        id,
        userId
      },
      data
    });
  },

  async createPlan(input: SaveProjectPlanInput): Promise<StudyProjectWithPlan> {
    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.studyProject.create({
        data: {
          userId: input.userId,
          title: input.title,
          subject: input.title,
          goal: input.goal,
          status: input.status,
          studyTasks: {
            create: input.tasks
          }
        }
      });

      if (input.materialIds.length > 0) {
        await tx.projectMaterial.createMany({
          data: input.materialIds.map((materialId) => ({
            projectId: createdProject.id,
            materialId
          }))
        });
      }

      return createdProject;
    });

    return this.findByIdForUser(project.id, input.userId) as Promise<StudyProjectWithPlan>;
  },

  async updatePlan(
    id: string,
    input: Partial<SaveProjectPlanInput>
  ): Promise<StudyProjectWithPlan> {
    await prisma.$transaction(async (tx) => {
      await tx.studyProject.update({
        where: {
          id,
          userId: input.userId
        },
        data: {
          title: input.title,
          subject: input.title,
          goal: input.goal,
          status: input.status
        }
      });

      if (input.materialIds) {
        await tx.projectMaterial.deleteMany({
          where: {
            projectId: id
          }
        });

        if (input.materialIds.length > 0) {
          await tx.projectMaterial.createMany({
            data: input.materialIds.map((materialId) => ({
              projectId: id,
              materialId
            }))
          });
        }
      }

      if (input.tasks) {
        // Legacy plan API only manages day-based tasks. Daily task sheets own
        // their tasks via dailyTaskSheetId and must survive legacy plan updates.
        await tx.studyTask.deleteMany({
          where: {
            projectId: id,
            dailyTaskSheetId: null
          }
        });

        if (input.tasks.length > 0) {
          await tx.studyTask.createMany({
            data: input.tasks.map((task) => ({
              ...task,
              projectId: id
            }))
          });
        }
      }
    });

    return this.findByIdForUser(id, input.userId!) as Promise<StudyProjectWithPlan>;
  },

  deleteByIdForUser(id: string, userId: string): Promise<StudyProject> {
    return prisma.studyProject.delete({
      where: {
        id,
        userId
      }
    });
  }
};
