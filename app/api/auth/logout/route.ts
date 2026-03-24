import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

const prisma = globalThis.__prisma__ || new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session_token")?.value;

    if (sessionToken) {
      await prisma.session.deleteMany({
        where: { token: sessionToken },
      });
    }

    cookieStore.set("session_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("BŁĄD LOGOUT:", error);

    return Response.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Nie udało się wylogować.",
      },
      { status: 500 }
    );
  }
}