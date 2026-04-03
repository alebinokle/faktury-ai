import { PrismaClient } from "@prisma/client";
import { verifyTurnstileToken } from "@/lib/verifyTurnstile";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const turnstileToken = String(body.turnstileToken || "");

    if (!email) {
      return Response.json(
        { success: false, message: "Brak adresu e-mail." },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;

    const captcha = await verifyTurnstileToken({ token: turnstileToken, ip });
    if (!captcha.success) {
      return Response.json(
        { success: false, message: "Nie udało się potwierdzić CAPTCHA." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return Response.json(
        { success: false, message: "Nie znaleziono użytkownika." },
        { status: 404 }
      );
    }

    if (!("trialCreditsUsed" in user) || (user as any).trialCreditsUsed) {
      return Response.json(
        { success: false, message: "Kredyty testowe zostały już wykorzystane." },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        credits: {
          increment: 3,
        },
        trialCreditsUsed: true,
      } as any,
    });

    return Response.json({
      success: true,
      message: `Dodano 3 kredyty. Aktualne saldo: ${updatedUser.credits}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        credits: updatedUser.credits,
      },
    });
  } catch (error) {
    console.error("add-credits error:", error);
    return Response.json(
      { success: false, message: "Wystąpił błąd podczas dodawania kredytów." },
      { status: 500 }
    );
  }
}
