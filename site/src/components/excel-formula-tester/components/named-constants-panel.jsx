export function NamedConstantsPanel({ constants, onChange }) {
  const entries = Object.entries(constants);

  const addConstant = () => {
    const idx = entries.length + 1;
    let name = `Nom${idx}`;
    while (constants[name] !== undefined) name = `Nom${++idx}`;
    onChange({ ...constants, [name]: "" });
  };

  const removeConstant = (key) => {
    const next = { ...constants };
    delete next[key];
    onChange(next);
  };

  const renameConstant = (oldKey, newKey) => {
    if (newKey === oldKey) return;
    const sanitized = newKey.replace(/[^A-Za-zÀ-ÿ0-9_]/g, "");
    if (!sanitized) return;
    const next = {};
    for (const [k, v] of Object.entries(constants)) {
      next[k === oldKey ? sanitized : k] = v;
    }
    onChange(next);
  };

  const updateValue = (key, val) => {
    onChange({ ...constants, [key]: val });
  };

  return (
    <div>
      {entries.length === 0 && (
        <div className="ft-named-hint">
          Aucune constante définie. Ajoutez des noms pour simuler des cellules nommées dans vos formules.
        </div>
      )}
      {entries.map(([key, val]) => (
        <div key={key} className="ft-named-row">
          <input
            className="ft-named-input name-field"
            value={key}
            onChange={(e) => renameConstant(key, e.target.value)}
            placeholder="nom"
            spellCheck={false}
          />
          <span className="ft-named-eq">=</span>
          <input
            className="ft-named-input value-field"
            value={val}
            onChange={(e) => updateValue(key, e.target.value)}
            placeholder="valeur"
            spellCheck={false}
          />
          <button
            className="ft-btn-icon"
            onClick={() => removeConstant(key)}
            title="Supprimer"
          >×</button>
        </div>
      ))}
      <button className="ft-btn-icon add" onClick={addConstant}>+ Ajouter</button>
      {entries.length > 0 && (
        <div className="ft-named-hint">
          Utilisez ces noms directement dans vos formules. Ex : =SI(note&gt;=60; "Réussite"; "Échec")
        </div>
      )}
    </div>
  );
}