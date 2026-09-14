// @coach/api-client -- generated OpenAPI-backed REST client surface (T-31).
import { ApiClient, type OperationName } from "./generated";
export * from "./generated";

// A thin typed surface over the generated per-operation functions. The mobile + web apps import
// from here; the generator keeps it in lockstep with the API's OpenAPI schema.
export interface CoachApiClientConfig {
     baseUrl: string;
     fetch?: typeof fetch;
     operations?: readonly OperationName[];
}

export function createCoachClient(config: CoachApiClientConfig): ApiClient {
     return new ApiClient(config.baseUrl, config.fetch);
}

export type { ApiClient };
