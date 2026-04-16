export { auth as middleware } from "@/auth";

export const config = {
  // /home requires login; /results/:id requires login to prevent unauthenticated scraping
  matcher: ["/home/:path*", "/results/:path*"],
};
