import "reflect-metadata";
import { existsSync } from "node:fs";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { loadConfig } from "./config";

async function bootstrap() {
  // Local settings live in .env, which is never committed.
  if (existsSync(".env")) process.loadEnvFile(".env");
  const config = loadConfig();
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: config.corsOrigins,
    methods: ["GET", "POST"],
    // The client reads the lip-sync track and cache status from these.
    exposedHeaders: ["X-Speech-Cache", "X-Speech-Key", "X-Mouth-Timeline", "X-Mouth-Fps"]
  });
  await app.listen(config.port);
}

void bootstrap();
