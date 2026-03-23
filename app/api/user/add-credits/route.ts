import { prisma } from "../../../../lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const creditsToAdd = Number(body.credits || 0);

    if (!email) {
      return Response.json(
        { success: false, message: "Brak adresu e-mail." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
      return Response.json(
        { success: false, message: "Nieprawidłowa liczba kredytów." },
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
          credits: creditsToAdd,
        },
        select: {
          id: true,
          email: true,
          credits: true,
        },
      });

      return Response.json({
        success: true,
        message: `Dodano ${creditsToAdd} kredytów.`,
        user,
      });
    }

    const newCredits = (user.credits ?? 0) + creditsToAdd;

    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        credits: newCredits,
      },
      select: {
        id: true,
        email: true,
        credits: true,
      },
    });

    console.log("ADD CREDITS:", {
      email,
      before: user.credits,
      add: creditsToAdd,
      after: updatedUser.credits,
    });

    return Response.json({
      success: true,
      message: `Dodano ${creditsToAdd} kredytów.`,
      user: updatedUser,
    });
  } catch (error) {
    console.error("ADD CREDITS ERROR:", error);

    return Response.json(
      {
        success: false,
        message: "Nie udało się dodać kredytów.",
        error: String(error),
      },
      { status: 500 }
    );
  }
}