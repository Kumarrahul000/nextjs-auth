import CredentialsProvider from "next-auth/providers/credentials";
import NextAuth from "next-auth/next";
import jwt from "jsonwebtoken";
import { baseURL } from "@/lib/config";

// 🔁 Refresh access token function
async function refreshAccessToken(token) {
  try {
    const url = `${baseURL}/auth/refresh-token/`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: token.refresh_token,
      }),
    });

    if (!res.ok) {
      return {};
    }

    const data = await res.json();

    const decodedToken = jwt.decode(data?.data?.access_token);

    return {
      ...token,
      access_token: data?.data?.access_token,
      accessTokenExpires: decodedToken.exp * 1000,
    };
  } catch (error) {
    return {};
  }
}

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
    // error: "/error",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const res = await fetch(`${baseURL}/api/auth/login/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });

        if (res.status === 500) {
          throw new Error("Server error");
        }

        const data = await res.json();


        if (res.ok && data?.data) {
          return data?.data;
        } else {
          throw new Error(JSON.stringify(data));
        }
      },
    }),
  ],
  callbacks: {
  
    async session({ session, token }) {
      session = {
        user: {
          email: token.email,
          first_name: token.first_name,
          last_name: token.last_name,
          access_token: token.access_token
        },
      };
      return session;
    },

    // 🧠 Store all data in the JWT (internal only)
    async jwt({ token, user }) {
      // On initial login
      if (user) {
        const decodedToken = jwt.decode(user.access_token);
        token.access_token = user.access_token;
        token.refresh_token = user.refresh_token;
        token.accessTokenExpires = decodedToken.exp * 1000;

        token.email = user.email;
        token.first_name = user.first_name;
        token.last_name = user.last_name;
      }

      // 🔄 If token expired, refresh it
      if (Date.now() > token.accessTokenExpires) {
        token = await refreshAccessToken(token);
      }

      return token;
    },
  },
};

export default NextAuth(authOptions);
