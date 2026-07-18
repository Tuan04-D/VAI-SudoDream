import clsx from "clsx";
import { motion } from "motion/react";
import type { ChatMessage } from "@/lib/types";

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={clsx("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
          isUser ? "bg-primary text-primary-ink" : "bg-surface-muted text-ink"
        )}
      >
        {message.content}
      </div>
    </motion.div>
  );
}
