let AblyCtor: any | null = null;

export async function getAblyRest(apiKey: string) {
  if (!AblyCtor) {
    // Lazy import to avoid Vercel function invocation failures on module load
    // if ESM/CJS interop changes across runtimes.
    const mod = await import("ably");
    AblyCtor = (mod as any).default ?? (mod as any);
  }

  const Rest = AblyCtor?.Rest;
  if (!Rest) {
    throw new Error("Ably.Rest is not available");
  }

  return new Rest({ key: apiKey });
}
