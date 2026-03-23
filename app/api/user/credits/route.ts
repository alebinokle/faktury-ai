import { prisma } from "../../../../lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();

    if (!email) {
      return Response.json(
        { success: false, message: "Brak adresu e-mail." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        credits: true,
      },
    });

    if (!user) {
      return Response.json(
        { success: false, message: "Użytkownik nie istnieje." },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("GET CREDITS ERROR:", error);

    return Response.json(
      {
        success: false,
        message: "Nie udało się pobrać kredytów.",
        error: String(error),
      },
      { status: 500 }
    );
  }
}