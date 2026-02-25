import React from 'react';

interface CodeServerEmbedProps {
  url?: string;
}

export const CodeServerEmbed: React.FC<CodeServerEmbedProps> = ({ url }) => {
  const resolved = (url || '').trim() || 'http://localhost:8080/?folder=/workspace';

  if (!resolved.startsWith('http://') && !resolved.startsWith('https://')) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#0f1113] text-[#d2d9e0] p-6">
        <div className="max-w-xl rounded-xl border border-[#2b3035] bg-[#111316] p-5">
          <div className="text-lg font-semibold mb-2">Code Server URL is invalid</div>
          <div className="text-sm text-[#8d96a0] mb-3">
            Set <code className="text-[#e6edf3]">VITE_CODE_SERVER_URL</code> to your code-server URL.
          </div>
          <div className="text-xs text-[#8d96a0] space-y-1">
            <div>Example:</div>
            <div><code className="text-[#9dc4ff]">VITE_CODE_SERVER_URL=http://localhost:8080/?folder=/workspace</code></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#0f1113]">
      <iframe
        title="Code Server"
        src={resolved}
        className="w-full h-full border-0"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-modals"
      />
    </div>
  );
};
