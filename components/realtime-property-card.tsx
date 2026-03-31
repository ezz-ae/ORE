"use client"

import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell } from "recharts"
import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { Home, Eye } from "lucide-react"

const defaultHourlyData = [
  { hour: "12am", visitors: 120 },
  { hour: "2am", visitors: 80 },
  { hour: "4am", visitors: 45 },
  { hour: "6am", visitors: 90 },
  { hour: "8am", visitors: 280 },
  { hour: "10am", visitors: 420 },
  { hour: "12pm", visitors: 380 },
  { hour: "2pm", visitors: 450 },
  { hour: "4pm", visitors: 520 },
  { hour: "6pm", visitors: 480 },
  { hour: "8pm", visitors: 350 },
  { hour: "10pm", visitors: 220 },
]

const defaultTopProperties = [
  { page: "Palm Jumeirah Villa", visitors: 445 },
  { page: "Downtown Loft", visitors: 389 },
  { page: "Dubai Marina Penthouse", visitors: 356 },
  { page: "Business Bay Office", visitors: 298 },
]

export function RealtimePropertyCard() {
  const [currentVisitors, setCurrentVisitors] = useState(847)
  const [pageViews, setPageViews] = useState(3420)
  const [hourlyData, setHourlyData] = useState(defaultHourlyData)
  const [topProperties, setTopProperties] = useState(defaultTopProperties)
  const [highlightedBar, setHighlightedBar] = useState(8)

  const maxVisitors = Math.max(...hourlyData.map((d) => d.visitors))

  // Animate visitor count
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVisitors((prev) => prev + Math.floor(Math.random() * 10) - 3)
      setPageViews((prev) => prev + Math.floor(Math.random() * 5))
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // Animate bar highlight
  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightedBar((prev) => (prev + 1) % hourlyData.length)
    }, 1500)
    return () => clearInterval(interval)
  }, [hourlyData.length])

  // Update hourly data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setHourlyData((prev) =>
        prev.map((item) => ({
          ...item,
          visitors: Math.max(30, item.visitors + Math.floor(Math.random() * 40) - 20),
        })),
      )
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Update top properties periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setTopProperties((prev) =>
        prev.map((item) => ({
          ...item,
          visitors: Math.max(50, item.visitors + Math.floor(Math.random() * 20) - 10),
        })),
      )
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      viewport={{ once: true }}
      className="w-full rounded-[2.5rem] bg-[#0d0d0d] p-8 border border-white/10 shadow-2xl relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -z-10" />
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-serif font-bold text-white tracking-tight">Market Pulse</h3>
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Live Intelligence</span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <motion.div
           className="rounded-2xl bg-white/5 border border-white/10 p-5 group hover:border-primary/30 transition-colors"
           whileHover={{ y: -5 }}
         >
           <div className="flex items-center gap-2 mb-2">
             <Eye className="w-4 h-4 text-primary" />
             <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Viewing Now</p>
           </div>
           <AnimatePresence mode="wait">
             <motion.p
               key={currentVisitors}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="text-4xl font-serif font-bold text-white tracking-tighter"
             >
               {currentVisitors.toLocaleString()}
             </motion.p>
           </AnimatePresence>
         </motion.div>
         <motion.div
           className="rounded-2xl bg-white/5 border border-white/10 p-5 group hover:border-primary/30 transition-colors"
           whileHover={{ y: -5 }}
         >
           <div className="flex items-center gap-2 mb-2">
             <Home className="w-4 h-4 text-primary" />
             <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Daily Flux</p>
           </div>
           <AnimatePresence mode="wait">
             <motion.p
               key={pageViews}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="text-4xl font-serif font-bold text-white tracking-tighter"
             >
               {pageViews.toLocaleString()}
             </motion.p>
           </AnimatePresence>
         </motion.div>
      </div>

      <div className="mb-6">
        <p className="mb-3 text-sm font-medium text-slate-700">Views Today</p>
              <defs>
                <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4AF37" />
                  <stop offset="100%" stopColor="#AA8122" />
                </linearGradient>
              </defs>
              <Bar dataKey="visitors" radius={[4, 4, 0, 0]}>
                {hourlyData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === highlightedBar ? "url(#goldGradient)" : "#1a1a1a"}
                  />
                ))}
              </Bar>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-slate-700">Trending Properties</p>
        <div className="space-y-2">
          {topProperties.map((property, index) => (
            <motion.div
              key={index}
              className="flex items-center justify-between rounded-xl bg-white/5 border border-white/5 px-4 py-3 group hover:border-primary/20 transition-all"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <span className="text-sm font-medium text-white/50 group-hover:text-white transition-colors">{property.page}</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={property.visitors}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-sm font-bold text-primary"
                >
                  {property.visitors}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
