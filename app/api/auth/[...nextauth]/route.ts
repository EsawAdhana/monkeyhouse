import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/lib/db/mongodb";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    // Temporary bypass provider for when OAuth is not available
    CredentialsProvider({
      id: "bypass",
      name: "Bypass Auth",
      credentials: {},
      async authorize() {
        // Return a static user object
        return {
          id: "static-user-id",
          name: "Temp User",
          email: "temp@example.com",
          image: "https://ui-avatars.com/api/?name=Temp+User&background=random",
        };
      },
    }),
  ],
  // Only use MongoDB adapter when not using the bypass provider
  // This prevents saving data when using the temporary bypass
  adapter: (req: any) => {
    // Don't use the adapter for credential provider (bypass)
    if (req?.body?.providerId === "bypass" || req?.query?.providerId === "bypass") {
      return undefined;
    }
    return MongoDBAdapter(clientPromise);
  },
  pages: {
    signIn: "/signin",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    session: async ({ session, token }) => {
      if (session?.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };