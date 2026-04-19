import Seo from '../components/Seo.jsx';
import Hero from '../sections/Hero.jsx';
import Features from '../sections/Features.jsx';
import Preview from '../sections/Preview.jsx';
import CTA from '../sections/CTA.jsx';

const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CourtIQ',
  url: 'https://nbacourtiq.org',
  logo: 'https://nbacourtiq.org/logo.svg',
  description: 'NBA player analytics, predictions and matchup insights.',
};

const websiteLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'CourtIQ',
  url: 'https://nbacourtiq.org',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://nbacourtiq.org/app?search={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

export default function Landing() {
  return (
    <>
      <Seo
        title="CourtIQ — NBA Player Analytics, Predictions & Matchups"
        description="Real-time NBA player stats, form trends, head-to-head comparisons, prop lines and smart predictions powered by ESPN data."
        path="/"
        jsonLd={[organizationLd, websiteLd]}
      />
      <Hero />
      <Features />
      <Preview />
      <CTA />
    </>
  );
}
