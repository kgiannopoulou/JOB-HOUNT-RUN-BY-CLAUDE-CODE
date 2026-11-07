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

function answer(body) {
  const system = body.system.map((block) => block.text).join("\n");
  const input = body.messages[0].content.map((block) => block.text).join("\n");

  if (input.includes("REFUSE-THIS-CV")) return { stop_reason: "refusal", content: [] };

  let output;
  if (system.includes("structured data")) output = profile;
  else if (system.includes("review CVs")) output = analysis;
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
