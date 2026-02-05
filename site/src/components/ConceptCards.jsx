import { useState } from 'react';

export default function ConceptCards({ concepts }) {
  const [activeCard, setActiveCard] = useState(null);

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        {concepts.map((concept) => (
          <div
            key={concept.id}
            onClick={() => setActiveCard(activeCard === concept.id ? null : concept.id)}
            style={{
              ...styles.card,
              ...(activeCard === concept.id ? styles.cardActive : {}),
              cursor: 'pointer'
            }}
          >
            <div style={{
              ...styles.cardInner,
              ...(activeCard === concept.id ? styles.cardInnerActive : {})
            }}>
              <div style={styles.header}>
                <div style={styles.icon}>{concept.icon}</div>
                <div style={styles.headerText}>
                  <h4 style={styles.cardTitle}>{concept.title}</h4>
                  <p style={styles.description}>{concept.description}</p>
                </div>
              </div>

              {activeCard === concept.id && (
                <div style={styles.expandedContent}>
                  {concept.details && (
                    <div style={styles.detailsBox}>
                      <p style={styles.detailsText}>{concept.details}</p>
                    </div>
                  )}
                  
                  {concept.examples && concept.examples.length > 0 && (
                    <div style={styles.examplesBox}>
                      <p style={styles.examplesTitle}>Exemples GCF:</p>
                      <ul style={styles.examplesList}>
                        {concept.examples.map((example, idx) => (
                          <li key={idx} style={styles.exampleItem}>
                            <span style={styles.bullet}>▸</span>
                            <span>{example}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {concept.relatedTo && concept.relatedTo.length > 0 && (
                    <div style={styles.relatedContainer}>
                      <span style={styles.relatedLabel}>Lié à:</span>
                      {concept.relatedTo.map((related) => (
                        <span key={related} style={styles.relatedTag}>
                          {related}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={styles.footer}>
                <span style={{
                  ...styles.footerText,
                  color: activeCard === concept.id ? '#3b82f6' : '#64748b'
                }}>
                  {activeCard === concept.id ? 'Cliquez pour fermer' : 'Cliquez pour détails'}
                </span>
                <span style={{
                  ...styles.arrow,
                  transform: activeCard === concept.id ? 'rotate(180deg)' : 'rotate(0deg)'
                }}>
                  ⌄
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    margin: '2rem 0'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem'
  },
  card: {
    transition: 'all 0.3s ease',
    transform: 'scale(1)'
  },
  cardActive: {
    transform: 'scale(1.02)',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  },
  cardInner: {
    padding: '1.5rem',
    borderRadius: '12px',
    border: '2px solid #e2e8f0',
    backgroundColor: 'white',
    height: '100%',
    transition: 'all 0.3s ease'
  },
  cardInnerActive: {
    borderColor: '#3b82f6',
    background: 'linear-gradient(to bottom right, #eff6ff, #f5f3ff)'
  },
  header: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '0.75rem',
    alignItems: 'flex-start'
  },
  icon: {
    fontSize: '2.5rem',
    flexShrink: 0
  },
  headerText: {
    flex: 1
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '0.5rem',
    margin: '0 0 0.5rem 0'
  },
  description: {
    fontSize: '0.875rem',
    color: '#475569',
    lineHeight: '1.5',
    margin: 0
  },
  expandedContent: {
    marginTop: '1rem',
    paddingTop: '1rem',
    borderTop: '2px solid #dbeafe',
    animation: 'fadeIn 0.3s ease-out'
  },
  detailsBox: {
    backgroundColor: 'white',
    padding: '1rem',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    marginBottom: '0.75rem'
  },
  detailsText: {
    fontSize: '0.875rem',
    color: '#334155',
    lineHeight: '1.6',
    margin: 0
  },
  examplesBox: {
    backgroundColor: '#eff6ff',
    padding: '1rem',
    borderRadius: '8px',
    marginBottom: '0.75rem'
  },
  examplesTitle: {
    fontWeight: '600',
    fontSize: '0.875rem',
    color: '#1e3a8a',
    marginBottom: '0.5rem',
    margin: '0 0 0.5rem 0'
  },
  examplesList: {
    margin: 0,
    padding: 0,
    listStyle: 'none'
  },
  exampleItem: {
    fontSize: '0.875rem',
    color: '#1e40af',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    marginBottom: '0.25rem'
  },
  bullet: {
    color: '#3b82f6',
    marginTop: '0.125rem',
    flexShrink: 0
  },
  relatedContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '0.75rem',
    alignItems: 'center'
  },
  relatedLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#64748b'
  },
  relatedTag: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.5rem',
    backgroundColor: '#f3e8ff',
    color: '#7c3aed',
    borderRadius: '9999px',
    fontWeight: '500'
  },
  footer: {
    marginTop: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.875rem'
  },
  footerText: {
    fontWeight: '500',
    transition: 'color 0.3s ease'
  },
  arrow: {
    transition: 'transform 0.3s ease',
    display: 'inline-block'
  }
};
