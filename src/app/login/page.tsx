import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return <LoginForm isLoggedIn={isLoggedIn} />;
}
