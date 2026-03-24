import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

const prisma = globalThis.__prisma__ || new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return new Response("Brak tokenu.", { status: 400 });
    }

    const loginToken = await prisma.loginToken.findUnique({
      where: { token },
    });

    if (!loginToken) {
      return new Response("Nieprawidłowy token.", { status: 400 });
    }

    if (loginToken.used) {
      return new Response("Ten link został już wykorzystany.", { status: 400 });
    }

    if (loginToken.expiresAt < new Date()) {
      return new Response("Link wygasł.", { status: 400 });
    }

    let user = await prisma.user.findUnique({
      where: { email: loginToken.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: loginToken.email,
          credits: 30,
        },
      });
    }

    await prisma.loginToken.update({
      where: { token },
      data: { used: true },
    });

    const sessionToken = randomBytes(32).toString("hex");

    await prisma.session.create({
      data: {
        token: sessionToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const cookieStore = await cookies();
    cookieStore.set("session_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return Response.redirect("http://localhost:3000");
  } catch (error) {
    console.error("BŁĄD VERIFY:", error);
    return new Response("Błąd podczas weryfikacji logowania.", { status: 500 });
  }
} 