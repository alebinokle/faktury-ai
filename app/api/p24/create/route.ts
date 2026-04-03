import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const packages = {
  basic: {
    amount: 1900,
    credits: 100,
    description: "Pakiet 19 zl - 100 kredytow",
  },
  pro: {
    amount: 4900,
    credits: 400,
    description: "Pakiet 49 zl - 400 kredytow",
  },
  max: {
    amount: 9900,
    credits: 1000,
    description: "Pakiet 99 zl - 1000 kredytow",
  },
} as const;

export async function GET() {
  return Response.json({ ok: true, message: "P24 create działa" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const packageCode = String(body.packageCode || "pro") as keyof typeof packages;

    if (!email) {
      return Response.json({ ok: false, error: "Brak adresu e-mail." }, { status: 400 });
    }

    const selected = packages[packageCode];
    if (!selected) {
      return Response.json({ ok: false, error: "Nieprawidłowy pakiet." }, { status: 400 });
    }

    const merchantId = Number(process.env.P24_MERCHANT_ID);
    const posId = Number(process.env.P24_POS_ID);
    const crc = process.env.P24_CRC!;
    const apiKey = process.env.P24_API_KEY!;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const webhookUrl = process.env.P24_WEBHOOK_URL!;

    if (!merchantId || !posId || !crc || !apiKey || !appUrl || !webhookUrl) {
      return Response.json(
        { ok: false, error: "Brakuje zmiennych środowiskowych P24." },
        { status: 500 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return Response.json({ ok: false, error: "Nie znaleziono użytkownika." }, { status: 404 });
    }

    const sessionId = `order-${Date.now()}`;

    const signData = JSON.stringify({
      sessionId,
      merchantId,
      amount: selected.amount,
      currency: "PLN",
      crc,
    });

    const sign = crypto.createHash("sha384").update(signData, "utf8").digest("hex");
    const basicAuth = Buffer.from(`${merchantId}:${apiKey}`).toString("base64");

    await prisma.payment.create({
      data: {
        userId: user.id,
        p24SessionId: sessionId,
        packageCode,
        amount: selected.amount,
        creditsAdded: selected.credits,
        status: "pending",
      },
    });

    const payload = {
      merchantId,
      posId,
      sessionId,
      amount: selected.amount,
      currency: "PLN",
      description: selected.description,
      email,
      country: "PL",
      language: "pl",
      urlReturn: `${appUrl}/payment/success`,
      urlStatus: webhookUrl,
      sign,
    };

    const res = await fetch("https://sandbox.przelewy24.pl/api/v1/transaction/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || data?.responseCode !== 0 || !data?.data?.token) {
      await prisma.payment.update({
        where: { p24SessionId: sessionId },
        data: { status: "failed" },
      });

      return Response.json(
        {
          ok: false,
          error: "Nie udało się utworzyć płatności w P24.",
          p24: data,
        },
        { status: 400 }
      );
    }

    return Response.json({
      ok: true,
      redirectUrl: `https://sandbox.przelewy24.pl/trnRequest/${data.data.token}`,
    });
  } catch (error) {
    console.error("P24 create error:", error);
    return Response.json({ ok: false, error: "Błąd tworzenia płatności" }, { status: 500 });
  }
}
