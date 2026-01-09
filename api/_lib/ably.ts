interface AblyRestClient {
  channels: {
    get: (name: string) => { publish: (event: string, data: unknown) => Promise<void> };
  };
  auth: {
    createTokenRequest: (options: {
      clientId: string;
      capability: Record<string, string[]>;
      ttl?: number;
    }) => Promise<unknown>;
  };
}

interface AblyModule {
  Rest: { new (options: { key: string }): AblyRestClient };
}

let AblyCtor: AblyModule | null = null;

export async function getAblyRest(apiKey: string): Promise<AblyRestClient> {
  if (!AblyCtor) {
    // Lazy import to avoid Vercel function invocation failures on module load
    // if ESM/CJS interop changes across runtimes.
    const mod = await import("ably");
    const ablyModule = (mod as { default?: AblyModule } | AblyModule);
    AblyCtor = "default" in ablyModule ? ablyModule.default : ablyModule as AblyModule;
  }

  const Rest = AblyCtor?.Rest;
  if (!Rest) {
    throw new Error("Ably.Rest is not available");
  }

  return new Rest({ key: apiKey });
}
