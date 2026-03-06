import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

export type MarkdownTextProps = {
  content: string;
  className?: string;
};

export function MarkdownText({ content, className }: MarkdownTextProps) {
  const classes = ['markdown-content'];

  if (className) {
    classes.push(className);
  }

  return (
    <div className={classes.join(' ')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ href, ...props }) => {
            const isExternal = !!href && /^https?:\/\//i.test(href);
            return <a {...props} href={href} target={isExternal ? '_blank' : undefined} rel={isExternal ? 'noreferrer' : undefined} />;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}