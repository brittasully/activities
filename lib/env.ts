const requiredEnv = ["DATABASE_URL", "LAUNCH_TOKEN_SECRET"] as const;

type RequiredEnvKey = (typeof requiredEnv)[number];

type EnvConfig = {
  DATABASE_URL: string;
  LAUNCH_TOKEN_SECRET: string;
  SESSION_COOKIE_NAME: string;
};

function getRequired(key: RequiredEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env: EnvConfig = {
  DATABASE_URL: getRequired("DATABASE_URL"),
  LAUNCH_TOKEN_SECRET: getRequired("LAUNCH_TOKEN_SECRET"),
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME ?? "activities_session",
};
