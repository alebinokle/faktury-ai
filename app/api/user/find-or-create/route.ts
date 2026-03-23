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

    let user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        credits: true,
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          credits: 0,
        },
        select: {
          id: true,
          email: true,
          credits: true,
        },
      });
    }

    return Response.json({
      success: true,
      message: "Użytkownik gotowy",
      user,
    });
  } catch (error) {
    console.error("FIND OR CREATE USER ERROR:", error);

    return Response.json(
      {
        success: false,
        message: "Nie udało się znaleźć lub utworzyć użytkownika.",
        error: String(error),
      },
      { status: 500 }
    );
  }
}