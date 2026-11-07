import type { CvProfile } from "@/lib/cv/profile";

/** Matches sampleCvLines in documents.ts. Everyone in it is invented. */
export const sampleProfile: CvProfile = {
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
  skills: ["SQL", "Python", "Excel", "Power BI", "Tableau"],
  certifications: [],
  languages: [
    { name: "Greek", level: "native" },
    { name: "English", level: "C1" },
  ],
};
