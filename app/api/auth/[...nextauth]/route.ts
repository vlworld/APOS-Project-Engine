import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

if (!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL === "http://localhost:3001") {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    process.env.NEXTAUTH_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
