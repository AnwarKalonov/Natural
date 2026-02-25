
import React, { useState, useEffect, useRef } from 'react';
import { Preview } from './Preview';
import { compileEnglishToApp } from '../services/geminiService';

// --- Local Components Definitions ---

const FlashlightBackground = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div 
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
            background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(34, 211, 238, 0.03), transparent 40%)`
        }}
    />
  );
};

const MagneticButton: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = "", onClick }) => {
    const ref = useRef<HTMLButtonElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent) => {
        const { clientX, clientY } = e;
        const { left, top, width, height } = ref.current?.getBoundingClientRect() || { left: 0, top: 0, width: 0, height: 0 };
        const x = clientX - (left + width / 2);
        const y = clientY - (top + height / 2);
        setPosition({ x: x * 0.1, y: y * 0.1 });
    };

    const handleMouseLeave = () => {
        setPosition({ x: 0, y: 0 });
    };

    return (
        <button
            ref={ref}
            className={`transition-transform duration-200 ease-out ${className}`}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        >
            {children}
        </button>
    );
};

const ScrollReveal: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { threshold: 0.1 });

        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={`transition-all duration-1000 ease-out transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
};

const SpotlightCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => {
    const divRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [opacity, setOpacity] = useState(0);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!divRef.current) return;
        const rect = divRef.current.getBoundingClientRect();
        setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setOpacity(1);
    };

    const handleMouseLeave = () => {
        setOpacity(0);
    };

    return (
        <div
            ref={divRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`relative overflow-hidden ${className}`}
        >
            <div
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
                style={{
                    opacity,
                    background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(255,255,255,0.06), transparent 40%)`,
                }}
            />
            {children}
        </div>
    );
};

const FAQItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b border-white/10 last:border-0">
            <button
                className="w-full py-6 flex items-center justify-between text-left hover:text-cyan-400 transition-colors focus:outline-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="text-lg font-medium">{question}</span>
                <span className={`material-symbols-outlined transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                </span>
            </button>
            <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100 pb-6' : 'max-h-0 opacity-0'}`}
            >
                <p className="text-white/60 leading-relaxed text-sm md:text-base">{answer}</p>
            </div>
        </div>
    );
};

// --- DEMO VIDEO COMPONENT ---
// Incremental Real-time Preview Demo

const IncrementalCalculator = ({ step, display, activeBtn }: { step: number, display: string, activeBtn: string | null }) => {
    // Reveal Steps based on script line index (approximate)
    // 0: "Create a centered dark card."
    const showCard = step >= 1;
    // 1: "Add a display output for results."
    const showDisplay = step >= 2;
    // 2: "Create a grid with 4 columns." (Invisible structure, but implied for buttons)
    
    // Buttons Logic:
    // 3: "Add buttons: 7, 8, 9, /."
    // 4: "Add buttons: 4, 5, 6, *."
    // 5: "Add buttons: 1, 2, 3, -."
    // 6: "Add buttons: C, 0, =, +."
    // 7: "Make the buttons gray, but operation buttons orange." (Color application)
    
    const useColors = step >= 8;
    const buttons = ['7','8','9','/','4','5','6','*','1','2','3','-','C','0','=','+'];
    
    const isVisible = (index: number) => {
        if (index < 4) return step >= 4;
        if (index < 8) return step >= 5;
        if (index < 12) return step >= 6;
        return step >= 7;
    };

    if (!showCard) return (
        <div className="flex flex-col items-center justify-center text-white/20 animate-pulse">
            <span className="material-symbols-outlined text-4xl mb-2">terminal</span>
            <span className="text-xs font-mono">Waiting for input...</span>
        </div>
    );

    return (
        <div className="w-64 bg-[#1e1e1e] p-6 rounded-2xl shadow-2xl border border-white/10 animate-pop-in transition-all duration-300">
            {showDisplay && (
                <div className="h-16 bg-[#000] rounded-lg mb-4 flex items-center justify-end px-4 text-3xl font-mono text-white tracking-widest shadow-inner border border-white/5 animate-pop-in">
                    {display || "0"}
                </div>
            )}
            <div className="grid grid-cols-4 gap-3 transition-all duration-300">
                {buttons.map((btn, i) => (
                    isVisible(i) ? (
                        <button 
                            key={btn}
                            className={`
                                h-12 w-12 rounded-full font-bold text-lg flex items-center justify-center transition-all duration-300 animate-pop-in
                                ${useColors 
                                    ? (['/','*','-','+','='].includes(btn) ? 'bg-orange-500 text-white' : 'bg-[#333] text-white')
                                    : 'bg-gray-800 text-white' // Pre-styled default
                                }
                                ${activeBtn === btn ? 'scale-90 brightness-125' : ''}
                            `}
                        >
                            {btn}
                        </button>
                    ) : <div key={i} className="w-12 h-12" />
                ))}
            </div>
        </div>
    );
};

const DemoVideo = () => {
    const [typedLines, setTypedLines] = useState<string[]>([]);
    const [currentLineText, setCurrentLineText] = useState("");
    const [lineToTypeIndex, setLineToTypeIndex] = useState(0);
    const [phase, setPhase] = useState<'typing' | 'interacting' | 'resetting'>('typing');
    
    // Calculator State for simulation
    const [calcDisplay, setCalcDisplay] = useState("");
    const [activeButton, setActiveButton] = useState<string | null>(null);

    const scriptLines = [
        "Create a centered dark card.",
        "Add a display output for results.",
        "Create a grid with 4 columns.",
        "Add buttons: 7, 8, 9, /.",
        "Add buttons: 4, 5, 6, *.",
        "Add buttons: 1, 2, 3, -.",
        "Add buttons: C, 0, =, +.",
        "Make the buttons gray, but operation buttons orange."
    ];

    // Typing Logic
    useEffect(() => {
        if (phase !== 'typing') return;

        if (lineToTypeIndex >= scriptLines.length) {
            const finishTimeout = setTimeout(() => setPhase('interacting'), 300);
            return () => clearTimeout(finishTimeout);
        }

        const targetLine = scriptLines[lineToTypeIndex];
        
        if (currentLineText.length < targetLine.length) {
            // Typing characters
            const typeTimeout = setTimeout(() => {
                setCurrentLineText(targetLine.substring(0, currentLineText.length + 1));
            }, 10); // Reduced typing speed for snappier feel
            return () => clearTimeout(typeTimeout);
        } else {
            // Line finished
            const linePauseTimeout = setTimeout(() => {
                setTypedLines(prev => [...prev, targetLine]);
                setCurrentLineText("");
                setLineToTypeIndex(prev => prev + 1);
            }, 100); // Reduced pause to let user see the element appear quickly
            return () => clearTimeout(linePauseTimeout);
        }
    }, [phase, lineToTypeIndex, currentLineText, scriptLines]);

    // Interaction Logic
    useEffect(() => {
        if (phase !== 'interacting') return;

        // Sped up sequence
        const sequence = [
                { btn: '7', val: '7', delay: 400 },
                { btn: '*', val: '7 *', delay: 800 },
                { btn: '6', val: '7 * 6', delay: 1200 },
                { btn: '=', val: '42', delay: 1600 },
        ];

        const timeouts: ReturnType<typeof setTimeout>[] = [];

        sequence.forEach(step => {
            timeouts.push(setTimeout(() => {
                setActiveButton(step.btn);
                setTimeout(() => setActiveButton(null), 150);
                setCalcDisplay(step.val);
            }, step.delay));
        });

        timeouts.push(setTimeout(() => {
            setPhase('resetting');
        }, 2500));

        return () => timeouts.forEach(clearTimeout);
    }, [phase]);

    // Reset Logic
    useEffect(() => {
        if (phase === 'resetting') {
             const t = setTimeout(() => {
                 setTypedLines([]);
                 setCurrentLineText("");
                 setLineToTypeIndex(0);
                 setCalcDisplay("");
                 setActiveButton(null);
                 setPhase('typing');
             }, 300);
             return () => clearTimeout(t);
        }
    }, [phase]);

    const fullCode = typedLines.join('\n') + (currentLineText ? '\n' + currentLineText : '');
    // Calculate current step for the incremental preview
    // We want the preview to update as soon as the line finishes typing.
    const currentStep = typedLines.length;

    return (
        <div className="flex flex-col xl:flex-row gap-8 items-stretch min-h-[600px] relative">
            {/* EDITOR PANE */}
            <SpotlightCard className="flex-1 bg-[#0A0A0A] rounded-[2rem] border border-white/10 flex flex-col relative group overflow-hidden shadow-2xl h-[500px]">
                {/* MacOS Header */}
                <div className="flex items-center px-4 py-3 border-b border-white/5 bg-black/40">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                        <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                    </div>
                    <div className="ml-4 text-xs text-white/30 font-mono">calculator.en</div>
                </div>
                
                <div className="flex-1 p-6 relative font-mono text-lg leading-relaxed text-[#d4d4d4] overflow-hidden">
                    <div className="absolute inset-0 p-6 whitespace-pre-wrap">
                        {fullCode}
                        {phase === 'typing' && <span className="inline-block w-2.5 h-5 bg-blue-500 ml-1 align-middle animate-pulse"></span>}
                    </div>
                </div>

                {/* Status Bar */}
                <div className="px-6 py-4 border-t border-white/5 flex justify-between items-center bg-black/20">
                    <div className="text-xs text-white/30 flex items-center gap-2">
                         <span className={`w-2 h-2 rounded-full ${phase === 'typing' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></span>
                         {phase === 'typing' ? 'Ghostwriter Active...' : 'Ready'}
                    </div>
                    <div className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-white/5 text-white/30 border border-white/5">
                        {phase === 'typing' ? 'Live Compile' : 'Interactive'}
                    </div>
                </div>
            </SpotlightCard>

            {/* PREVIEW PANE */}
            <div className="flex-1 bg-black rounded-[2rem] border border-white/10 relative overflow-hidden flex items-center justify-center group shadow-inner h-[500px]">
                {/* Browser Toolbar */}
                <div className="absolute top-0 left-0 right-0 h-10 bg-[#151719] flex items-center px-4 gap-2 border-b border-white/5 z-20">
                    <div className="flex-1 flex justify-center">
                        <div className="w-1/2 h-5 bg-[#0e1011] rounded flex items-center justify-center gap-1.5">
                            <span className="material-symbols-outlined text-[10px] text-green-500">lock</span>
                            <span className="text-[10px] text-white/30">{typeof window !== 'undefined' ? window.location.host : 'preview.local'}</span>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="relative z-10 w-full h-full flex items-center justify-center bg-[#0e1011]">
                    <IncrementalCalculator 
                        step={currentStep} 
                        display={calcDisplay}
                        activeBtn={activeButton}
                    />
                </div>
                
                {/* Scanlines */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_4px,3px_100%]"></div>
            </div>
        </div>
    );
};

// --- End Local Components ---

const TESTIMONIALS = [
    { text: "I built a landing page in 3 minutes that would have taken me 3 hours.", author: "Sarah J., Designer" },
    { text: "The ghostwriter feature is like having a senior dev over my shoulder.", author: "Mike T., Founder" },
    { text: "Finally, a tool that understands what I mean, not just what I type.", author: "Alex R., Product Manager" },
    { text: "It's not just a compiler, it's a creative partner.", author: "David L., Creative Director" },
    { text: "The hybrid mode is genius. I can tweak the code when I need to.", author: "Jessica K., Developer" }
];

const FAQS = [
    { q: "Do I need to know how to code?", a: "Not at all. Natural is designed to translate your plain English ideas into production-ready React code instantly. However, if you are a developer, you can edit the generated code directly." },
    { q: "Is the code exportable?", a: "Yes. You get clean, semantic React/Tailwind code that you can copy, download, or deploy to any standard hosting platform (Vercel, Netlify, etc)." },
    { q: "How complex can the apps be?", a: "Natural excels at landing pages, dashboards, portfolios, and interactive tools. For complex backend logic, it pairs perfectly with standard API integrations via the 'hybrid' mode." },
    { q: "Is it free to use?", a: "We are currently in public beta. All features are free while we fine-tune the engine." }
];

const PRICING_PLANS = [
    {
        name: "Hobby",
        price: "$0",
        period: "/mo",
        description: "Perfect for testing ideas and hobby projects.",
        features: ["3 Projects", "Community Support", "Basic AI Models", "Public Deployments", "Standard Speed"],
        highlight: false,
        buttonText: "Start for Free"
    },
    {
        name: "Pro",
        price: "$29",
        period: "/mo",
        description: "For professional developers and freelancers.",
        features: ["Unlimited Projects", "Priority Support", "Advanced AI (Gemini 1.5 Pro)", "Code Export", "Private Deployments", "Ghostwriter Pro"],
        highlight: true,
        buttonText: "Get Pro"
    },
    {
        name: "Team",
        price: "$99",
        period: "/mo",
        description: "For collaborative teams building together.",
        features: ["Unlimited Members", "Dedicated Support", "Custom AI Models", "SSO & Audit Logs", "SLA & Uptime Guarantee", "Team Training"],
        highlight: false,
        buttonText: "Contact Sales"
    }
];

const HERO_EXAMPLES = [
    "Create a Terraform script to deploy an EC2 instance.",
    "Build a personal portfolio with a dark theme.",
    "Design a SaaS landing page with a pricing table.",
    "Make a Kanban board with drag and drop.",
    "Create a weather dashboard using a public API."
];

interface HomeProps {
  onStart: (initialCode?: string, prompt?: string) => void;
  onLogin: () => void;
  onSignup: () => void;
  onOpenDocs: () => void;
}

export const Home: React.FC<HomeProps> = ({ onStart, onLogin, onSignup, onOpenDocs }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scrolled, setScrolled] = useState(false);
  
  // Use a ref for the container to apply CSS variables directly (Performance optimization)
  const containerRef = useRef<HTMLDivElement>(null);

  const [heroInput, setHeroInput] = useState("");
  
  // Typing Animation State
  const [placeholderText, setPlaceholderText] = useState("");
  
  // --- SMOOTH SCROLL LERP ENGINE ---
  useEffect(() => {
    let currentScroll = 0;
    let targetScroll = 0;
    let rafId = 0;

    const onScroll = () => {
        targetScroll = window.scrollY;
        setScrolled(window.scrollY > 50);
    };

    const update = () => {
        // Linear Interpolation (Lerp) for smoothness: 0.1 factor
        currentScroll += (targetScroll - currentScroll) * 0.1;
        
        // Optimize: Stop updating if close enough
        if (Math.abs(targetScroll - currentScroll) > 0.1) {
             if (containerRef.current) {
                containerRef.current.style.setProperty('--scroll-y', `${currentScroll}`);
            }
            rafId = requestAnimationFrame(update);
        } else {
            rafId = requestAnimationFrame(update);
        }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    rafId = requestAnimationFrame(update);

    return () => {
        window.removeEventListener('scroll', onScroll);
        cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // --- Typing Effect for Placeholder ---
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let currentIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    const type = () => {
        const currentString = HERO_EXAMPLES[currentIndex];
        
        if (isDeleting) {
            if (charIndex > 0) {
                setPlaceholderText(currentString.substring(0, charIndex - 1));
                charIndex--;
                timeout = setTimeout(type, 30);
            } else {
                isDeleting = false;
                currentIndex = (currentIndex + 1) % HERO_EXAMPLES.length;
                timeout = setTimeout(type, 500);
            }
        } else {
            if (charIndex < currentString.length) {
                setPlaceholderText(currentString.substring(0, charIndex + 1));
                charIndex++;
                timeout = setTimeout(type, 50);
            } else {
                isDeleting = true;
                timeout = setTimeout(type, 2000);
            }
        }
    };

    timeout = setTimeout(type, 100);

    return () => clearTimeout(timeout);
  }, []);

  const handleHeroSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!heroInput.trim()) return;
      onStart(`// Goal: ${heroInput}\n\n// Describe your UI here...`, heroInput);
  };

  const scrollToPricing = () => {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div 
        ref={containerRef}
        className="min-h-screen bg-[#020202] text-white font-sans selection:bg-cyan-500/30 overflow-x-hidden relative perspective-container"
    >
        
        {/* Flashlight Feature Reveal Background */}
        <FlashlightBackground />

        <style>{`
            :root {
                --scroll-y: 0;
            }
            @keyframes scroll {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
            }
            .animate-scroll {
                animation: scroll 40s linear infinite;
            }
            .animate-scroll:hover {
                animation-play-state: paused;
            }
            .perspective-container {
                perspective: 1200px;
                overflow-x: hidden;
            }
            .noise-bg {
                background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
            }
            .card-spotlight-effect::before {
                background: radial-gradient(
                    800px circle at var(--mouse-x) var(--mouse-y), 
                    rgba(255, 255, 255, 0.06),
                    transparent 40%
                );
            }
            .border-spotlight-effect::after {
                background: radial-gradient(
                    600px circle at var(--mouse-x) var(--mouse-y), 
                    rgba(255, 255, 255, 0.4),
                    transparent 40%
                );
            }
            .reveal-up {
                transform: translateY(30px);
                opacity: 0;
                transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .reveal-up.active {
                transform: translateY(0);
                opacity: 1;
            }
            .shimmer-text {
                background: linear-gradient(90deg, #22d3ee 0%, #fff 50%, #c084fc 100%);
                background-size: 200% auto;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                animation: shimmer 5s linear infinite;
            }
            @keyframes shimmer {
                to { background-position: 200% center; }
            }
            
            /* Scroll-Linked Animations */
            .scroll-parallax-bg {
                transform: translateY(calc(var(--scroll-y) * -0.2px));
                will-change: transform;
            }
            .scroll-zoom-text {
                transform: scale(calc(1 + var(--scroll-y) * 0.0005));
                opacity: calc(1 - var(--scroll-y) * 0.002);
                will-change: transform, opacity;
            }
            
            .scroll-footer-text {
                transform: translateX(-50%) translateY(calc(var(--scroll-y) * -0.05px));
                will-change: transform;
            }
            
            /* Feature Animation: Code Typing */
            @keyframes typing {
                0% { width: 0 }
                100% { width: 100% }
            }
            .typing-anim {
                overflow: hidden;
                white-space: nowrap;
                animation: typing 2s steps(20, end) infinite;
            }
            
            /* Feature Animation: Pop In */
            @keyframes popIn {
                0% { transform: scale(0); opacity: 0; }
                80% { transform: scale(1.1); opacity: 1; }
                100% { transform: scale(1); opacity: 1; }
            }
            .pop-in {
                animation: popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            
            /* Feature Animation: Scan */
            @keyframes scan {
                0% { top: 0%; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
            }
            .animate-scan {
                animation: scan 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }

            /* Floating Animation for features */
            @keyframes floatFeature {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }

            /* New Animations */
            @keyframes lockPulse {
                0%, 100% { transform: scale(1); fill: #fff; }
                50% { transform: scale(1.1); fill: #22d3ee; }
            }
            @keyframes connectNodes {
                0% { stroke-dashoffset: 100; opacity: 0.2; }
                50% { opacity: 1; }
                100% { stroke-dashoffset: 0; opacity: 0.2; }
            }
            @keyframes barDance {
                0%, 100% { height: 20%; opacity: 0.5; }
                50% { height: 80%; opacity: 1; }
            }
            .bar-1 { animation: barDance 1s ease-in-out infinite; }
            .bar-2 { animation: barDance 1.2s ease-in-out infinite 0.1s; }
            .bar-3 { animation: barDance 0.8s ease-in-out infinite 0.2s; }
            .bar-4 { animation: barDance 1.1s ease-in-out infinite 0.3s; }

            @keyframes spin-slow {
                to { transform: rotate(360deg); }
            }
            
            @keyframes pulse-scale {
                0%, 100% { transform: scale(1); opacity: 0.6; }
                50% { transform: scale(1.1); opacity: 1; }
            }

            @keyframes check-draw {
                to { stroke-dashoffset: 0; }
            }
            .check-path {
                stroke-dasharray: 20;
                stroke-dashoffset: 20;
                animation: check-draw 0.5s ease-out forwards;
            }

            /* Live Preview Card Keyframes - Revised */
            @keyframes reveal-card {
                0% { opacity: 0; transform: translateY(5px); }
                100% { opacity: 1; transform: translateY(0); }
            }
            .reveal-el {
                opacity: 0;
                animation: reveal-card 0.5s ease-out forwards;
            }
            
            /* Incremental Preview Animations */
            @keyframes pop-in-up {
                0% { opacity: 0; transform: translateY(10px) scale(0.95); }
                100% { opacity: 1; transform: translateY(0) scale(1); }
            }
            .animate-pop-in {
                animation: pop-in-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }

            /* Hero Fade In Up */
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .animate-fade-in-up {
                animation: fadeInUp 0.8s ease-out forwards;
            }
        `}</style>

        {/* --- Global Background Effects --- */}
        <div className="fixed inset-0 z-0 pointer-events-none">
            <div className="absolute inset-0 noise-bg opacity-20 mix-blend-overlay"></div>
            
            {/* Parallax Star/Grid Field */}
            <div 
                className="absolute inset-0 opacity-20 scroll-parallax-bg"
                style={{
                    backgroundImage: 'radial-gradient(1px 1px at 10% 10%, #fff 0%, transparent 100%), radial-gradient(2px 2px at 40% 70%, #fff 0%, transparent 100%), radial-gradient(1px 1px at 80% 20%, #fff 0%, transparent 100%)',
                }}
            />
        </div>

        {/* --- Navbar --- */}
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[#020202]/80 backdrop-blur-xl border-b border-white/5 py-3' : 'py-6 bg-transparent'}`}>
            <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between">
                <div className="flex items-center gap-3 group cursor-pointer" onClick={() => onStart()}>
                     <div className="relative">
                        <div className="absolute inset-0 bg-cyan-500 blur-[40px] opacity-0 group-hover:opacity-40 transition-opacity duration-500"></div>
                        <img 
                            src="https://image2url.com/r2/default/images/1770671775593-5b527895-259d-46ef-9a60-d72b5b2dce9c.png" 
                            alt="Natural Editor" 
                            className="w-24 h-24 sm:w-32 sm:h-32 object-contain relative z-10 mix-blend-screen" 
                        />
                     </div>
                </div>

                {/* Center Navigation Links */}
                <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
                    <button onClick={onOpenDocs} className="text-sm font-medium text-white/60 hover:text-white transition-colors">Docs</button>
                    <button onClick={scrollToPricing} className="text-sm font-medium text-white/60 hover:text-white transition-colors">Pricing</button>
                    <button onClick={() => onStart()} className="text-sm font-medium text-white/60 hover:text-white transition-colors">Blog</button>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-6">
                     <button onClick={onLogin} className="hidden sm:block text-sm font-medium text-white/50 hover:text-white transition-colors">Log In</button>
                     <MagneticButton onClick={onSignup} className="px-6 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-cyan-400 hover:text-black transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(34,211,238,0.5)] transform hover:scale-105">
                        Sign Up
                     </MagneticButton>
                </div>
            </div>
        </nav>

        {/* --- Hero Section --- */}
        <header className="relative z-10 pt-32 pb-20 px-6 flex flex-col items-center justify-center min-h-screen">
            
            {/* Aurora Background with Parallax */}
            <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[700px] bg-gradient-to-b from-cyan-500/10 via-purple-500/10 to-transparent blur-[140px] rounded-full -z-10 animate-pulse-slow"
                style={{ transform: `translate(-50%, calc(var(--scroll-y) * 0.3px))` }}
            />

            <div className="scroll-zoom-text">
                <div className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
                    <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/5 bg-white/[0.02] backdrop-blur-md text-xs font-mono text-cyan-400 mb-12 hover:bg-white/[0.05] hover:border-cyan-500/30 transition-all cursor-default shadow-lg shadow-cyan-900/10 group mx-auto table">
                        <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                        </span>
                        <span className="group-hover:text-cyan-300 transition-colors tracking-widest uppercase font-bold">Write in English. We handle the Code.</span>
                    </div>
                </div>

                <div className="animate-fade-in-up" style={{ animationDelay: '150ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <h1 className="text-7xl md:text-[9.5rem] font-black tracking-tighter text-center mb-10 leading-[0.8] relative z-10 group cursor-default">
                        <span className="block text-white mix-blend-exclusion hover:text-white/90 transition-all duration-700 hover:tracking-normal tracking-tighter">
                            JUST TYPE.
                        </span>
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-purple-400 animate-gradient-x drop-shadow-[0_0_40px_rgba(34,211,238,0.4)]">
                            NOT CODE.
                        </span>
                    </h1>
                </div>

                <div className="animate-fade-in-up" style={{ animationDelay: '300ms', opacity: 0, animationFillMode: 'forwards' }}>
                    <p className="text-xl md:text-3xl text-white/40 max-w-3xl mx-auto text-center mb-20 leading-relaxed font-light">
                        Describe your app in <span className="text-white font-medium hover:text-cyan-400 transition-colors">plain English</span>. Our AI compiles your words into production-ready React applications instantly.
                    </p>
                </div>
            </div>

            {/* --- MASSIVE HERO PROMPT INPUT (REAL EDITOR LOOK) --- */}
            <div className="w-full max-w-4xl mx-auto relative perspective-container z-20">
                <ScrollReveal delay={450}>
                     {/* Gradient Border Wrapper */}
                    <div className="rounded-xl p-[1px] bg-gradient-to-b from-white/20 to-transparent shadow-2xl">
                        <form 
                            onSubmit={handleHeroSubmit} 
                            className="bg-[#1e1e1e] rounded-xl flex flex-col relative overflow-hidden shadow-black/50 shadow-2xl"
                        >
                            {/* Editor Tab Bar */}
                            <div className="flex items-center gap-2 px-4 py-2 bg-[#252526] border-b border-[#333]">
                                <div className="flex gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                                    <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                                </div>
                                <div className="ml-4 px-3 py-1 bg-[#1e1e1e] rounded-t-md text-xs text-white/80 border-t border-blue-500/50 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[14px] text-blue-400">code</span>
                                    prompt.en
                                </div>
                            </div>

                            <div className="flex p-4 min-h-[140px]">
                                {/* Gutter */}
                                <div className="flex flex-col text-right pr-4 text-[#858585] font-mono text-sm select-none border-r border-[#333]">
                                    <div>1</div>
                                    <div>2</div>
                                    <div>3</div>
                                    <div>4</div>
                                </div>

                                {/* Text Area */}
                                <div className="flex-1 relative pl-4">
                                    <textarea 
                                        value={heroInput}
                                        onChange={(e) => setHeroInput(e.target.value)}
                                        onInput={(e) => {
                                            const target = e.target as HTMLTextAreaElement;
                                            target.style.height = 'auto';
                                            target.style.height = target.scrollHeight + 'px';
                                        }}
                                        placeholder={placeholderText}
                                        className="w-full bg-transparent text-lg md:text-xl text-[#d4d4d4] placeholder-[#6a6a6a] font-mono focus:outline-none resize-none custom-scrollbar transition-all leading-relaxed"
                                        style={{ minHeight: '100px' }}
                                    />
                                </div>
                            </div>
                            
                            <div className="px-4 py-3 bg-[#252526] border-t border-[#333] flex justify-between items-center">
                                <div className="flex gap-2">
                                    <span className="text-xs text-[#858585]">UTF-8</span>
                                    <span className="text-xs text-[#858585]">JavaScript React</span>
                                </div>
                                <button 
                                    type="submit"
                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-colors flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                                    Run
                                </button>
                            </div>
                        </form>
                    </div>
                </ScrollReveal>
            </div>

            <div className="mt-24 pointer-events-none opacity-20">
                <span className="material-symbols-outlined animate-bounce text-4xl">keyboard_double_arrow_down</span>
            </div>
        </header>

        {/* --- Gliding Comments (Review's Side) --- */}
        {/* Added z-20 and opaque background to obscure GhostCursor */}
        <section className="py-24 border-y border-white/5 bg-[#050505]/60 backdrop-blur-3xl relative overflow-hidden z-20">
            <div className="absolute inset-0 bg-cyan-500/5 blur-[100px]"></div>
            
            <div className="mb-12 text-center">
                <span className="text-xs font-bold tracking-widest text-white/30 uppercase">Worldwide Praise</span>
            </div>

            <div className="relative w-full overflow-hidden">
                <div className="flex w-max animate-scroll gap-6 px-6">
                    {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
                        <SpotlightCard key={i} className="w-[350px] p-8 rounded-3xl bg-white/[0.03] backdrop-blur-sm flex flex-col gap-6 hover:scale-105 transition-transform duration-500 ease-out cursor-default">
                            <div className="flex text-cyan-400">
                                <span className="material-symbols-outlined text-[18px]">star</span>
                                <span className="material-symbols-outlined text-[18px]">star</span>
                                <span className="material-symbols-outlined text-[18px]">star</span>
                                <span className="material-symbols-outlined text-[18px]">star</span>
                                <span className="material-symbols-outlined text-[18px]">star</span>
                            </div>
                            <p className="text-white/80 text-lg leading-relaxed font-light">"{t.text}"</p>
                            <div className="mt-auto flex items-center gap-3 opacity-50">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-600"></div>
                                <div className="text-sm font-bold tracking-tight">{t.author}</div>
                            </div>
                        </SpotlightCard>
                    ))}
                </div>
                <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-[#020202] to-transparent z-10 pointer-events-none"></div>
                <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-[#020202] to-transparent z-10 pointer-events-none"></div>
            </div>
        </section>

        {/* --- LIVE DEMO SECTION (Replaced Interactive Playground) --- */}
        <section className="py-48 px-6 relative z-10 max-w-7xl mx-auto overflow-hidden">
             <ScrollReveal>
                 <div className="text-center mb-24">
                     <h2 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter">Instant Feedback.</h2>
                     <p className="text-white/40 text-xl md:text-2xl max-w-2xl mx-auto font-light leading-relaxed">
                        Experiment in real-time. Our hybrid compiler transforms instructions into React instantly.
                     </p>
                 </div>
             </ScrollReveal>

             <ScrollReveal delay={200}>
                 <DemoVideo />
             </ScrollReveal>
        </section>

        {/* --- FEATURES GRID (Expanded to 12) --- */}
        <section className="py-32 px-6 relative z-10 max-w-6xl mx-auto">
             <ScrollReveal>
                <div className="text-center mb-24">
                    <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter">
                        Engineered for <span className="shimmer-text">Speed.</span>
                    </h2>
                    <p className="text-white/40 text-lg md:text-xl max-w-2xl mx-auto font-light">
                        Features designed to keep you in the flow.
                    </p>
                </div>
             </ScrollReveal>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* Feature 1: Instant Compile */}
                 <ScrollReveal delay={0}>
                    <SpotlightCard className="min-h-[300px] h-full bg-[#0f0f0f] rounded-[2rem] p-6 flex flex-col border border-white/5 relative overflow-hidden group">
                        <div className="mb-6 z-10">
                            <h3 className="text-xl font-bold text-white mb-2">Instant Compile</h3>
                            <p className="text-white/40 text-sm">Text to functioning UI in milliseconds.</p>
                        </div>
                        
                        {/* Animation: Morphing Lines to Button */}
                        <div className="flex-1 bg-black/50 rounded-xl border border-white/5 relative flex items-center justify-center overflow-hidden min-h-[160px]">
                             <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                {/* Lines that morph */}
                                <div className="w-32 h-2 bg-white/20 rounded-full animate-pulse origin-center transition-all duration-500 group-hover:w-24 group-hover:bg-cyan-500/50"></div>
                                <div className="w-24 h-2 bg-white/20 rounded-full animate-pulse delay-75 origin-center transition-all duration-500 group-hover:w-24 group-hover:bg-cyan-500/50"></div>
                                <div className="w-28 h-2 bg-white/20 rounded-full animate-pulse delay-150 origin-center transition-all duration-500 group-hover:w-24 group-hover:bg-cyan-500/50"></div>
                                
                                {/* Result Button overlay */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-0 group-hover:scale-100">
                                     <div className="px-5 py-2 bg-cyan-500 text-black text-sm font-bold rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.5)]">
                                        Rendered
                                    </div>
                                </div>
                             </div>
                        </div>
                    </SpotlightCard>
                 </ScrollReveal>

                 {/* Feature 2: AI Ghostwriter */}
                 <ScrollReveal delay={100}>
                    <SpotlightCard className="min-h-[300px] h-full bg-[#0f0f0f] rounded-[2rem] p-6 flex flex-col border border-white/5 relative overflow-hidden group">
                        <div className="mb-6 z-10">
                            <h3 className="text-xl font-bold text-white mb-2">AI Ghostwriter</h3>
                            <p className="text-white/40 text-sm">Autocomplete that reads your mind.</p>
                        </div>
                        
                        {/* Animation: Improved Typing Effect */}
                        <div className="flex-1 bg-black/50 rounded-xl border border-white/5 relative p-4 font-mono text-xs text-gray-400 overflow-hidden flex items-center min-h-[160px]">
                             <div className="w-full">
                                <div className="flex mb-2 items-center">
                                    <span className="text-purple-400 mr-2">def</span>
                                    <span className="text-white typing-anim" style={{width: 'auto'}}>component</span>
                                    {/* Blinking Cursor */}
                                    <span className="w-1.5 h-4 bg-cyan-400 animate-pulse ml-0.5"></span>
                                </div>
                                <div className="p-2 bg-gray-900/80 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 backdrop-blur-sm">
                                    <span className="text-[10px] text-gray-500 block mb-1">Copilot:</span>
                                    <span className="text-cyan-200">return &lt;Button /&gt;</span>
                                </div>
                             </div>
                        </div>
                    </SpotlightCard>
                 </ScrollReveal>

                 {/* Feature 3: Live Preview - UPGRADED ANIMATION */}
                 <ScrollReveal delay={200}>
                    <SpotlightCard className="min-h-[300px] h-full bg-[#0f0f0f] rounded-[2rem] p-6 flex flex-col border border-white/5 relative overflow-hidden group">
                        <div className="mb-6 z-10">
                            <h3 className="text-xl font-bold text-white mb-2">Live Preview</h3>
                            <p className="text-white/40 text-sm">See changes as you type.</p>
                        </div>
                        
                        {/* Animation: Simulated Live Building */}
                        <div className="flex-1 bg-black/50 rounded-xl border border-white/5 relative flex items-center justify-center min-h-[160px]">
                             <div className="w-40 h-48 bg-white border-2 border-gray-800 rounded-lg shadow-2xl overflow-hidden flex flex-col transform transition-transform duration-500 group-hover:scale-105 group-hover:-rotate-1 relative">
                                {/* Browser Header */}
                                <div className="h-4 bg-gray-100 border-b border-gray-300 flex items-center gap-1.5 px-2 shrink-0">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                                </div>
                                
                                {/* Browser Content Area */}
                                <div className="flex-1 bg-white p-3 flex flex-col gap-2 relative">
                                    
                                    {/* 1. Header Box */}
                                    <div className="w-full h-8 bg-gray-100 rounded-md animate-[pulse_2s_infinite]">
                                        <div className="w-full h-full bg-blue-500 rounded-md reveal-el" style={{animationDelay: '0.2s'}}></div>
                                    </div>
                                    
                                    {/* 2. Row of boxes */}
                                    <div className="flex gap-2">
                                        <div className="flex-1 h-12 bg-gray-100 rounded-md animate-[pulse_2s_infinite_0.3s]">
                                            <div className="w-full h-full bg-purple-500/20 border border-purple-500 rounded-md reveal-el" style={{animationDelay: '0.6s'}}></div>
                                        </div>
                                        <div className="flex-1 h-12 bg-gray-100 rounded-md animate-[pulse_2s_infinite_0.5s]">
                                            <div className="w-full h-full bg-purple-500/20 border border-purple-500 rounded-md reveal-el" style={{animationDelay: '1s'}}></div>
                                        </div>
                                    </div>
                                    
                                    {/* 3. Button */}
                                    <div className="mt-auto w-full h-6 bg-gray-100 rounded animate-[pulse_2s_infinite_0.8s]">
                                        <div className="w-full h-full bg-black rounded flex items-center justify-center text-[8px] text-white font-bold reveal-el" style={{animationDelay: '1.4s'}}>
                                            DEPLOY
                                        </div>
                                    </div>
                                </div>
                             </div>
                        </div>
                    </SpotlightCard>
                 </ScrollReveal>

                 {/* Feature 4: Intelligent Context */}
                 <ScrollReveal delay={300}>
                    <SpotlightCard className="min-h-[300px] h-full bg-[#0f0f0f] rounded-[2rem] p-6 flex flex-col border border-white/5 relative overflow-hidden group">
                        <div className="mb-6 z-10">
                            <h3 className="text-xl font-bold text-white mb-2">Intelligent Context</h3>
                            <p className="text-white/40 text-sm">Understanding file relationships instantly.</p>
                        </div>
                        
                        {/* Animation: Highlighting Scan */}
                        <div className="flex-1 bg-black/50 rounded-xl border border-white/5 relative flex items-center justify-center min-h-[160px]">
                             <div className="relative w-20 h-24 bg-white/10 rounded-lg border border-white/20 overflow-hidden flex flex-col p-2 gap-2">
                                <div className="h-2 w-3/4 bg-white/20 rounded transition-colors duration-300 group-hover:bg-cyan-500/30"></div>
                                <div className="h-2 w-full bg-white/20 rounded transition-colors duration-300 group-hover:bg-cyan-500/30 delay-75"></div>
                                <div className="h-2 w-5/6 bg-white/20 rounded transition-colors duration-300 group-hover:bg-cyan-500/30 delay-150"></div>
                                <div className="h-2 w-full bg-white/20 rounded transition-colors duration-300 group-hover:bg-cyan-500/30 delay-200"></div>
                                {/* Scanner Beam */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-scan"></div>
                             </div>
                        </div>
                    </SpotlightCard>
                 </ScrollReveal>

                 {/* Feature 5: Version Control */}
                 <ScrollReveal delay={400}>
                    <SpotlightCard className="min-h-[300px] h-full bg-[#0f0f0f] rounded-[2rem] p-6 flex flex-col border border-white/5 relative overflow-hidden group">
                        <div className="mb-6 z-10">
                            <h3 className="text-xl font-bold text-white mb-2">Iterative History</h3>
                            <p className="text-white/40 text-sm">Never lose a creative thought.</p>
                        </div>
                        
                        {/* Animation: Git Branching */}
                        <div className="flex-1 bg-black/50 rounded-xl border border-white/5 relative flex items-center justify-center min-h-[160px]">
                            <div className="flex flex-col gap-3 items-center relative">
                                {/* Main Branch */}
                                <div className="flex items-center gap-3">
                                   <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_10px_cyan] z-10"></div>
                                   <div className="w-16 h-0.5 bg-white/20"></div>
                                   <div className="w-3 h-3 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors"></div>
                                </div>
                                {/* Diverging Branch */}
                                <div className="absolute top-[6px] left-[6px] w-[2px] h-[30px] bg-white/20 origin-top -rotate-45 group-hover:h-[40px] transition-all duration-500"></div>
                                <div className="absolute top-[28px] right-[10px] w-3 h-3 rounded-full bg-purple-500 animate-pulse shadow-[0_0_10px_purple] group-hover:top-[38px] group-hover:right-[2px] transition-all duration-500"></div>
                            </div>
                        </div>
                    </SpotlightCard>
                 </ScrollReveal>

                 {/* Feature 6: Multi-Platform */}
                 <ScrollReveal delay={500}>
                    <SpotlightCard className="min-h-[300px] h-full bg-[#0f0f0f] rounded-[2rem] p-6 flex flex-col border border-white/5 relative overflow-hidden group">
                        <div className="mb-6 z-10">
                            <h3 className="text-xl font-bold text-white mb-2">Multi-Platform</h3>
                            <p className="text-white/40 text-sm">Responsive by default, everywhere.</p>
                        </div>
                        
                        {/* Animation: Morphing Devices */}
                        <div className="flex-1 bg-black/50 rounded-xl border border-white/5 relative flex items-center justify-center min-h-[160px] gap-4">
                             {/* Mobile */}
                             <div className="w-8 h-12 border-2 border-gray-600 rounded-md bg-black relative flex justify-center pt-1 animate-pulse group-hover:border-cyan-500 transition-colors">
                                <div className="w-3 h-0.5 bg-gray-700 rounded-full"></div>
                             </div>
                             {/* Tablet */}
                             <div className="w-16 h-20 border-2 border-gray-500 rounded-lg bg-black relative flex justify-center pt-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                                <div className="w-1 h-1 bg-gray-700 rounded-full"></div>
                             </div>
                             {/* Desktop */}
                             <div className="w-24 h-16 border-b-4 border-gray-400 rounded-t-lg bg-black relative flex justify-center pt-1 opacity-40 group-hover:opacity-80 transition-opacity">
                                <div className="w-full h-full border-x-2 border-t-2 border-gray-400 rounded-t-lg"></div>
                             </div>
                        </div>
                    </SpotlightCard>
                 </ScrollReveal>
                 
                 {/* Feature 7: Secure Cloud */}
                 <ScrollReveal delay={600}>
                    <SpotlightCard className="min-h-[300px] h-full bg-[#0f0f0f] rounded-[2rem] p-6 flex flex-col border border-white/5 relative overflow-hidden group">
                        <div className="mb-6 z-10">
                            <h3 className="text-xl font-bold text-white mb-2">Secure Cloud</h3>
                            <p className="text-white/40 text-sm">Enterprise-grade encryption built-in.</p>
                        </div>
                        
                        {/* Animation: Shield Pulse */}
                        <div className="flex-1 bg-black/50 rounded-xl border border-white/5 relative flex items-center justify-center min-h-[160px]">
                             <div className="relative">
                                {/* Shield Body */}
                                <svg width="60" height="70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/20 group-hover:text-cyan-500 transition-colors duration-500">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                                {/* Lock Icon inside */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white/40 group-hover:text-white transition-colors animate-[lockPulse_2s_ease-in-out_infinite]">
                                        <path d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zm-2.5 0V7a4.5 4.5 0 10-9 0v4h9z" />
                                    </svg>
                                </div>
                             </div>
                        </div>
                    </SpotlightCard>
                 </ScrollReveal>

                 {/* Feature 8: Team Sync */}
                 <ScrollReveal delay={700}>
                    <SpotlightCard className="min-h-[300px] h-full bg-[#0f0f0f] rounded-[2rem] p-6 flex flex-col border border-white/5 relative overflow-hidden group">
                        <div className="mb-6 z-10">
                            <h3 className="text-xl font-bold text-white mb-2">Team Sync</h3>
                            <p className="text-white/40 text-sm">Collaborate in real-time, effortlessly.</p>
                        </div>
                        
                        {/* Animation: Connecting Nodes */}
                        <div className="flex-1 bg-black/50 rounded-xl border border-white/5 relative flex items-center justify-center min-h-[160px]">
                             <div className="relative w-32 h-20">
                                 {/* Node 1 */}
                                 <div className="absolute top-0 left-0 w-4 h-4 rounded-full bg-cyan-500 shadow-[0_0_10px_cyan] z-10"></div>
                                 {/* Node 2 */}
                                 <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-purple-500 shadow-[0_0_10px_purple]"></div>
                                 {/* Node 3 */}
                                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_10px_white]"></div>
                                 
                                 {/* Connections */}
                                 <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                     <line x1="8" y1="8" x2="64" y2="40" stroke="white" strokeWidth="2" strokeDasharray="5" className="animate-[connectNodes_1.5s_linear_infinite]" />
                                     <line x1="64" y1="40" x2="120" y2="72" stroke="white" strokeWidth="2" strokeDasharray="5" className="animate-[connectNodes_1.5s_linear_infinite_0.5s]" />
                                 </svg>
                             </div>
                        </div>
                    </SpotlightCard>
                 </ScrollReveal>

                 {/* Feature 9: Live Analytics (Enhanced) */}
                 <ScrollReveal delay={800}>
                    <SpotlightCard className="min-h-[300px] h-full bg-[#0f0f0f] rounded-[2rem] p-6 flex flex-col border border-white/5 relative overflow-hidden group">
                        <div className="mb-6 z-10">
                            <h3 className="text-xl font-bold text-white mb-2">Live Analytics</h3>
                            <p className="text-white/40 text-sm">Visualize performance as you build.</p>
                        </div>
                        
                        {/* Animation: Line Chart */}
                        <div className="flex-1 bg-black/50 rounded-xl border border-white/5 relative flex items-center justify-center min-h-[160px] overflow-hidden">
                             {/* Grid Lines */}
                             <div className="absolute inset-0 opacity-20" style={{ 
                                 backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', 
                                 backgroundSize: '20px 20px' 
                             }}></div>

                             {/* Chart Container */}
                             <div className="relative w-full h-24 mx-4">
                                 <svg viewBox="0 0 200 100" className="w-full h-full overflow-visible">
                                     <defs>
                                         <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
                                             <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.4"/>
                                             <stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/>
                                         </linearGradient>
                                     </defs>
                                     {/* Area */}
                                     <path d="M0,100 L0,60 Q20,50 40,70 T80,60 T120,40 T160,50 T200,20 V100 Z" fill="url(#analyticsGradient)" />
                                     {/* Line */}
                                     <path d="M0,60 Q20,50 40,70 T80,60 T120,40 T160,50 T200,20" fill="none" stroke="#22d3ee" strokeWidth="2" className="check-path" style={{ strokeDasharray: 300, strokeDashoffset: 300, animationDuration: '3s', animationIterationCount: 'infinite' }} />
                                     
                                     {/* Points */}
                                     <circle cx="0" cy="60" r="3" fill="#fff" className="animate-pulse" />
                                     <circle cx="40" cy="70" r="3" fill="#fff" className="animate-pulse" style={{ animationDelay: '0.2s' }} />
                                     <circle cx="80" cy="60" r="3" fill="#fff" className="animate-pulse" style={{ animationDelay: '0.4s' }} />
                                     <circle cx="120" cy="40" r="3" fill="#fff" className="animate-pulse" style={{ animationDelay: '0.6s' }} />
                                     <circle cx="160" cy="50" r="3" fill="#fff" className="animate-pulse" style={{ animationDelay: '0.8s' }} />
                                     <circle cx="200" cy="20" r="3" fill="#fff" className="animate-pulse" style={{ animationDelay: '1s' }} />
                                 </svg>

                                 {/* Floating Label */}
                                 <div className="absolute top-0 right-0 -mt-6 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
                                     <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
                                     98.4% Uptime
                                 </div>
                             </div>
                        </div>
                    </SpotlightCard>
                 </ScrollReveal>

                 {/* Feature 10: Global CDN (New) */}
                 <ScrollReveal delay={900}>
                    <SpotlightCard className="min-h-[300px] h-full bg-[#0f0f0f] rounded-[2rem] p-6 flex flex-col border border-white/5 relative overflow-hidden group">
                        <div className="mb-6 z-10">
                            <h3 className="text-xl font-bold text-white mb-2">Global CDN</h3>
                            <p className="text-white/40 text-sm">Deploy to the edge instantly.</p>
                        </div>
                        
                        {/* Animation: Spinning Globe */}
                        <div className="flex-1 bg-black/50 rounded-xl border border-white/5 relative flex items-center justify-center min-h-[160px]">
                             <div className="w-24 h-24 rounded-full border border-white/20 relative animate-[spin-slow_8s_linear_infinite] overflow-hidden">
                                 <div className="absolute inset-0 border border-cyan-500/30 rounded-full" style={{ transform: 'rotateX(60deg)' }}></div>
                                 <div className="absolute inset-0 border border-purple-500/30 rounded-full" style={{ transform: 'rotateY(60deg)' }}></div>
                                 <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-white rounded-full shadow-[0_0_10px_white] -translate-x-1/2 -translate-y-1/2"></div>
                             </div>
                        </div>
                    </SpotlightCard>
                 </ScrollReveal>

                 {/* Feature 11: Real-time DB (New) */}
                 <ScrollReveal delay={1000}>
                    <SpotlightCard className="min-h-[300px] h-full bg-[#0f0f0f] rounded-[2rem] p-6 flex flex-col border border-white/5 relative overflow-hidden group">
                        <div className="mb-6 z-10">
                            <h3 className="text-xl font-bold text-white mb-2">Real-time DB</h3>
                            <p className="text-white/40 text-sm">Instant data syncing across clients.</p>
                        </div>
                        
                        {/* Animation: Pulsing Database */}
                        <div className="flex-1 bg-black/50 rounded-xl border border-white/5 relative flex items-center justify-center min-h-[160px]">
                             <div className="flex flex-col gap-1.5 animate-[pulse-scale_2s_ease-in-out_infinite]">
                                 <div className="w-20 h-6 border border-cyan-500/50 rounded-[100%] bg-cyan-900/20 shadow-[0_0_5px_cyan] relative"></div>
                                 <div className="w-20 h-6 border border-cyan-500/50 rounded-[100%] bg-cyan-900/20 shadow-[0_0_5px_cyan] -mt-3"></div>
                                 <div className="w-20 h-6 border border-cyan-500/50 rounded-[100%] bg-cyan-900/20 shadow-[0_0_5px_cyan] -mt-3"></div>
                             </div>
                        </div>
                    </SpotlightCard>
                 </ScrollReveal>

                 {/* Feature 12: Automated Tests (New) */}
                 <ScrollReveal delay={1100}>
                    <SpotlightCard className="min-h-[300px] h-full bg-[#0f0f0f] rounded-[2rem] p-6 flex flex-col border border-white/5 relative overflow-hidden group">
                        <div className="mb-6 z-10">
                            <h3 className="text-xl font-bold text-white mb-2">Automated Tests</h3>
                            <p className="text-white/40 text-sm">Guaranteed stability with every build.</p>
                        </div>
                        
                        {/* Animation: Checkmarks */}
                        <div className="flex-1 bg-black/50 rounded-xl border border-white/5 relative flex flex-col items-center justify-center min-h-[160px] gap-3">
                             <div className="flex items-center gap-3 w-3/4">
                                 <div className="w-5 h-5 rounded-full border border-green-500/50 flex items-center justify-center bg-green-900/20">
                                     <svg viewBox="0 0 24 24" className="w-3 h-3 text-green-400 stroke-current stroke-2 fill-none check-path"><path d="M20 6L9 17l-5-5" /></svg>
                                 </div>
                                 <div className="h-2 w-full bg-white/10 rounded"></div>
                             </div>
                             <div className="flex items-center gap-3 w-3/4 opacity-60">
                                 <div className="w-5 h-5 rounded-full border border-green-500/50 flex items-center justify-center bg-green-900/20">
                                     <svg viewBox="0 0 24 24" className="w-3 h-3 text-green-400 stroke-current stroke-2 fill-none check-path" style={{animationDelay: '0.2s'}}><path d="M20 6L9 17l-5-5" /></svg>
                                 </div>
                                 <div className="h-2 w-full bg-white/10 rounded"></div>
                             </div>
                             <div className="flex items-center gap-3 w-3/4 opacity-30">
                                 <div className="w-5 h-5 rounded-full border border-green-500/50 flex items-center justify-center bg-green-900/20">
                                     <svg viewBox="0 0 24 24" className="w-3 h-3 text-green-400 stroke-current stroke-2 fill-none check-path" style={{animationDelay: '0.4s'}}><path d="M20 6L9 17l-5-5" /></svg>
                                 </div>
                                 <div className="h-2 w-full bg-white/10 rounded"></div>
                             </div>
                        </div>
                    </SpotlightCard>
                 </ScrollReveal>
             </div>
        </section>

        {/* --- PRICING SECTION --- */}
        <section id="pricing" className="py-32 px-6 relative z-10 max-w-7xl mx-auto border-t border-white/5">
             <ScrollReveal>
                <div className="text-center mb-24">
                    <h2 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter">
                        Simple <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">Pricing.</span>
                    </h2>
                    <p className="text-white/40 text-lg md:text-xl max-w-2xl mx-auto font-light">
                        Start for free, scale when you're ready. No hidden fees.
                    </p>
                </div>
             </ScrollReveal>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                 {PRICING_PLANS.map((plan, i) => (
                     <ScrollReveal key={plan.name} delay={i * 150}>
                        <div className={`relative group ${plan.highlight ? 'z-10 scale-105' : ''}`}>
                            {plan.highlight && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold uppercase tracking-widest rounded-full shadow-[0_0_20px_rgba(34,211,238,0.5)] z-20 whitespace-nowrap">
                                    Most Popular
                                </div>
                            )}
                            
                            <SpotlightCard className={`relative flex flex-col p-8 rounded-[2.5rem] bg-[#0A0A0A] border transition-all duration-300 h-full ${plan.highlight ? 'border-cyan-500/30 shadow-[0_0_50px_rgba(34,211,238,0.1)]' : 'border-white/10 hover:border-white/20'}`}>
                                <div className="mb-8">
                                    <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                                    <div className="flex items-baseline gap-1 mb-4">
                                        <span className="text-5xl font-black text-white tracking-tighter">{plan.price}</span>
                                        <span className="text-white/40 font-medium">{plan.period}</span>
                                    </div>
                                    <p className="text-white/50 text-sm leading-relaxed">{plan.description}</p>
                                </div>

                                <ul className="space-y-4 mb-8 flex-1">
                                    {plan.features.map((feature, fIndex) => (
                                        <li key={fIndex} className="flex items-center gap-3 text-sm text-white/80">
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${plan.highlight ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/10 text-white/60'}`}>
                                                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-none stroke-current stroke-2"><path d="M20 6L9 17l-5-5" /></svg>
                                            </div>
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <button 
                                    onClick={onSignup}
                                    className={`w-full py-4 rounded-xl font-bold transition-all duration-300 ${plan.highlight ? 'bg-white text-black hover:bg-cyan-50 shadow-lg hover:shadow-cyan-500/25' : 'bg-white/5 text-white hover:bg-white/10'}`}
                                >
                                    {plan.buttonText}
                                </button>
                            </SpotlightCard>
                        </div>
                     </ScrollReveal>
                 ))}
             </div>
        </section>

        {/* --- FAQ SECTION (Q/A Part) --- */}
        {/* Wrapped content in a full-width container with background to obscure GhostCursor */}
        <section className="py-32 bg-[#020202]/60 backdrop-blur-3xl relative z-20 border-t border-white/5">
            <div className="max-w-4xl mx-auto px-6">
                <ScrollReveal>
                    <div className="mb-16 text-center">
                        <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter">
                            Frequently Asked
                        </h2>
                        <p className="text-white/40 text-lg">Everything you need to know about the engine.</p>
                    </div>
                </ScrollReveal>
                
                <div className="space-y-4">
                    {FAQS.map((faq, i) => (
                        <ScrollReveal key={i} delay={i * 100}>
                            <FAQItem question={faq.q} answer={faq.a} />
                        </ScrollReveal>
                    ))}
                </div>
            </div>
        </section>

        {/* --- Footer (Big) --- */}
        <footer className="py-48 bg-black/60 backdrop-blur-3xl text-center relative z-10 border-t border-white/10 overflow-hidden">
             <div 
                className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 text-[20rem] font-black text-white/[0.02] whitespace-nowrap pointer-events-none select-none scroll-footer-text"
             >
                NATURAL
             </div>

             <div className="max-w-4xl mx-auto px-6 relative z-10">
                <h3 className="text-6xl md:text-[8rem] font-black mb-12 tracking-tighter leading-none">
                    Ready to<br/>
                    evolve?
                </h3>
                <p className="text-2xl text-white/30 mb-20 max-w-lg mx-auto font-light">
                    The code is writing itself. All we need is your imagination.
                </p>
                
                <MagneticButton 
                    onClick={onSignup}
                    className="group relative inline-flex items-center justify-center px-16 py-8 font-black text-black transition-all duration-300 bg-white text-2xl rounded-[2rem] hover:bg-cyan-400 hover:scale-110 shadow-[0_40px_80px_rgba(255,255,255,0.1)]"
                >
                    <span className="relative flex items-center gap-4">
                        GET STARTED FREE
                        <span className="material-symbols-outlined text-3xl group-hover:translate-x-3 transition-transform">rocket_launch</span>
                    </span>
                </MagneticButton>

                <div className="mt-40 flex flex-col md:flex-row justify-between items-center text-xs font-bold tracking-[0.2em] text-white/20 gap-8 uppercase">
                    <div className="flex gap-12">
                        <a href="#" className="hover:text-white transition-colors">Twitter</a>
                        <a href="#" className="hover:text-white transition-colors">GitHub</a>
                        <a href="#" className="hover:text-white transition-colors">Lab</a>
                    </div>
                    <div>&copy; 2026 NATURAL CODE SYSTEMS</div>
                </div>
             </div>
        </footer>
    </div>
  );
};
