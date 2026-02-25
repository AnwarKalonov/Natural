import React, { useState, useEffect } from 'react';

interface DocsProps {
  onClose: () => void;
}

interface DocSection {
  id: string;
  title: string;
  items: { id: string; title: string; content: React.ReactNode }[];
}

const CodeBlock = ({ children }: { children?: React.ReactNode }) => (
  <div className="my-4 rounded-lg overflow-hidden bg-[#1e1e1e] border border-white/10 text-sm font-mono shadow-sm">
    <div className="flex items-center px-4 py-2 bg-[#252526] border-b border-white/5">
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/20"></div>
      </div>
      <span className="ml-auto text-xs text-white/30">natural</span>
    </div>
    <div className="p-4 overflow-x-auto text-blue-100/90 leading-relaxed whitespace-pre">
      {children}
    </div>
  </div>
);

const Callout = ({ type = 'info', children }: { type?: 'info' | 'warning' | 'tip', children?: React.ReactNode }) => {
  const styles = {
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-200',
    warning: 'bg-orange-500/10 border-orange-500/20 text-orange-200',
    tip: 'bg-green-500/10 border-green-500/20 text-green-200',
  };
  
  const icons = {
    info: 'info',
    warning: 'warning',
    tip: 'lightbulb',
  };

  return (
    <div className={`my-6 p-4 rounded-lg border flex gap-3 ${styles[type]}`}>
      <span className="material-symbols-outlined shrink-0">{icons[type]}</span>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
};

const DOCS_DATA: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      {
        id: 'introduction',
        title: 'Introduction',
        content: (
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-white mb-4">Introduction</h1>
            <p className="text-lg text-white/70 leading-relaxed">
              Natural is the first <strong>intent-based development environment</strong>. It allows you to build sophisticated web applications using plain English instructions, bypassing the boilerplate of traditional coding while retaining the power of React and Tailwind CSS.
            </p>
            <Callout type="tip">
              Natural is not a no-code tool. It is a code-generation tool. The output is real, clean, semantic HTML/React code that you can export and deploy anywhere.
            </Callout>
            <h3 className="text-2xl font-bold text-white mt-8 mb-4">Core Philosophy</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                    <div className="text-xl font-bold text-white mb-2">Declarative Intent</div>
                    <p className="text-white/60 text-sm">Focus on *what* you want to build, not *how* to implement the syntax.</p>
                </div>
                <div className="p-6 bg-white/5 rounded-xl border border-white/10">
                    <div className="text-xl font-bold text-white mb-2">Instant Feedback</div>
                    <p className="text-white/60 text-sm">See your changes live as you type. No compilation delays.</p>
                </div>
            </div>
          </div>
        )
      },
      {
        id: 'quickstart',
        title: 'Quick Start',
        content: (
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-white mb-4">Quick Start Guide</h1>
            <p className="text-white/70">Build your first application in under 30 seconds.</p>
            
            <h3 className="text-xl font-bold text-white mt-8">1. Create a File</h3>
            <p className="text-white/70">
              In the file explorer, create a new file with the <code>.en</code> extension (e.g., <code>hello.en</code>). This activates the Natural compiler.
            </p>

            <h3 className="text-xl font-bold text-white mt-8">2. Describe the UI</h3>
            <p className="text-white/70">Type the following into the editor:</p>
            <CodeBlock>
{`Create a centered card container with a shadow.
Add a large title "Hello World".
Add a description "This is my first Natural app.".
Add a blue button "Get Started".`}
            </CodeBlock>

            <h3 className="text-xl font-bold text-white mt-8">3. Run & Preview</h3>
            <p className="text-white/70">
              Click the <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-bold"><span className="material-symbols-outlined text-[14px] mr-1">play_arrow</span> Run</span> button in the header. The preview pane will instantly render your application.
            </p>
          </div>
        )
      }
    ]
  },
  {
    id: 'core-concepts',
    title: 'Core Concepts',
    items: [
      {
        id: 'syntax',
        title: 'Natural Syntax',
        content: (
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-white mb-4">Natural Syntax</h1>
            <p className="text-white/70">
              While Natural understands loose English, following a structured "Subject-Verb-Object" pattern yields the most precise results.
            </p>

            <h3 className="text-xl font-bold text-white mt-8">Imperative Style</h3>
            <p className="text-white/70">Treat the editor like a junior developer. Give clear, direct commands.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="border border-green-500/20 bg-green-500/5 p-4 rounded-lg">
                    <div className="text-green-400 font-bold mb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined">check_circle</span> Do
                    </div>
                    <ul className="text-white/70 space-y-2 text-sm">
                        <li>"Create a navigation bar."</li>
                        <li>"Add a red button."</li>
                        <li>"Make the background dark gray."</li>
                    </ul>
                </div>
                <div className="border border-red-500/20 bg-red-500/5 p-4 rounded-lg">
                    <div className="text-red-400 font-bold mb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined">cancel</span> Don't
                    </div>
                    <ul className="text-white/70 space-y-2 text-sm">
                        <li>"I was thinking maybe we could have..."</li>
                        <li>"It looks ugly." (Too vague)</li>
                        <li>"Navbar." (Too brief)</li>
                    </ul>
                </div>
            </div>

            <h3 className="text-xl font-bold text-white mt-8">Nesting & Context</h3>
            <p className="text-white/70">
              Natural understands context. When you create a container, subsequent commands are assumed to be <em>inside</em> that container until you close it.
            </p>
            <CodeBlock>
{`Create a card.
  Add a title "Login".  <-- Inside the card
  Add an input "Email". <-- Inside the card
End card.               <-- Context closed
Add a footer.           <-- Outside the card`}
            </CodeBlock>
          </div>
        )
      },
      {
        id: 'components',
        title: 'Components',
        content: (
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-white mb-4">Component Library</h1>
            <p className="text-white/70">
              Natural maps your words to a robust library of React components styled with Tailwind CSS.
            </p>

            <h3 className="text-xl font-bold text-white mt-8">Containers</h3>
            <table className="w-full text-left text-sm mt-4 border border-white/10 rounded-lg overflow-hidden">
                <thead className="bg-white/5 text-white/90">
                    <tr>
                        <th className="p-3 border-b border-white/10">Keyword</th>
                        <th className="p-3 border-b border-white/10">Description</th>
                    </tr>
                </thead>
                <tbody className="text-white/60">
                    <tr className="border-b border-white/5">
                        <td className="p-3 font-mono text-blue-300">Card / Box</td>
                        <td className="p-3">A container with padding, rounded corners, and optional shadow.</td>
                    </tr>
                    <tr className="border-b border-white/5">
                        <td className="p-3 font-mono text-blue-300">Row / Stack</td>
                        <td className="p-3">Horizontally aligns its children (Flexbox row).</td>
                    </tr>
                    <tr className="border-b border-white/5">
                        <td className="p-3 font-mono text-blue-300">Grid</td>
                        <td className="p-3">Creates a responsive grid layout.</td>
                    </tr>
                </tbody>
            </table>
          </div>
        )
      }
    ]
  },
  {
    id: 'advanced',
    title: 'Advanced Features',
    items: [
      {
        id: 'ghostwriter',
        title: 'Ghostwriter AI',
        content: (
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-white mb-4">Ghostwriter AI</h1>
            <p className="text-white/70">
              Ghostwriter is the advanced logic engine integrated into the editor. While the standard compiler handles UI, Ghostwriter handles complex interactions and logic.
            </p>
            <Callout type="info">
                Trigger Ghostwriter by pressing <strong className="text-white">CMD + K</strong>.
            </Callout>
          </div>
        )
      },
      {
        id: 'deploy',
        title: 'Deploying',
        content: (
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-white mb-4">Deploying Your App</h1>
            <p className="text-white/70">
              Since Natural generates standard React code, you can deploy your projects to any platform that supports static sites or React apps.
            </p>
            <Callout type="tip">
              Use the "Publish" button in the editor to get a hosted link instantly.
            </Callout>
          </div>
        )
      }
    ]
  }
];

export const Docs: React.FC<DocsProps> = ({ onClose }) => {
  const [activeCategory, setActiveCategory] = useState(DOCS_DATA[0].id);
  const [activePage, setActivePage] = useState(DOCS_DATA[0].items[0].id);

  // Auto-select first item when category changes
  useEffect(() => {
    const category = DOCS_DATA.find(c => c.id === activeCategory);
    if (category && !category.items.find(i => i.id === activePage)) {
        setActivePage(category.items[0].id);
    }
  }, [activeCategory]);

  const currentPage = DOCS_DATA.find(c => c.id === activeCategory)?.items.find(i => i.id === activePage);

  return (
    <div className="fixed inset-0 bg-[#0e1011] z-50 flex flex-col animate-in fade-in duration-300 font-sans">
      {/* Header */}
      <header className="h-16 border-b border-white/10 bg-[#0A0A0A] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-lg">menu_book</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-white">Documentation</span>
            <span className="bg-white/10 text-white/50 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium ml-2">v2.1</span>
        </div>
        <button 
            onClick={onClose}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg text-sm font-medium"
        >
            <span>Close</span>
            <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-white/10 bg-[#0c0c0c] flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
            <div className="p-6 space-y-8">
                {DOCS_DATA.map((section) => (
                    <div key={section.id}>
                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4 pl-3">
                            {section.title}
                        </h4>
                        <div className="space-y-1">
                            {section.items.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        setActiveCategory(section.id);
                                        setActivePage(item.id);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-between group ${
                                        activePage === item.id 
                                            ? 'bg-blue-600/10 text-blue-400' 
                                            : 'text-white/60 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {item.title}
                                    {activePage === item.id && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]"></span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#0e1011] relative">
            <div className="max-w-4xl mx-auto py-16 px-8 lg:px-12">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm text-white/40 mb-8 font-mono">
                    <span>Docs</span>
                    <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                    <span className="text-white/60">{DOCS_DATA.find(c => c.id === activeCategory)?.title}</span>
                    <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                    <span className="text-blue-400">{currentPage?.title}</span>
                </div>

                {/* Content */}
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {currentPage?.content}
                </div>
            </div>
        </main>
      </div>
    </div>
  );
};
