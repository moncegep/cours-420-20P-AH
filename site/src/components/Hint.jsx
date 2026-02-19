import { useState } from 'react';
import { Lightbulb } from 'lucide-react';

export default function Hint({ children }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="hint-wrapper">
      <span
        className="hint-icon"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        tabIndex={0}
        role="button"
        aria-label="Afficher l'astuce"
      >
        <Lightbulb size={16} />
      </span>
      
      {isVisible && (
        <span className="hint-tooltip" role="tooltip">
          {children}
        </span>
      )}

      <style jsx>{`
        .hint-wrapper {
          position: relative;
          display: inline-block;
          margin: 0 0.15em;
        }

        .hint-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.2em;
          height: 1.2em;
          vertical-align: middle;
          cursor: help;
          color: var(--sl-color-orange-high);
          transition: all 0.2s ease;
          border-radius: 50%;
          outline: none;
        }

        .hint-icon:hover,
        .hint-icon:focus {
          color: var(--sl-color-orange);
          background-color: var(--sl-color-orange-low);
          transform: scale(1.15);
        }

        .hint-icon:focus {
          box-shadow: 0 0 0 2px var(--sl-color-orange-low);
        }

        .hint-tooltip {
          position: absolute;
          bottom: calc(100% + 0.5rem);
          left: 50%;
          transform: translateX(-50%);
          padding: 0.5rem 0.75rem;
          background: var(--sl-color-bg-nav);
          color: var(--sl-color-text);
          border: 1px solid var(--sl-color-gray-5);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          line-height: 1.4;
          white-space: nowrap;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
                      0 2px 4px -1px rgba(0, 0, 0, 0.06);
          z-index: 1000;
          pointer-events: none;
          animation: fadeIn 0.2s ease;
        }

        .hint-tooltip::before {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 0.375rem solid transparent;
          border-top-color: var(--sl-color-bg-nav);
        }

        .hint-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 0.5rem solid transparent;
          border-top-color: var(--sl-color-gray-5);
          z-index: -1;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-0.25rem);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        /* Responsive : sur mobile, permettre le wrap du texte */
        @media (max-width: 768px) {
          .hint-tooltip {
            white-space: normal;
            max-width: 280px;
            left: 0;
            transform: translateX(0);
          }

          .hint-tooltip::before,
          .hint-tooltip::after {
            left: 1rem;
            transform: translateX(0);
          }
        }
      `}</style>
    </span>
  );
}
