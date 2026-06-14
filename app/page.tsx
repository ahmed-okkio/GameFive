import React from 'react';

export default function Page() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 text-stone-300 font-sans selection:bg-gold/30">
      <div className="max-w-2xl w-full space-y-8 animate-in fade-in duration-1000">
        <h1 className="text-2xl font-bold text-stone-100 border-b border-stone-800 pb-4">
          Cessation of Operations
        </h1>
        
        <div className="space-y-6 text-sm leading-relaxed">
          <p className="font-semibold text-stone-200">
            Dear Community,
          </p>

          <p>
            It is with a heavy heart that we announce the decision to permanently cease operations of GameFive, effective immediately.
          </p>

          <p>
            At the foundation of GameFive has always been a commitment to fostering a healthy, constructive, and enjoyable competitive environment. In recent times, our leadership team has engaged in extensive reflection regarding the broader impact of highly competitive gaming platforms on player mental health and well-being. Guided by our corporate responsibility to prioritize the long-term wellness of our user base over growth, we have determined that it is no longer appropriate for us to continue operating this platform.
          </p>

          <p>
            This was not an easy decision, but we believe it is the necessary one. We extend our deepest gratitude to our dedicated community for your passion, your feedback, and the vibrant competitive spirit you brought to GameFive.
          </p>

          <p>
            Thank you for being part of this chapter.
          </p>

          <div className="pt-4 border-t border-stone-800">
            <p className="font-bold text-gold/80">Sincerely,</p>
            <p className="text-stone-400">The GameFive Executive Team</p>
          </div>
        </div>
      </div>
    </div>
  );
}
