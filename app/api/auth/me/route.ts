import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

const prisma = globalThis.__prisma__ || new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return Response.json({ loggedIn: false });
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return Response.json({ loggedIn: false });
    }

    return Response.json({
      loggedIn: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        credits: session.user.credits,
      },
    });
  } catch (err) {
    console.error("AUTH ME ERROR:", err);

    return Response.json(
      {
        loggedIn: false,
        error: err instanceof Error ? err.message : "server_error",
      },
      { status: 500 }
    );
  }
}