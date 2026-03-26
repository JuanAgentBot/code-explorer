export const TYPE_MAP_SAMPLE = `interface Entity {
  id: string;
  createdAt: Date;
}

interface Repository<T extends Entity> {
  findById(id: string): T | undefined;
  save(entity: T): void;
}

interface User extends Entity {
  name: string;
  email: string;
  role: Role;
  profile: Profile;
}

interface Profile {
  avatar: string;
  bio: string;
}

type Role = "admin" | "user" | "guest";

interface Post extends Entity {
  title: string;
  content: string;
  author: User;
  tags: Tag[];
  status: PostStatus;
}

interface Tag {
  name: string;
  slug: string;
}

enum PostStatus {
  Draft = "draft",
  Published = "published",
  Archived = "archived",
}

class UserService {
  private users: User[];

  getUser(id: string): User | undefined {
    return undefined;
  }

  createUser(data: Partial<User>): User {
    return {} as User;
  }
}`;

export const CALL_GRAPH_SAMPLE = `function main() {
  const config = loadConfig();
  const db = connectDatabase(config);
  startServer(db);
}

function loadConfig() {
  const raw = readFile("config.json");
  return parseJSON(raw);
}

function readFile(path: string): string {
  return "";
}

function parseJSON(text: string): Record<string, unknown> {
  return validate(JSON.parse(text));
}

function validate(data: unknown): Record<string, unknown> {
  return data as Record<string, unknown>;
}

function connectDatabase(config: Record<string, unknown>) {
  const url = buildConnectionString(config);
  return createPool(url);
}

function buildConnectionString(config: Record<string, unknown>): string {
  return "";
}

function createPool(url: string) {
  return { query: async (sql: string) => [] };
}

function startServer(db: unknown) {
  const app = createApp();
  registerRoutes(app, db);
  listen(app, 3000);
}

function createApp() {
  return {};
}

function registerRoutes(app: unknown, db: unknown) {
  handleHealth(app);
  handleUsers(app, db);
}

function handleHealth(app: unknown) {}
function handleUsers(app: unknown, db: unknown) {}

function listen(app: unknown, port: number) {}`;

export const MODULE_GRAPH_SAMPLE = `// --- src/index.ts ---
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createDatabase } from "./db/connection";

const config = loadConfig();
const db = createDatabase(config);
const app = createApp(db);

// --- src/app.ts ---
import { Router } from "./routes/router";
import { authMiddleware } from "./middleware/auth";

export function createApp(db: unknown) {}

// --- src/config.ts ---
export function loadConfig() {}
export function validateConfig(config: unknown) {}

// --- src/db/connection.ts ---
import { runMigrations } from "./migrations";

export function createDatabase(config: unknown) {}

// --- src/db/migrations.ts ---
export function runMigrations(db: unknown) {}

// --- src/routes/router.ts ---
import { UserController } from "../controllers/user";
import { PostController } from "../controllers/post";

export class Router {}

// --- src/controllers/user.ts ---
import { UserService } from "../services/user";

export class UserController {}

// --- src/controllers/post.ts ---
import { PostService } from "../services/post";

export class PostController {}

// --- src/services/user.ts ---
import { createDatabase } from "../db/connection";

export class UserService {}

// --- src/services/post.ts ---
import { createDatabase } from "../db/connection";

export class PostService {}

// --- src/middleware/auth.ts ---
import { UserService } from "../services/user";

export function authMiddleware() {}`;
