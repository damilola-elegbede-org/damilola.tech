'use client';

import { useState } from 'react';
import {
  Hero,
  Experience,
  SkillsAssessment,
  Education,
  Contact,
} from '@/components/sections';
import { BackToTop } from '@/components/ui';
import { ChatFab, ChatPanel } from '@/components/chat';

export default function Home() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  const toggleChat = () => setIsChatOpen(!isChatOpen);
  const closeChat = () => setIsChatOpen(false);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--color-accent)] focus:px-4 focus:py-2 focus:text-white focus:outline-none"
      >
        Skip to main content
      </a>
      <main id="main-content">
        <Hero onOpenChat={toggleChat} />
        <Experience />
        <SkillsAssessment />
        <Education />
        <Contact />
      </main>

      <BackToTop />
      <ChatFab onClick={toggleChat} isOpen={isChatOpen} />
      <ChatPanel isOpen={isChatOpen} onClose={closeChat} />
    </>
  );
}
