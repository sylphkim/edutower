import app from "./app";
import { env } from "./config/env";
import { logger } from "./utils/logger";

const server = app.listen(env.port, () => {
  logger.info(`Server is running on http://localhost:${env.port}`);
});

server.on("error", (error) => {
  logger.error("Server failed to start.", error);
  process.exit(1);
});
