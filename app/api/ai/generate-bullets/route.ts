import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const { notes } = await request.json();

  if (!notes || notes.trim().length < 50) {
    return Response.json(
      { error: "Please provide more detailed notes" },
      { status: 400 }
    );
  }

  // Anthropic SDK automatically reads ANTHROPIC_API_KEY from environment
  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are writing a section called "What You Told Us" for a mortgage strategy report sent to Canadian homeowners after a discovery call with their mortgage advisor.

Generate 4-6 bullet points that summarize the client's key situation, goals, and timeline based on the discovery call notes provided.

Rules:
- Use a warm, conversational tone - like a trusted advisor reflecting back what they heard
- Focus ONLY on what the CLIENT told us about their situation
- Do NOT include: internal notes, next steps, advisor observations, recommendations, or operational details
- Each bullet should be 1-2 sentences max
- Start bullets with "You" or "Your" to speak directly to the client

Return ONLY a valid JSON array of strings. No markdown, no explanation, just the array.`,
      messages: [{ role: "user", content: notes }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Strip markdown code fences Claude sometimes wraps around JSON
    const cleanedText = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    let bullets: string[];
    try {
      bullets = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Failed to parse AI response for bullets. Raw response:", cleanedText);
      return Response.json(
        {
          error: "Failed to parse AI response",
          rawSnippet: cleanedText.slice(0, 200),
        },
        { status: 500 }
      );
    }

    return Response.json({ bullets });
  } catch (error) {
    console.error("Error generating bullets:", error);
    return Response.json(
      { error: "Failed to generate report summary" },
      { status: 500 }
    );
  }
}
