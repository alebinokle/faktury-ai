import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const usersCount = await prisma.user.count();

    return Response.json({
      success: true,
      message: "Połączenie z bazą działa.",
      usersCount,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        success: false,
        message: "Błąd połączenia z bazą.",
      },
      { status: 500 }
    );
  }
}