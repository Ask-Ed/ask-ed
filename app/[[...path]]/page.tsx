"use client";

import { use, useEffect } from "react";
import { ChatLayout } from "@/components/chat/chat-layout";
import { ChatInterface } from "@/components/chat/chat-interface";
import { useChatStore } from "@/lib/store/chat-store";

interface PageProps {
  params: Promise<{ path?: string[] }>;
}

function getThreadId(path?: string[]): string | null {
  return path?.[0] === 'chat' && path[1] ? path[1] : null;
}

export default function Page({ params }: PageProps) {
  const { path } = use(params);
  const threadId = getThreadId(path);
  const { setCurrentThread, clearInput } = useChatStore();

  useEffect(() => {
    setCurrentThread(threadId);
    if (!threadId) clearInput();
  }, [threadId, setCurrentThread, clearInput]);

  return (
    <ChatLayout>
      <ChatInterface />
    </ChatLayout>
  );
}
