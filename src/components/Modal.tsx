import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Adaptive modal:
 *  - Desktop / tablet: centered glass card.
 *  - Mobile (<768): bottom sheet with drag affordance, safe-area aware,
 *    sticky action footer, scroll-contained body.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const isMobile = useIsMobile();
  const widthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={
            isMobile
              ? "fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm"
              : "fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
          }
          onClick={onClose}
        >
          <motion.div
            initial={isMobile ? { y: "100%" } : { scale: 0.95, y: 10 }}
            animate={isMobile ? { y: 0 } : { scale: 1, y: 0 }}
            exit={isMobile ? { y: "100%" } : { scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            drag={isMobile ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className={
              isMobile
                ? "glass-strong rounded-t-3xl w-full max-h-[92dvh] flex flex-col relative safe-bottom"
                : `glass rounded-2xl w-full ${widthClass} p-6 relative max-h-[90vh] flex flex-col`
            }
            onClick={(e) => e.stopPropagation()}
          >
            {isMobile && <div className="sheet-handle shrink-0" />}
            <div
              className={
                isMobile
                  ? "flex justify-between items-center px-5 pt-1 pb-3 shrink-0 border-b border-border/40"
                  : "flex justify-between items-center mb-4 shrink-0"
              }
            >
              <h3 className="font-display font-semibold text-lg">{title}</h3>
              <Button variant="ghost" size="icon" onClick={onClose} className="touch-target">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div
              className={
                isMobile
                  ? "space-y-3 overflow-y-auto px-5 py-4 flex-1 overscroll-contain"
                  : "space-y-3 overflow-y-auto flex-1 pr-1"
              }
            >
              {children}
            </div>
            {footer && (
              <div
                className={
                  isMobile
                    ? "flex flex-wrap justify-end gap-2 px-5 py-3 border-t border-border/40 bg-background/60 backdrop-blur-md shrink-0"
                    : "flex justify-end gap-2 mt-6 shrink-0"
                }
              >
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
