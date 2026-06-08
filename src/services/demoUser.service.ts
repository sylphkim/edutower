import { usersRepository } from "../repositories/users.repository";
import type { User } from "../generated/prisma/client";

let demoUserPromise: Promise<User> | undefined;

export async function getDemoUserId(): Promise<string> {
  demoUserPromise ??= usersRepository.upsertDemoUser().catch((error) => {
    demoUserPromise = undefined;
    throw error;
  });

  const user = await demoUserPromise;
  return user.id;
}
