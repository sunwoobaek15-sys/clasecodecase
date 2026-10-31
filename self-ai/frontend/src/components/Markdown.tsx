// Minimal, safe Markdown renderer (no HTML injection: everything becomes React text nodes).
import React from "react";

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[(?:S|M|K)\d+\]|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="rounded bg-panel-2 px-1 py-0.5 font-mono text-[0.85em]">{tok.slice(1, -1)}</code>);
    else if (m[2]) {
      const label = tok.slice(1, tok.indexOf("]("));
      out.push(<a key={k} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{label}</a>);
    } else out.push(<span key={k} className="mx-0.5 rounded bg-accent-soft px-1 text-[0.8em] font-medium text-accent">{tok.slice(1, -1)}</span>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = (text || "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;
  const flush = (i: number) => {
    if (list) {
      const Tag = list.ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={`l${i}`} className={`my-2 space-y-1 pl-5 ${list.ordered ? "list-decimal" : "list-disc"}`}>
          {list.items.map((it, j) => <li key={j}>{inline(it, `l${i}-${j}`)}</li>)}
        </Tag>,
      );
      list = null;
    }
  };
  lines.forEach((raw, i) => {
    const line = raw.replace(/\s+$/, "");
    if (line.startsWith("```")) {
      if (code) {
        blocks.push(<pre key={`c${i}`} className="my-2 overflow-x-auto rounded-lg bg-panel-2 p-3 font-mono text-xs">{code.join("\n")}</pre>);
        code = null;
      } else {
        flush(i);
        code = [];
      }
      return;
    }
    if (code) {
      code.push(raw);
      return;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (h) {
      flush(i);
      const size = ["text-lg", "text-base", "text-sm", "text-sm"][h[1].length - 1];
      blocks.push(<div key={i} className={`${size} mb-1 mt-3 font-semibold first:mt-0`}>{inline(h[2], `h${i}`)}</div>);
    } else if (ul || ol) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) {
        flush(i);
        list = { ordered, items: [] };
      }
      list.items.push((ul || ol)![1]);
    } else if (line.startsWith(">")) {
      flush(i);
      blocks.push(<blockquote key={i} className="my-2 border-l-2 border-warn/60 pl-3 text-muted">{inline(line.replace(/^>\s?/, ""), `q${i}`)}</blockquote>);
    } else if (!line.trim()) {
      flush(i);
    } else {
      flush(i);
      blocks.push(<p key={i} className="my-1.5 leading-relaxed">{inline(line, `p${i}`)}</p>);
    }
  });
  flush(lines.length);
  if (code) blocks.push(<pre key="cend" className="my-2 overflow-x-auto rounded-lg bg-panel-2 p-3 font-mono text-xs">{(code as string[]).join("\n")}</pre>);
  return <div className="break-words text-sm">{blocks}</div>;
}
