import React, { useEffect, useMemo, useRef } from 'react';

interface PreviewPanelProps {
  html: string;
  selectedElementLine: number | null;
  onSelectElement: (payload: { selector: string; snippet: string; line: number | null }) => void;
}

const buildPreviewDoc = (html: string) => {
  const script = `
    <script>
      (function() {
        const selectorOf = (el) => {
          if (!el) return '';
          if (el.id) return '#' + el.id;
          const cls = (el.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0,2).join('.');
          if (cls) return el.tagName.toLowerCase() + '.' + cls;
          return el.tagName.toLowerCase();
        };

        document.addEventListener('click', function(e) {
          const target = e.target;
          if (!target) return;
          e.preventDefault();
          e.stopPropagation();
          const snippet = (target.outerHTML || '').split('\n')[0].slice(0, 180);
          window.parent.postMessage({
            source: 'natural-preview-select',
            selector: selectorOf(target),
            snippet
          }, '*');
        }, true);
      })();
    </script>
  `;

  if (html.includes('</body>')) {
    return html.replace('</body>', `${script}</body>`);
  }
  return `${html}\n${script}`;
};

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ html, selectedElementLine, onSelectElement }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const doc = useMemo(() => buildPreviewDoc(html), [html]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (!event.data || event.data.source !== 'natural-preview-select') return;
      onSelectElement({
        selector: event.data.selector || '',
        snippet: event.data.snippet || '',
        line: selectedElementLine
      });
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [onSelectElement, selectedElementLine]);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    const frameDoc = frame.contentDocument;
    if (!frameDoc) return;
    frameDoc.open();
    frameDoc.write(doc);
    frameDoc.close();
  }, [doc]);

  return (
    <section className="rounded-xl border border-[#2b3035] bg-[#111316] shadow-sm overflow-hidden h-full flex flex-col">
      <div className="h-10 px-3 border-b border-[#2b3035] flex items-center justify-between">
        <span className="text-sm font-semibold text-[#e6edf3]">Live Preview</span>
        <span className="text-[11px] text-[#8d96a0]">Click an element to inspect</span>
      </div>
      <div className="flex-1 bg-[#0b0d0f]">
        <iframe ref={iframeRef} title="preview" className="w-full h-full border-0 bg-[#111316]" sandbox="allow-scripts allow-same-origin allow-forms" />
      </div>
    </section>
  );
};
