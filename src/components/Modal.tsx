import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm" onClick={onClose}>
          <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="glass rounded-2xl w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-semibold text-lg">{title}</h3>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>
            <div className="space-y-3">{children}</div>
            {footer && <div className="flex justify-end gap-2 mt-6">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
