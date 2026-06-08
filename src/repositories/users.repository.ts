import { prisma } from "../lib/prisma";

const DEMO_USER_ID = "demo-user";
const DEMO_USER_DISPLAY_NAME = "Demo User";

export const usersRepository = {
  upsertDemoUser() {
    return prisma.user.upsert({
      where: {
        id: DEMO_USER_ID
      },
      update: {},
      create: {
        id: DEMO_USER_ID,
        displayName: DEMO_USER_DISPLAY_NAME
      }
    });
  }
};
