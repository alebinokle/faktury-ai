export async function verifyTurnstileToken({
  token,
  ip,
}: {
  token: string;
  ip?: string | null;
}) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    throw new Error("Brak TURNSTILE_SECRET_KEY w .env");
  }

  if (!token) {
    return { success: false };
  }

  const formData = new URLSearchParams();
  formData.append("secret", secret);
  formData.append("response", token);

  if (ip) {
    formData.append("remoteip", ip);
  }

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await res.json();

  return data;
}