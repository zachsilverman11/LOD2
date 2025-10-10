import { DevCard, DevCardComment, DevCardType, DevCardStatus, DevCardPriority } from "@/app/generated/prisma";

export type DevCardWithComments = DevCard & {
  comments: DevCardComment[];
};

export { DevCardType, DevCardStatus, DevCardPriority };

export const DEV_CARD_COLUMNS = [
  {
    id: "NEW" as DevCardStatus,
    label: "New Feature Requests",
    color: "#625FFF",
    types: ["FEATURE_REQUEST", "IMPROVEMENT"]
  },
  {
    id: "NEW" as DevCardStatus,
    label: "Bug Fixes",
    color: "#FF6B6B",
    types: ["BUG_FIX", "OPTIMIZATION"]
  },
  {
    id: "IN_PROGRESS" as DevCardStatus,
    label: "Working On It",
    color: "#FFD93D",
    types: null // all types
  },
  {
    id: "DEPLOYED" as DevCardStatus,
    label: "Deployed",
    color: "#6BCF7F",
    types: null // all types
  },
];

export const PRIORITY_COLORS = {
  LOW: "#B1AFFF",
  MEDIUM: "#FFD93D",
  HIGH: "#FF9F43",
  CRITICAL: "#FF6B6B"
};

export const PRIORITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical"
};

export const TYPE_LABELS = {
  FEATURE_REQUEST: "Feature Request",
  BUG_FIX: "Bug Fix",
  IMPROVEMENT: "Improvement",
  OPTIMIZATION: "Optimization"
};
