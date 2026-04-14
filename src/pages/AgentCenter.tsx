import { useState } from "react";
import { DashboardDataProvider } from "@/context/DashboardDataContext";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import CommandDeck from "@/components/tabs/CommandDeck";
import AgentProfiles from "@/components/tabs/AgentProfiles";
import TaskBoard from "@/components/tabs/TaskBoard";
import AILog from "@/components/tabs/AILog";
import Council from "@/components/tabs/Council";
import MeetingIntelligence from "@/components/tabs/MeetingIntelligence";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LayoutDashboard, Users, Kanban, ScrollText, MessageSquare, Video } from "lucide-react";

const tabs = [
  { value: "tasks", label: "Task Board", Icon: Kanban },
  { value: "deck", label: "Command Deck", Icon: LayoutDashboard },
  { value: "agents", label: "Agents", Icon: Users },
  { value: "log", label: "AI Log", Icon: ScrollText },
  { value: "council", label: "Council", Icon: MessageSquare },
  { value: "meetings", label: "Meetings", Icon: Video },
];

const AgentCenter = () => {
  const [activeTab, setActiveTab] = useState("tasks");

  return (
    <DashboardDataProvider>
      <div className="min-h-screen bg-background px-4 py-6 md:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <Header />
          <p className="mb-3 text-xs text-primary">Agent Center (Current Surface)</p>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="glass-card mb-6 flex h-auto w-full flex-wrap gap-1 bg-transparent p-1.5">
              {tabs.map((t, i) => (
                <motion.div key={t.value} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <TabsTrigger value={t.value} className="gap-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <t.Icon size={14} /> {t.label}
                  </TabsTrigger>
                </motion.div>
              ))}
            </TabsList>
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <TabsContent value="deck" className="mt-0"><CommandDeck /></TabsContent>
                <TabsContent value="agents" className="mt-0"><AgentProfiles /></TabsContent>
                <TabsContent value="tasks" className="mt-0"><TaskBoard /></TabsContent>
                <TabsContent value="log" className="mt-0"><AILog /></TabsContent>
                <TabsContent value="council" className="mt-0"><Council /></TabsContent>
                <TabsContent value="meetings" className="mt-0"><MeetingIntelligence /></TabsContent>
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </div>
      </div>
    </DashboardDataProvider>
  );
};

export default AgentCenter;
