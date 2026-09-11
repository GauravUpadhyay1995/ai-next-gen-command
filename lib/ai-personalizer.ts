export type PitchContext = {
  company: string;
  role?: string;
  category?: string;
  snippet?: string;
  location?: string;
  candidateSkills?: string;
  pitchType?: "job_application" | "b2b_sales";
};

/**
 * Intelligent Smart Heuristics Pitch Generator (Zero-Key / Offline Fallback).
 * Generates tailored 2-sentence value pitch for job seeker or B2B sales lead.
 */
export function generateSmartHeuristicPitch(context: PitchContext): string {
  const { company, role = "Team", snippet = "", category = "", pitchType = "job_application" } = context;

  // 🏢 B2B Sales / Client Proposal Pitch
  if (pitchType === "b2b_sales" || category) {
    const businessNiche = category || "your sector";
    return `Noticed ${company}'s growing presence in ${businessNiche}; we specialize in accelerating digital sales, streamlining operations, and delivering high-ROI growth solutions tailored specifically for your market. I would love to share a quick 2-minute overview of how we can drive predictable value for your team.`;
  }

  // 🧑‍💻 Job Seeker Pitch
  const lowerSnippet = snippet.toLowerCase();
  const lowerRole = role.toLowerCase();

  // Detect tech keywords in job post
  const detectedSkills: string[] = [];
  const skillKeywords = [
    "react", "next.js", "typescript", "javascript", "node.js", "node",
    "python", "django", "fastapi", "vue", "angular", "aws", "docker",
    "mongodb", "postgresql", "sql", "tailwind", "graphql", "rest api",
    "ui/ux", "frontend", "backend", "full stack", "fullstack", "devops"
  ];

  for (const skill of skillKeywords) {
    if (lowerSnippet.includes(skill) || lowerRole.includes(skill)) {
      detectedSkills.push(skill.toUpperCase());
    }
  }

  const primarySkill = detectedSkills[0] || "modern software engineering";
  const secondarySkill = detectedSkills[1];

  if (lowerRole.includes("frontend") || lowerRole.includes("react") || lowerRole.includes("ui")) {
    return `Given ${company}'s focus on high-quality frontend performance with ${primarySkill}${
      secondarySkill ? ` & ${secondarySkill}` : ""
    }, my background in shipping clean, responsive UI with rapid turnaround times directly matches your requirements.`;
  }

  if (lowerRole.includes("backend") || lowerRole.includes("node") || lowerRole.includes("python")) {
    return `Seeing ${company}'s requirement for robust backend architecture and ${primarySkill}, my experience designing scalable APIs, database schemas, and microservices will allow me to contribute from day one.`;
  }

  if (lowerRole.includes("full") || lowerRole.includes("stack")) {
    return `With hands-on experience building end-to-end full-stack applications utilizing ${primarySkill}${
      secondarySkill ? ` and ${secondarySkill}` : ""
    }, I am well-positioned to accelerate feature development at ${company}.`;
  }

  return `Given your team's current focus on ${role || "scaling engineering capabilities"} at ${company}, my background in delivering dependable, user-focused digital products aligns directly with what you are building.`;
}

/**
 * AI-Powered Pitch Generator (Uses Gemini API when available, falls back to Smart Heuristics).
 */
export async function generateAIPersonalizedPitch(
  context: PitchContext,
  apiKey?: string
): Promise<{ pitch: string; source: "gemini_ai" | "smart_heuristic" }> {
  const geminiKey = apiKey || process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    return {
      pitch: generateSmartHeuristicPitch(context),
      source: "smart_heuristic",
    };
  }

  const isB2B = context.pitchType === "b2b_sales" || !!context.category;

  const prompt = isB2B
    ? `You are an elite B2B sales strategist and copywriter.
Write a powerful, hyper-personalized 2-sentence B2B outreach pitch offering high-value services.
Target Company: ${context.company}
Business Category / Industry: ${context.category || "Business Services"}
Location: ${context.location || "Local / Global"}
Business Context / Snippet: ${context.snippet || "Active registered business"}
Instructions:
1. Do NOT include greetings (Hi/Dear) or sign-offs (Thanks/Regards).
2. Write exactly 2 compelling sentences showing clear ROI and offering a quick chat.
3. Keep it punchy, professional, and under 45 words.`
    : `You are an elite career coach and cold outreach specialist.
Write a powerful, highly specific 2-sentence pitch for a job application email.
Candidate Target Role: ${context.role || "Software Engineer"}
Company: ${context.company}
Job Snippet / Description: ${context.snippet || "General hiring post"}
Candidate Core Strengths: Full-stack web development, React, Next.js, Node.js, TypeScript, Scalable APIs.
Instructions:
1. Do NOT include greetings (Hi/Dear) or sign-offs (Thanks/Regards).
2. Write exactly 2 compelling sentences showing why the candidate is a strong fit based on the job details.
3. Keep it natural, confident, and punchy (under 45 words).`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 100,
          },
        }),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const generatedText =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (generatedText) {
        return {
          pitch: generatedText.replace(/^["']|["']$/g, "").trim(),
          source: "gemini_ai",
        };
      }
    }
  } catch (err) {
    console.warn("[AI Personalizer] Gemini API call failed, falling back to heuristics:", err);
  }

  return {
    pitch: generateSmartHeuristicPitch(context),
    source: "smart_heuristic",
  };
}
