'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable } from '@/components/admin/DataTable';
import { Pagination } from '@/components/admin/Pagination';

interface ChatSummary {
  id: string;
  sessionId: string;
  environment: string;
  timestamp: string;
  size: number;
  url: string;
}

export default function ChatsPage() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchChats = async (append = false) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (cursor && append) params.set('cursor', cursor);

      const res = await fetch(`/api/admin/chats?${params}`);
      if (!res.ok) throw new Error('Failed to fetch chats');

      const data = await res.json();
      setChats(append ? [...chats, ...data.chats] : data.chats);
      setCursor(data.cursor);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = [
    { key: 'sessionId', header: 'Session ID', render: (c: ChatSummary) => (
      <span className="font-mono text-xs">{c.sessionId}</span>
    )},
    { key: 'timestamp', header: 'Date', render: (c: ChatSummary) => (
      c.timestamp ? new Date(c.timestamp).toLocaleString() : '-'
    )},
    { key: 'size', header: 'Size', render: (c: ChatSummary) => (
      `${(c.size / 1024).toFixed(1)} KB`
    )},
  ];

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-text)]">Chat Sessions</h1>
      <DataTable
        data={chats}
        columns={columns}
        onRowClick={(chat) => router.push(`/admin/chats/${encodeURIComponent(chat.url)}`)}
        isLoading={isLoading && chats.length === 0}
      />
      <Pagination hasMore={hasMore} onLoadMore={() => fetchChats(true)} isLoading={isLoading} />
    </div>
  );
}
