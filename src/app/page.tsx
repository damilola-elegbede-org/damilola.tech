'use client';

import { useState } from 'react';
import {
  Hero,
  About,
  Experience,
  Skills,
  Education,
  Contact,
} from '@/components/sections';
import { ChatFab, ChatPanel } from '@/components/chat';

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChat = () => setIsChatOpen(!isChatOpen);
  const closeChat = () => setIsChatOpen(false);

  return (
    <>
      <main>
        <Hero onOpenChat={toggleChat} />
        <About />
        <Experience />
        <Skills />
        <Education />
        <Contact />
      </main>

      <ChatFab onClick={toggleChat} isOpen={isChatOpen} />
      <ChatPanel isOpen={isChatOpen} onClose={closeChat} />
    </>
  );
}
