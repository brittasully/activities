import jwt, { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { env } from "@/lib/env";

export type LaunchTokenClaims = {
  assignmentId: string;
  studentId: string;
  activityVersionId: string;
};

export class LaunchTokenValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LaunchTokenValidationError";
  }
}

export function mintLaunchToken(claims: LaunchTokenClaims) {
  return jwt.sign(claims, env.LAUNCH_TOKEN_SECRET, { expiresIn: "15m" });
}

export function verifyLaunchToken(token: string) {
  try {
    return jwt.verify(token, env.LAUNCH_TOKEN_SECRET) as LaunchTokenClaims & { exp: number; iat: number };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new LaunchTokenValidationError("Launch token expired");
    }

    if (error instanceof JsonWebTokenError) {
      throw new LaunchTokenValidationError("Invalid launch token");
    }

    throw error;
  }
}
