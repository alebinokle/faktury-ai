import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { verifyTurnstileToken } from "@/lib/verifyTurnstile";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

const prisma = globalThis.__prisma__ || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const emailRaw = body?.email;
    const email =
      typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";

    const turnstileToken =
      typeof body?.turnstileToken === "string" ? body.turnstileToken : "";

    if (!email) {
      return Response.json(
        { success: false, message: "Podaj adres e-mail." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return Response.json(
        { success: false, message: "Nieprawidłowy adres e-mail." },
        { status: 400 }
      );
    }

    if (!turnstileToken) {
      return Response.json(
        { success: false, message: "Potwierdź CAPTCHA przed wysłaniem linku logowania." },
        { status: 400 }
      );
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      null;

    const captcha = await verifyTurnstileToken({
      token: turnstileToken,
      ip,
    });

    if (!captcha.success) {
      return Response.json(
        { success: false, message: "Nie udało się potwierdzić CAPTCHA." },
        { status: 400 }
      );
    }

    const resendKey = process.env.RESEND_API_KEY?.trim();
    if (!resendKey) {
      return Response.json(
        { success: false, message: "Brak RESEND_API_KEY na serwerze." },
        { status: 500 }
      );
    }

    const emailFrom = process.env.EMAIL_FROM?.trim();
    if (!emailFrom) {
      return Response.json(
        { success: false, message: "Brak EMAIL_FROM na serwerze." },
        { status: 500 }
      );
    }

    const baseUrl =
      process.env.APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      "http://localhost:3000";

    const resend = new Resend(resendKey);

    const token = randomBytes(32).toString("hex");

    await prisma.loginToken.create({
      data: {
        email,
        token,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const link = `${baseUrl}/api/auth/verify?token=${token}`;

    const result = await resend.emails.send({
      from: emailFrom,
      to: [email],
      subject: "Twój link do logowania",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6">
          <h2>Logowanie do KSeF XML</h2>
          <p>Kliknij przycisk poniżej, aby się zalogować:</p>

          <p>
            <a
              href="${link}"
              style="
                display:inline-block;
                padding:12px 18px;
                background:#1d4ed8;
                color:#ffffff;
                text-decoration:none;
                border-radius:8px;
                font-weight:bold;
              "
            >
              Zaloguj się
            </a>
          </p>

          <p>Jeśli przycisk nie działa, użyj tego linku:</p>
          <p style="word-break:break-all">${link}</p>

          <p style="margin-top:20px;font-size:12px;color:#666;">
            Link ważny 15 minut.
          </p>
        </div>
      `,
      text: `Zaloguj się: ${link}\n\nLink ważny 15 minut.`,
    });

    if (result.error) {
      console.error("RESEND ERROR:", result.error);

      return Response.json(
        {
          success: false,
          message: `Błąd wysyłki: ${result.error.message}`,
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      message: "Link logowania został wysłany.",
    });
  } catch (error) {
    console.error("SEND-LINK ERROR:", error);

    return Response.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Nie udało się wysłać linku.",
      },
      { status: 500 }
    );
  }
}