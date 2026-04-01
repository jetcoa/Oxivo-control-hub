import { Settings } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/oxivo-logo.png";

const Header = () => (
  <motion.header
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="glass-card mb-6 flex items-center justify-between px-6 py-4"
    style={{ borderLeft: "3px solid hsl(160, 84%, 39%)", boxShadow: "inset 4px 0 12px rgba(16,185,129,0.10)" }}
  >
    <div className="flex items-center gap-3">
      <img src={logo} alt="OXIVO logo" className="h-9 w-9 rounded-lg bg-foreground/90 p-1" />
      <div>
        <h1 className="text-xl font-bold tracking-tight">OXIVO</h1>
        <p className="text-xs text-muted-foreground">AI Agent Command Center</p>
      </div>
    </div>
    <div className="flex items-center gap-3 text-sm">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
      </span>
      <div className="hidden sm:block">
        <span className="font-medium">Agent Alpha: Online</span>
        <span className="ml-2 text-muted-foreground">Last seen: just now</span>
      </div>
      <button className="ml-2 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
        <Settings size={18} />
      </button>
    </div>
  </motion.header>
);

export default Header;
