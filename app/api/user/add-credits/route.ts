import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body?.email;

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Brak emaila" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Użytkownik nie istnieje" },
        { status: 404 }
      );
    }

    const MAX = 30;
    const ADD = 5;

    const current = user.credits ?? 0;
    const missing = MAX - current;

    if (missing <= 0) {
      return NextResponse.json({
        success: true,
        user,
        message: "Masz już maksymalne 30 kredytów",
      });
    }

    const toAdd = Math.min(ADD, missing);

    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        credits: current + toAdd,
      },
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { success: false, message: "Błąd serwera" },
      { status: 500 }
    );
  }
}