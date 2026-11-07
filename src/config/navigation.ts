import {
  BriefcaseBusiness,
  FileText,
  Gauge,
  KanbanSquare,
  LayoutDashboard,
  Mail,
  MessagesSquare,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export const primaryNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Jobs", href: "/jobs", icon: BriefcaseBusiness },
  { title: "CV", href: "/cv", icon: FileText },
  { title: "Cover letters", href: "/cover-letters", icon: Mail },
  { title: "Matches", href: "/matches", icon: Gauge },
  { title: "Applications", href: "/applications", icon: KanbanSquare },
  { title: "Interview prep", href: "/interview", icon: MessagesSquare },
];

export const secondaryNav: NavItem[] = [
  { title: "Settings", href: "/settings", icon: Settings },
];

export const marketingNav = [
  { title: "Features", href: "/#features" },
  { title: "How it works", href: "/#how-it-works" },
  { title: "Principles", href: "/#principles" },
] as const;
