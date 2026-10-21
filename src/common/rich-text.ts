import * as sanitizeHtml from 'sanitize-html';

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    's',
    'u',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'a',
  ],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
    }),
  },
};

export function sanitizeRichText(content: string) {
  const html = sanitizeHtml(content, sanitizeOptions).replace(
    /(<p>\s*(<br\s*\/?>)?\s*<\/p>\s*)+$/,
    '',
  );
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });

  return { html, empty: !text.trim() };
}
