'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChatViewer } from '@/components/admin/ChatViewer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  parts: { type: string; text: string }[];
}

interface ChatSession {
  sessionId: string;
  environment: string;
  archivedAt: string;
  sessionStartedAt: string;
  messageCount: number;
  messages: Message[];
}

export default function ChatDetailPage() {
  const params = useParams();
  const [chat, setChat] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChat() {
      try {
        const id = params.id as string;
        const res = await fetch(`/api/admin/chats/${id}`);
        if (!res.ok) throw new Error('Chat not found');
        const data = await res.json();
        setChat(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    fetchChat();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/chats"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          ← Back to Chats
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-[var(--color-text)]">Chat Session</h1>
      {chat && <ChatViewer chat={chat} />}
    </div>
  );
}
