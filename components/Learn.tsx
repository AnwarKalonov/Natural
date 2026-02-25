import React from 'react';

export const Learn: React.FC = () => {
  return (
    <div className="p-8 max-w-5xl mx-auto text-[#e6edf3] animate-in fade-in duration-500">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Learn Natural Code</h1>
        <p className="text-lg text-[#8d96a0]">Master the art of intent-based programming.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <div className="bg-[#1c1e21] border border-[#2b3035] rounded-xl p-6 hover:border-blue-500/50 transition-colors">
          <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-blue-400 text-2xl">school</span>
          </div>
          <h3 className="text-xl font-bold mb-2">The Basics</h3>
          <p className="text-[#8d96a0] mb-4 text-sm leading-relaxed">
            Understand how Natural translates plain English into executable React code. Learn about the compilation pipeline and file structure.
          </p>
          <button className="text-blue-400 text-sm font-medium hover:underline">Start Tutorial &rarr;</button>
        </div>

        <div className="bg-[#1c1e21] border border-[#2b3035] rounded-xl p-6 hover:border-purple-500/50 transition-colors">
          <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-purple-400 text-2xl">auto_awesome</span>
          </div>
          <h3 className="text-xl font-bold mb-2">Prompt Engineering</h3>
          <p className="text-[#8d96a0] mb-4 text-sm leading-relaxed">
            Learn how to phrase your instructions for maximum precision. Discover the difference between imperative and descriptive prompts.
          </p>
          <button className="text-purple-400 text-sm font-medium hover:underline">Read Guide &rarr;</button>
        </div>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-yellow-500">lightbulb</span>
            Core Concepts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#151719] p-5 rounded-lg border border-[#2b3035]">
              <h4 className="font-bold mb-2 text-white">Intent vs. Implementation</h4>
              <p className="text-sm text-[#8d96a0]">You define the *what*, our engine handles the *how*. Focus on the user experience rather than syntax.</p>
            </div>
            <div className="bg-[#151719] p-5 rounded-lg border border-[#2b3035]">
              <h4 className="font-bold mb-2 text-white">Context Awareness</h4>
              <p className="text-sm text-[#8d96a0]">The compiler understands nesting. Commands like "Add a button" apply to the most recently created container.</p>
            </div>
            <div className="bg-[#151719] p-5 rounded-lg border border-[#2b3035]">
              <h4 className="font-bold mb-2 text-white">Hybrid Editing</h4>
              <p className="text-sm text-[#8d96a0]">Switch seamlessly between English instructions and standard HTML/CSS/JS files for granular control.</p>
            </div>
          </div>
        </section>

        <section>
           <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-green-500">terminal</span>
            Keyboard Shortcuts
          </h2>
          <div className="bg-[#1c1e21] border border-[#2b3035] rounded-xl overflow-hidden">
             <div className="grid grid-cols-2 p-4 border-b border-[#2b3035] bg-[#151719] text-sm font-bold text-[#8d96a0]">
                <div>Action</div>
                <div>Shortcut</div>
             </div>
             <div className="divide-y divide-[#2b3035]">
                <div className="grid grid-cols-2 p-4 text-sm hover:bg-[#25282c]">
                    <div className="text-white">Run / Compile</div>
                    <div className="font-mono text-[#8d96a0]">CMD + Enter</div>
                </div>
                <div className="grid grid-cols-2 p-4 text-sm hover:bg-[#25282c]">
                    <div className="text-white">Ghostwriter AI</div>
                    <div className="font-mono text-[#8d96a0]">CMD + K</div>
                </div>
                <div className="grid grid-cols-2 p-4 text-sm hover:bg-[#25282c]">
                    <div className="text-white">Save Project</div>
                    <div className="font-mono text-[#8d96a0]">CMD + S</div>
                </div>
                <div className="grid grid-cols-2 p-4 text-sm hover:bg-[#25282c]">
                    <div className="text-white">Toggle Preview</div>
                    <div className="font-mono text-[#8d96a0]">CMD + P</div>
                </div>
             </div>
          </div>
        </section>
      </div>
    </div>
  );
};
