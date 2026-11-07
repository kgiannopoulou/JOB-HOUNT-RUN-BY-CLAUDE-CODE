// Test double for the Anthropic API, used only by the end-to-end tests. It speaks
// the real wire format so the app's SDK code runs unchanged. It is never part of
// the application, and its answers are fixed test data about an invented person.
import { createServer } from "node:http";

const profile = {
  contact: {
    full_name: "Alex Example",
    email: "alex@example.com",
    phone: "+30 210 000 0000",
    location: "Athens, Greece",
    links: [],
  },
  summary: "Data analyst who builds reporting for product teams.",
  experience: [
    {
      title: "Data Analyst",
      company: "Example Analytics",
      location: "",
      start_date: "2021-01",
      end_date: "",
      is_current: true,
      description: "Built weekly SQL reports for the sales team.",
    },
  ],
  education: [
    {
      institution: "University of Examples",
      qualification: "BSc",
      field: "Statistics",
      start_date: "2017",
      end_date: "2020",
    },
  ],
  // Kubernetes is not in the test CV: the review screen must flag it.
  skills: ["SQL", "Python", "Excel", "Power BI", "Tableau", "Kubernetes"],
  certifications: [],
  languages: [
    { name: "Greek", level: "native" },
    { name: "English", level: "C1" },
  ],
};

const analysis = {
  overview: "A focused CV for a data analyst.",
  strengths: [
    {
      title: "Regular reporting",
      detail: "Shows steady delivery of reports.",
      evidence: "Built weekly SQL reports",
    },
  ],
  weaknesses: [{ title: "Few results", detail: "The role does not state any outcomes." }],
  missing_information: [
    { item: "Measured results", why_it_matters: "Employers look for evidence of impact." },
  ],
  improvements: [
    { section: "Experience", suggestion: "Add your real results to each role.", priority: "high" },
  ],
  // Google is invented on purpose: the page must warn about it.
  improved_summary: "Data analyst at Example Analytics, formerly at Google.",
  keywords: [
    { term: "SQL", reason: "Named in most analyst roles." },
    { term: "dbt", reason: "Common in modern data teams. Add it only if it is true." },
  ],
  recommendations: [
    { action: "Add measured results", reason: "It is the largest gap.", priority: "high" },
  ],
};

const requirement = (overrides) => ({
  category: "skills",
  importance: "mandatory",
  term: "",
  min_years: null,
  years_scope: "none",
  status: "met",
  candidate_evidence: "",
  explanation: "From the test double.",
  ...overrides,
});

const sql = requirement({
  requirement: "Strong SQL",
  job_quote: "You must have strong SQL skills",
  term: "SQL",
  candidate_evidence: "SQL",
});

const matchBase = {
  strengths: [{ text: "Weekly reporting", evidence: "Built weekly SQL reports" }],
  concerns: ["The CV does not show the size of the data."],
  recommendations: ["Describe the reports you built in more detail."],
  summary: "The CV shows the main skills this job asks for.",
};

const strongMatch = {
  ...matchBase,
  requirements: [
    sql,
    requirement({
      requirement: "Python",
      job_quote: "Python is required",
      term: "Python",
      candidate_evidence: "Python",
    }),
    requirement({
      category: "responsibilities",
      importance: "preferred",
      requirement: "Build reports",
      job_quote: "Build reports for product teams",
      status: "partial",
      candidate_evidence: "Built weekly SQL reports",
    }),
  ],
};

const weakMatch = {
  ...matchBase,
  requirements: [
    sql,
    requirement({
      requirement: "Rust",
      job_quote: "Rust is required",
      term: "Rust",
      status: "not_met",
    }),
  ],
};

// Each fake answer tries something a real model must not get away with.
const tailored = {
  // dbt is missing from the CV, so it is listed but must never reach the version.
  job_keywords: ["SQL", "Python", "dbt"],
  summary: "Data analyst who builds SQL reporting for product teams.",
  role_descriptions: [
    // Google and 40% are invented: this wording must be thrown away.
    { role_index: 0, description: "Delivered reports at Google that raised revenue by 40%." },
  ],
  // Rust is not in the CV: it must be ignored, not added.
  skills_first: ["Python", "SQL", "Rust"],
};

const letter = {
  greeting: "Dear Hiring Team,",
  paragraphs: [
    "I am applying for the Reporting Analyst role at Example Company. I build weekly SQL reports for the sales team.",
    // Both invented: these sentences must be removed.
    "I also led a team of 12 at Google. I have years of dbt experience.",
    "I would welcome the chance to talk.",
  ],
  closing: "Kind regards,",
  job_keywords: ["SQL", "dbt"],
};

const interviewQuestions = {
  questions: [
    {
      category: "technical",
      question: "How would you speed up a slow SQL report?",
      why_it_may_come_up: "The role asks for strong SQL, so this could come up.",
      job_quote: "You must have strong SQL skills",
      structure_name: "Problem, approach, result",
      structure_steps: ["Name the problem", "Explain your approach", "State the result"],
    },
    {
      category: "behavioural",
      question: "Tell me about a time you built a report for a team.",
      // A promise nobody can make: this sentence must not reach the page.
      why_it_may_come_up: "You will definitely be asked this.",
      job_quote: "",
      structure_name: "STAR",
      structure_steps: ["Situation", "Task", "Action", "Result"],
    },
    {
      category: "behavioural",
      // Invented employer: this question must be dropped.
      question: "Tell me about your time working at Google.",
      why_it_may_come_up: "",
      job_quote: "",
      structure_name: "STAR",
      structure_steps: ["Situation"],
    },
    {
      category: "company",
      question: "How would you build reports for product teams here?",
      why_it_may_come_up: "The posting mentions this work.",
      job_quote: "Build reports for product teams",
      structure_name: "",
      structure_steps: [],
    },
    {
      category: "company",
      // Invented company fact with no quote: this question must be dropped.
      question: "How do you feel about the recent merger with Globex?",
      why_it_may_come_up: "",
      job_quote: "",
      structure_name: "",
      structure_steps: [],
    },
  ],
};

function reviewItem(index) {
  return {
    question_index: index,
    criteria: [
      { criterion: "relevance", rating: "strong", comment: "It answers the question.", answer_quote: "indexes" },
      // No quote, so this strong rating must drop to adequate.
      { criterion: "structure", rating: "strong", comment: "Easy to follow.", answer_quote: "" },
      { criterion: "specificity", rating: "adequate", comment: "Some detail.", answer_quote: "" },
      { criterion: "impact", rating: "weak", comment: "No result is given.", answer_quote: "" },
    ],
    strengths: [
      { text: "You named a concrete technique.", answer_quote: "indexes" },
      { text: "Invented praise.", answer_quote: "words that are not in the answer" },
    ],
    weaknesses: ["The result is missing."],
    improvements: [
      "Add the result you really achieved.",
      // A figure the person never gave: this advice must be removed.
      "Say the report ran 80% faster.",
    ],
    summary: "A reasonable start that needs a result.",
  };
}

function answer(body) {
  const system = body.system.map((block) => block.text).join("\n");
  const input = body.messages[0].content.map((block) => block.text).join("\n");

  if (input.includes("REFUSE-THIS-CV")) return { stop_reason: "refusal", content: [] };

  let output;
  if (system.includes("structured data")) output = profile;
  else if (system.includes("review CVs")) output = analysis;
  else if (system.includes("present their verified CV")) output = tailored;
  else if (system.includes("write cover letters")) output = letter;
  else if (system.includes("prepare candidates")) output = interviewQuestions;
  else if (system.includes("review written answers")) {
    const count = (input.match(/candidate-answer/g) ?? []).length;
    output = { items: Array.from({ length: count }, (_, index) => reviewItem(index)) };
  }
  else output = input.includes("Rust is required") ? weakMatch : strongMatch;

  return {
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(output) }],
  };
}

export function startFakeAnthropic(port) {
  const requests = [];

  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/__requests") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(requests));
      return;
    }

    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      const body = JSON.parse(raw);
      requests.push(body);
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          id: `msg_${requests.length}`,
          type: "message",
          role: "assistant",
          model: body.model,
          stop_sequence: null,
          usage: { input_tokens: 1000, output_tokens: 200 },
          ...answer(body),
        }),
      );
    });
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}
