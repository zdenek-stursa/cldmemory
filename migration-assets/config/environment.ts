import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  QDRANT_URL: z.string().url(),
  QDRANT_API_KEY: z.string().optional(),
  QDRANT_COLLECTION_NAME: z.string(),
  OPENAI_API_KEY: z.string(),
  OPENAI_MODEL: z.string(),
  MCP_TRANSPORT_MODE: z.enum(['stdio', 'sse', 'both']).default('stdio'),
  MCP_PORT: z.string().transform(Number).default('3000'),
  MCP_HOST: z.string().default('localhost'),
  MCP_CORS_ORIGIN: z.string().default('*'),
  SIMILARITY_THRESHOLD: z.string().transform(Number).default('0.7'),
});

export const config = envSchema.parse(process.env);

export const VECTOR_DIMENSION = 1536; // for text-embedding-3-small
export const DEFAULT_SIMILARITY_THRESHOLD = config.SIMILARITY_THRESHOLD || 0.3; // Use configured value or fallback