import React, { useEffect, useMemo, useRef } from 'react';

interface PreviewProps {
  htmlContent: string;
  isLoading: boolean;
  isSelectionMode: boolean;
  viewMode: 'mobile' | 'desktop';
  onElementSelect: (element: { tagName: string, text: string }) => void;
}

const INSPECTOR_SCRIPT = `
<script>
(function() {
  let active = false;
  let hoveredElement = null;
  let originalOutline = '';

  window.addEventListener('message', (e) => {
    if (e.data.type === 'TOGGLE_SELECTION_MODE') {
      active = e.data.payload;
      if (!active && hoveredElement) {
         hoveredElement.style.outline = originalOutline;
         hoveredElement = null;
      }
    }
  });

  document.addEventListener('mouseover', (e) => {
    if (!active) return;
    if (e.target === document.body || e.target === document.documentElement) return;
    
    if (hoveredElement && hoveredElement !== e.target) {
        hoveredElement.style.outline = originalOutline;
    }
    
    hoveredElement = e.target;
    originalOutline = hoveredElement.style.outline;
    
    e.target.style.outline = '2px solid #3b82f6';
    e.target.style.cursor = 'crosshair';
    e.stopPropagation();
  });

  document.addEventListener('mouseout', (e) => {
    if (!active) return;
    if (e.target === document.body || e.target === document.documentElement) return;
    e.target.style.outline = originalOutline;
  });

  document.addEventListener('click', (e) => {
    if (!active) return;
    if (e.target === document.body || e.target === document.documentElement) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const element = e.target;
    const context = {
      tagName: element.tagName.toLowerCase(),
      text: element.innerText ? element.innerText.substring(0, 100) : '',
    };
    
    // Reset style before sending
    element.style.outline = originalOutline;
    hoveredElement = null;
    
    window.parent.postMessage({ type: 'ELEMENT_SELECTED', payload: context }, '*');
  }, true);
})();
</script>
`;

const injectInspectorScript = (html: string) => {
  const source = html || '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>';
  if (/<\/body>/i.test(source)) {
    return source.replace(/<\/body>/i, `${INSPECTOR_SCRIPT}</body>`);
  }
  return `${source}\n${INSPECTOR_SCRIPT}`;
};

export const Preview: React.FC<PreviewProps> = ({ htmlContent, isLoading, isSelectionMode, viewMode, onElementSelect }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const frameSrcDoc = useMemo(() => {
    const base = htmlContent || '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>';
    return isSelectionMode ? injectInspectorScript(base) : base;
  }, [htmlContent, isSelectionMode]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === 'ELEMENT_SELECTED') {
            onElementSelect(event.data.payload);
        }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelect]);

  // Toggle selection mode in the iframe
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ 
            type: 'TOGGLE_SELECTION_MODE', 
            payload: isSelectionMode 
        }, '*');
    }
  }, [isSelectionMode]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#050505] p-6 overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      
      {viewMode === 'mobile' ? (
        /* Mobile Frame */
        <div className="relative w-[320px] h-[640px] bg-white rounded-[32px] preview-shadow border-[8px] border-gray-800 overflow-hidden flex flex-col z-10">
            {/* Status Bar */}
            <div className="h-7 bg-gray-100 flex items-center justify-between px-5 shrink-0 border-b border-gray-200">
            <span className="text-[10px] font-bold text-black">9:41</span>
            <div className="flex gap-1.5 items-center">
                <div className="flex items-end gap-[1px]">
                <div className="w-[3px] h-[4px] bg-black"></div>
                <div className="w-[3px] h-[6px] bg-black"></div>
                <div className="w-[3px] h-[8px] bg-black"></div>
                </div>
                <div className="w-3 h-3 rounded-full border border-black flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                </div>
            </div>
            </div>

            <div className="flex-1 relative bg-white w-full h-full overflow-hidden">
                {isLoading && (
                <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-gray-500 font-medium text-xs animate-pulse">Building...</p>
                </div>
                )}
                <iframe
                ref={iframeRef}
                title="App Preview"
                className="w-full h-full border-none"
                srcDoc={frameSrcDoc}
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                />
                
                {isSelectionMode && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-medium z-20 pointer-events-none animate-in fade-in slide-in-from-top-2 whitespace-nowrap">
                        Select element to edit
                    </div>
                )}
            </div>

            {/* Home Indicator */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-24 h-1 bg-black/20 rounded-full"></div>
        </div>
      ) : (
        /* Desktop Frame */
        <div className="relative w-full h-full max-w-4xl max-h-[800px] bg-white rounded-lg preview-shadow border border-gray-800 overflow-hidden flex flex-col z-10">
             {/* Browser Toolbar */}
             <div className="h-8 bg-[#f3f4f6] flex items-center px-3 gap-2 border-b border-gray-300">
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]"></div>
                    <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]"></div>
                </div>
                <div className="flex-1 flex justify-center px-4">
                    <div className="w-full max-w-md h-5 bg-white rounded-sm border border-gray-300 flex items-center justify-center">
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[10px]">lock</span>
                            {typeof window !== 'undefined' ? window.location.host : 'preview.local'}
                        </span>
                    </div>
                </div>
             </div>
             
             <div className="flex-1 relative bg-white w-full h-full overflow-hidden">
                {isLoading && (
                <div className="absolute inset-0 z-10 bg-white/90 backdrop-blur-sm flex items-center justify-center flex-col gap-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-gray-500 font-medium text-xs animate-pulse">Building...</p>
                </div>
                )}
                <iframe
                ref={iframeRef}
                title="App Preview"
                className="w-full h-full border-none"
                srcDoc={frameSrcDoc}
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                />
                
                {isSelectionMode && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-accent text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-medium z-20 pointer-events-none animate-in fade-in slide-in-from-top-2 whitespace-nowrap">
                        Select element to edit
                    </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};
