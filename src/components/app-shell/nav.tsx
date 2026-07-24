import {
  ActivityIcon,
  BookOpenIcon,
  Building2Icon,
  ChartColumnIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  PlugIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SquareCheckIcon,
  StoreIcon,
  TargetIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Arbeitsbereich",
    items: [
      { href: "/app", label: "Overview", icon: LayoutDashboardIcon, exact: true },
      { href: "/app/chief-of-staff", label: "Chief of Staff", icon: SparklesIcon },
      { href: "/app/workforce", label: "My Workforce", icon: UsersIcon },
      { href: "/app/departments", label: "Departments", icon: Building2Icon },
    ],
  },
  {
    title: "Betrieb",
    items: [
      { href: "/app/tasks", label: "Tasks", icon: SquareCheckIcon },
      { href: "/app/approvals", label: "Approvals", icon: ShieldCheckIcon },
      { href: "/app/activity", label: "Activity", icon: ActivityIcon },
      { href: "/app/goals", label: "Goals", icon: TargetIcon },
      { href: "/app/reports", label: "Reports", icon: ChartColumnIcon },
    ],
  },
  {
    title: "Wissen & Anbindung",
    items: [
      { href: "/app/knowledge", label: "Knowledge", icon: BookOpenIcon },
      { href: "/app/marketplace", label: "Marketplace", icon: StoreIcon },
      { href: "/app/integrations", label: "Integrations", icon: PlugIcon },
    ],
  },
  {
    title: "Verwaltung",
    items: [
      { href: "/app/team", label: "Team", icon: UsersRoundIcon },
      { href: "/app/billing", label: "Billing", icon: CreditCardIcon },
      { href: "/app/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];
