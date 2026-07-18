import type { Commune } from "@/lib/types";
import ChatView from "./ChatView";

export default function ChatSection({
  communes,
  defaultCommuneId,
}: {
  communes: Commune[];
  defaultCommuneId: string;
}) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 lg:px-8">
      <header>
        <h2 className="font-display text-2xl font-bold">Hỏi đáp</h2>
        <p className="text-sm text-ink-muted">
          Trò chuyện bằng giọng nói hoặc văn bản, tiếng Việt hoặc tiếng H&apos;Mông
        </p>
      </header>
      <ChatView communes={communes} defaultCommuneId={defaultCommuneId} />
    </div>
  );
}
