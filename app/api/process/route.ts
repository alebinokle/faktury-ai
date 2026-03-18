import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response("Brak pliku", { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return new Response("Brak OPENAI_API_KEY w .env.local", { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const prompt = `
Przeanalizuj załączoną fakturę (PDF lub obraz) i wygeneruj wynik WYŁĄCZNIE jako XML.

Cel:
- dostosowanie faktury do formatu KSeF
- zwrócenie samego XML bez żadnych komentarzy, bez wyjaśnień, bez bloków markdown
- jeśli jakiegoś pola nie da się pewnie odczytać, wstaw pusty tag albo logiczną wartość domyślną
- zachowaj strukturę poprawnego dokumentu XML faktury
- nie dodawaj żadnego tekstu przed XML ani po XML

Wynik ma być gotowym XML-em do zapisania do pliku.
`;

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
            {
              type: "input_file",
              filename: file.name,
              file_data: `data:${file.type || "application/octet-stream"};base64,${base64}`,
            },
          ],
        },
      ],
    });

    const xml = response.output_text?.trim() || "";

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Błąd podczas przetwarzania pliku", { status: 500 });
  }
}