import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  return Response.json({ ok: true, message: "Webhook działa" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("P24 webhook body:", body);

    const merchantId = Number(process.env.P24_MERCHANT_ID);
    const posId = Number(process.env.P24_POS_ID);
    const crc = process.env.P24_CRC!;
    const apiKey = process.env.P24_API_KEY!;

    const sessionId = String(body.sessionId || "");
    const orderId = Number(body.orderId);
    const amount = Number(body.amount);
    const currency = String(body.currency || "PLN");

    if (!sessionId || !orderId || !amount) {
      return new Response("Brak wymaganych danych", { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { p24SessionId: sessionId },
    });

    if (!payment) {
      return new Response("Nie znaleziono płatności", { status: 404 });
    }

    if (payment.status === "success") {
      return new Response("OK");
    }

    const signData = JSON.stringify({
      sessionId,
      orderId,
      amount,
      currency,
      crc,
    });

    const sign = crypto.createHash("sha384").update(signData, "utf8").digest("hex");
    const basicAuth = Buffer.from(`${merchantId}:${apiKey}`).toString("base64");

    const verifyRes = await fetch("https://sandbox.przelewy24.pl/api/v1/transaction/verify", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        merchantId,
        posId,
        sessionId,
        amount,
        currency,
        orderId,
        sign,
      }),
    });

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || verifyData?.responseCode !== 0) {
      console.error("P24 verify failed:", verifyData);
      return new Response("Weryfikacja nieudana", { status: 400 });
    }

    await prisma.payment.update({
      where: { p24SessionId: sessionId },
      data: {
        status: "success",
        orderId,
      },
    });

    await prisma.user.update({
      where: { id: payment.userId },
      data: {
        credits: {
          increment: payment.creditsAdded,
        },
      },
    });

    return new Response("OK");
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Błąd", { status: 500 });
  }
}
