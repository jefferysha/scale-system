/**
 * Shared API types between FE and BE.
 *
 * Phase 1 之后，本文件由 openapi-typescript 自动从 BE 的 OpenAPI 生成。
 * 当前先做占位，避免 import 不到。
 */

export interface HealthResponse {
  status: 'ok';
  service: string;
}
