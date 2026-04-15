"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function credentialsSignIn(email: string, password: string) {
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/home",
    });
  } catch (err) {
    // AuthError = bad credentials; NEXT_REDIRECT = success, let it propagate
    if (err instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw err;
  }
}
