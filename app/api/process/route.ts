import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response("Brak pliku", { status: 400 });
    }

    const prompt = `
Przekształć tę fakturę do formatu XML zgodnego z KSeF.
Zwróć tylko czysty XML, bez komentarzy i bez wyjaśnień.
`;

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    let content: any[] = [
      {
        type: "input_text",
        text: prompt,
      },
    ];

    if (file.type === "image/png" || file.type === "image/jpeg") {
      content.push({
        type: "input_image",
        image_url: `data:${file.type};base64,${base64}`,
      });
    } else if (file.type === "application/pdf") {
      content.push({
        type: "input_file",
        filename: file.name,
        file_data: `data:application/pdf;base64,${base64}`,
      });
    } else {
      return new Response(
        "Obsługiwane formaty: PNG, JPG/JPEG, PDF",
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: [
        {
          role: "user",
          content,
        },
      ],
    });

    const xml = (response.output_text || "").trim();

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("BŁĄD API:", error);
    return new Response("Błąd przetwarzania pliku", { status: 500 });
  }
}