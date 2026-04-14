import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const queueViews = ["New", "Hot", "Stuck", "Overdue"];

const OperatorHub = () => {
  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="glass-card rounded-xl px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Axivo IB/Broker Operator Hub v1</h1>
              <p className="text-sm text-muted-foreground">Control room shell — Phase 6 / P6-01</p>
            </div>
            <Badge variant="secondary">Build in progress</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="xl:col-span-4">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Lead Queue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {queueViews.map((view) => (
                    <Badge key={view} variant="outline">
                      {view}
                    </Badge>
                  ))}
                </div>
                <Separator />
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Placeholder list area for queue rows (live Supabase reads in next steps).
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="xl:col-span-4">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Lead Detail Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-muted-foreground">Fields to render on lead click:</div>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>name</li>
                  <li>source</li>
                  <li>stage</li>
                  <li>owner</li>
                  <li>priority</li>
                  <li>follow-up due</li>
                  <li>last action</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="xl:col-span-4">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Action Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-muted-foreground">Webhook action controls to wire:</div>
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>Reassign</li>
                  <li>Change Stage</li>
                  <li>Trigger Follow-up</li>
                  <li>Mark as Lost / Won / Nurture</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default OperatorHub;
