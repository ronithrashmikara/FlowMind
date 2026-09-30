'use client';

import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { prepareMarkdown } from '@/lib/markdown';

export default function Markdown({ text, onCite, max }: { text: string; onCite?: (n: number) => void; max?: number }) {
  return (
    <div className="prose-fm text-[0.925rem] text-ink-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          a: ({ href, children }) => {
            const n = href?.startsWith('#cite-') ? Number(href.slice(6)) : NaN;
            if (Number.isFinite(n)) {
              const valid = !max || n <= max;
              return (
                <button
                  type="button"
                  onClick={() => valid && onCite?.(n)}
                  className={`mx-0.5 inline-flex h-[1.15rem] min-w-[1.15rem] -translate-y-px items-center justify-center rounded-md px-1 align-middle text-[0.68rem] font-semibold ${valid ? 'bg-accent-soft text-accent hover:bg-accent hover:text-accent-ink' : 'bg-panel-2 text-ink-3'}`}
                  title={valid ? `Open source passage ${n}` : 'Citation not available'}
                >
                  {n}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer" className="text-accent underline">
                {children}
              </a>
            );
          },
        }}
      >
        {prepareMarkdown(text)}
      </ReactMarkdown>
    </div>
  );
}
