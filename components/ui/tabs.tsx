"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type TabsContextType = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

const TabsContext = createContext<TabsContextType | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tab components must be used within a Tabs provider");
  }
  return context;
}

type TabsProps = {
  defaultTab: string;
  children: ReactNode;
  className?: string;
};

export function Tabs({ defaultTab, children, className = "" }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

type TabListProps = {
  children: ReactNode;
  className?: string;
};

export function TabList({ children, className = "" }: TabListProps) {
  return (
    <div
      className={`flex gap-6 border-b border-[#E5E0D8] ${className}`}
      role="tablist"
    >
      {children}
    </div>
  );
}

type TabProps = {
  value: string;
  children: ReactNode;
  className?: string;
};

export function Tab({ value, children, className = "" }: TabProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(value)}
      className={`
        relative px-1 py-3 text-sm transition-all duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B1AFFF] focus-visible:ring-offset-2 rounded-sm
        ${isActive
          ? "text-[#1C1B1A] font-medium"
          : "text-[#8E8983] hover:text-[#55514D]"
        }
        ${className}
      `}
    >
      {children}
      {/* Active indicator */}
      <span
        className={`
          absolute bottom-0 left-0 right-0 h-0.5 bg-[#625FFF]
          transition-all duration-200
          ${isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}
        `}
      />
    </button>
  );
}

type TabPanelProps = {
  value: string;
  children: ReactNode;
  className?: string;
};

export function TabPanel({ value, children, className = "" }: TabPanelProps) {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) return null;

  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}
