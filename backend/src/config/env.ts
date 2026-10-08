import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: true });

// S10: nos testes, o banco é o de teste (backend/scripts/run-tests.mjs), mesmo que o
// backend/.env acima aponte para o banco do sistema.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
