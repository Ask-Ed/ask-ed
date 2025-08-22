"use client";

import { useMemo } from "react";
import { Hash, Quote } from "lucide-react";
import { useSmoothText, type UIMessage } from "@convex-dev/agent/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageContentProps {
  message: UIMessage;
}

export function MessageContent({ message }: MessageContentProps) {
  const [visibleText] = useSmoothText(message.text, {
    startStreaming: message.status === "streaming",
  });

  // Extract tags from text content
  const { tags, cleanContent } = useMemo(() => {
    const lines = visibleText.split('\n');
    const extractedTags: Array<{type: 'section' | 'quote', content: string}> = [];
    let contentStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('[Referenced Section:') && line.endsWith(']')) {
        const sectionName = line.replace('[Referenced Section: ', '').replace(']', '');
        extractedTags.push({ type: 'section', content: sectionName });
        contentStartIndex = i + 1;
      } else if (line.startsWith('[Referenced Quote:') && line.endsWith(']')) {
        const quote = line.replace('[Referenced Quote: "', '').replace('"]', '');
        extractedTags.push({ type: 'quote', content: quote });
        contentStartIndex = i + 1;
      } else if (line.trim() === '') {
        if (extractedTags.length > 0 && contentStartIndex === i) {
          contentStartIndex = i + 1;
        }
      } else {
        break;
      }
    }

    return {
      tags: extractedTags,
      cleanContent: lines.slice(contentStartIndex).join('\n').trim()
    };
  }, [visibleText]);

  // Tool parts
  const toolParts = useMemo(() => {
    return message.parts?.filter(part => part.type.startsWith('tool-')) || [];
  }, [message.parts]);

  return (
    <div className="max-w-full text-sm text-foreground">
      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tags.map((tag) => (
            <div
              key={`${tag.type}-${tag.content.substring(0, 20)}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-brand-primary/10 text-brand-primary rounded-md border border-brand-primary/30"
            >
              {tag.type === 'section' ? <Hash className="h-3 w-3" /> : <Quote className="h-3 w-3" />}
              <span className="font-medium">
                {tag.type === 'quote' && tag.content.length > 30 
                  ? `${tag.content.substring(0, 27)}...`
                  : tag.content
                }
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Tool calls */}
      {toolParts.length > 0 && (
        <div className="space-y-2 mb-3">
          {toolParts.map((part, index) => (
            <div key={index} className="border border-border/50 rounded-lg p-3 bg-muted/30">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                Tool: {part.type.replace('tool-', '')}
              </div>
              <div className="text-xs bg-muted p-2 rounded border overflow-x-auto">
                <pre className="whitespace-pre-wrap">{JSON.stringify(part, null, 2)}</pre>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Content */}
      <div className="leading-relaxed max-w-none" style={{ userSelect: "text" }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => (
              <p className="text-sm leading-6 mb-2 last:mb-0 text-foreground">{children}</p>
            ),
            code: ({ className, children }) => {
              const isInline = !className;
              if (isInline) {
                return (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground border">
                    {children}
                  </code>
                );
              }
              return (
                <pre className="bg-muted p-3 rounded-md overflow-x-auto my-3 border">
                  <code className="text-xs font-mono text-foreground block">{children}</code>
                </pre>
              );
            },
            ul: ({ children }) => (
              <ul className="list-disc pl-6 space-y-1 my-2 text-foreground">{children}</ul>
            ),
            li: ({ children }) => (
              <li className="text-sm text-foreground">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
          }}
        >
          {cleanContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}