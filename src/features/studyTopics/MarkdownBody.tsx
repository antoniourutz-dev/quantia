import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { rehypeStudyBlocks, resolveStudyLink, sanitizeSchema } from './markdown';

const components = {
  a: ({ href, children, node, ...rest }: { href?: string; children?: React.ReactNode; node?: unknown }) => {
    void node;
    const target = resolveStudyLink(href);
    if (target.type === 'external') {
      return (
        <a {...rest} href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }
    if (target.type === 'none') return <span>{children}</span>;
    return (
      <a {...rest} href={href} data-study-link="true">
        {children}
      </a>
    );
  },
  table: ({ children, node, ...rest }: { children?: React.ReactNode; node?: unknown }) => {
    void node;
    return (
      <div className="study-table-wrap">
        <table {...rest}>{children}</table>
      </div>
    );
  },
};

/**
 * Renders one immutable document version. It is memoised on `body` so React never re-renders
 * it while the reader adds or removes highlight marks directly in the DOM.
 */
const MarkdownBody = memo(function MarkdownBody({ body }: { body: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeStudyBlocks]}
      components={components}
    >
      {body}
    </ReactMarkdown>
  );
});

export default MarkdownBody;
