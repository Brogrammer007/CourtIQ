import { Helmet } from 'react-helmet-async';

const SITE = 'https://nbacourtiq.org';
const DEFAULT_OG = `${SITE}/og-image.png`;

/**
 * Per-page SEO. Renders <title>, meta description/keywords, canonical,
 * Open Graph and Twitter tags, plus optional JSON-LD.
 *
 * @param {object} p
 * @param {string} p.title        Full page title (shown in SERP + browser tab)
 * @param {string} p.description  ~150–160 chars max, shown in SERP snippet
 * @param {string} [p.path]       Path starting with "/" — used to build canonical & og:url
 * @param {string} [p.image]      Absolute URL for og:image / twitter:image
 * @param {string} [p.type]       "website" | "article" | "profile"
 * @param {object|Array} [p.jsonLd] Structured data object(s) injected as JSON-LD
 * @param {boolean} [p.noIndex]   Set true to hide this page from search engines
 */
export default function Seo({
  title,
  description,
  path = '/',
  image = DEFAULT_OG,
  type = 'website',
  jsonLd,
  noIndex = false,
}) {
  const url = `${SITE}${path}`;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD structured data */}
      {ldArray.map((obj, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(obj)}
        </script>
      ))}
    </Helmet>
  );
}
