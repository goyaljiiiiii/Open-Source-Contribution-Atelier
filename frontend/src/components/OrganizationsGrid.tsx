import React from 'react';
import { ORGS } from '../lib/organizations';

const OrganizationsGrid: React.FC = () => {
  return (
    <section aria-labelledby="orgs-heading" className="mt-8">
      <h3 id="orgs-heading" className="text-lg font-semibold mb-4">Open-source organizations</h3>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {ORGS.map((slug) => (
          <a
            key={slug}
            href={`https://github.com/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border rounded-lg p-3 flex items-start gap-3 hover:shadow transition-shadow bg-white dark:bg-gray-800"
          >
            <img
              src={`https://github.com/${slug}.png?size=120`}
              alt={`${slug} avatar`}
              className="w-12 h-12 rounded-md object-cover"
            />
            <div>
              <div className="font-medium">{slug}</div>
              <div className="text-sm text-muted mt-1">Visit on GitHub</div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
};

export default OrganizationsGrid;