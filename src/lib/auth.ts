import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// Google credentials are optional: the website still works if you only ship
// password auth. We only register the Google provider when both env vars are
// set so dev environments without Google credentials don't crash NextAuth.
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleEnabled = !!googleClientId && !!googleClientSecret;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;
        // Google-only users have no password row. Don't crash — just refuse.
        if (!user.password) return null;
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
            // Ask for the user's basic profile + email. Image (avatar) comes
            // for free with the standard `profile` scope.
            authorization: {
              params: { scope: "openid email profile" },
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    // When Google sign-in succeeds, find or create the matching user in our
    // DB and merge the Google identity (image + googleId) onto the row.
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      const email = (profile as { email?: string })?.email ?? user.email;
      if (!email) return false;
      const googleSub = (profile as { sub?: string })?.sub ?? account.providerAccountId;
      const image = (profile as { picture?: string })?.picture ?? user.image ?? null;
      const name = (profile as { name?: string })?.name ?? user.name ?? null;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        // Auto-link: backfill the Google fields if they're missing. Also
        // refresh the avatar/name from Google so they stay current.
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            googleId: existing.googleId ?? googleSub ?? null,
            image: image ?? existing.image,
            name: existing.name ?? name,
          },
        });
        user.id = existing.id;
        return true;
      }

      const created = await prisma.user.create({
        data: {
          email,
          name,
          image,
          googleId: googleSub ?? null,
          // Google-only users don't get a password.
          password: null,
        },
      });
      user.id = created.id;
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) session.user.id = token.id as string;
      return session;
    },
  },
  pages: { signIn: "/login" },
};
