export type EmailTemplate = {
  id: string;
  name: string;
  description: string;
  category: "tech" | "founder" | "internship" | "general" | "custom";
  subject: string;
  body: string;
};

export const BUILTIN_TEMPLATES: EmailTemplate[] = [
  {
    id: "tech_fullstack_impact",
    name: "🚀 High-Impact Tech Role (React / Node / Full-Stack)",
    description: "Battle-tested concise pitch highlighting problem-solving, stack match, and speed.",
    category: "tech",
    subject: "Application: {{role}} - Experienced Developer (Resume Attached)",
    body: `Hi {{name}},

I came across your hiring post for {{role}} at {{company}}.

{{ai_pitch}}

I have extensive hands-on experience building scalable, high-performance web applications with modern frontend & backend architectures. I'd love to bring this momentum to the engineering team at {{company}}.

Please find my updated resume attached for your review. I would be thrilled to jump on a quick 10-minute call to discuss how I can contribute right away.

Best regards,
Gaurav Upadhyay
Portfolio / GitHub: Available in attached resume`,
  },
  {
    id: "founder_direct_outreach",
    name: "⚡ Direct Founder / Early-Stage Startup Outreach",
    description: "Ultra-short, high-energy email aimed at founders, CTOs, and hiring managers.",
    category: "founder",
    subject: "Quick question regarding {{role}} at {{company}}",
    body: `Hi {{name}},

Saw your open hiring requirement for {{role}} at {{company}} and wanted to reach out directly.

{{ai_pitch}}

I thrive in fast-paced startup environments where shipping clean code with fast turnaround time is key. Attached is my PDF resume with details on past products built.

Open to a brief chat this week if you're exploring candidate profiles?

Thanks,
Gaurav Upadhyay`,
  },
  {
    id: "junior_intern_fast_pitch",
    name: "🎯 Junior Dev / Internship Fast Pitch",
    description: "Curious, agile, and project-focused application for early-career roles.",
    category: "internship",
    subject: "Application for {{role}} Opportunity - Gaurav Resume",
    body: `Hi {{name}},

I am writing to express my strong enthusiasm for the {{role}} opening at {{company}}.

{{ai_pitch}}

I have built several production-ready full-stack projects showcasing responsive UI, REST/GraphQL APIs, and clean state management. I am eager to learn, contribute to your codebase, and add value to {{company}} from day one.

My resume is attached for your consideration. Looking forward to hearing from you!

Best regards,
Gaurav Upadhyay`,
  },
  {
    id: "general_professional",
    name: "💼 General Professional Application",
    description: "Polite, well-structured all-rounder application for any role.",
    category: "general",
    subject: "Job Application: {{role}} - {{company}}",
    body: `Dear Hiring Team at {{company}},

I hope this email finds you well. I am writing to apply for the {{role}} position recently announced by {{company}}.

{{ai_pitch}}

With a solid background in software development and delivering dependable solutions, I believe my skill set aligns well with your team's objectives.

Attached is my resume outlining my experience and qualifications. I welcome the opportunity to discuss my application in further detail.

Thank you for your time and consideration.

Sincerely,
Gaurav Upadhyay`,
  },
];
