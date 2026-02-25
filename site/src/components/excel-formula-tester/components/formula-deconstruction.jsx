import { formatTraceValue } from "./../evaluator.js";

/** Render a single trace node + its children recursively */
function TraceNode({ node, depth = 0, isLast = true }) {
  const hasChildren = node.children && node.children.length > 0;

  // ── SI node ──
  if (node.type === "si") {
    const condChild = node.children?.find((c) => c.type === "si-condition");
    const branches = node.children?.filter((c) => c.type === "si-branch") || [];
    return (
      <div className={`ft-tree-node si depth-${Math.min(depth, 4)}`}>
        <div className="ft-tree-header si">
          <span className="ft-trace-badge si">SI</span>
          <span className="ft-trace-arrow">→</span>
          <span className="ft-trace-result si">{formatTraceValue(node.result)}</span>
        </div>
        <div className="ft-tree-children">
          {/* Condition */}
          {condChild && (
            <div className="ft-tree-branch">
              <div className="ft-tree-connector" />
              <div className="ft-tree-branch-content">
                <div className={`ft-tree-header si-condition ${node.conditionResult ? "truthy" : "falsy"}`}>
                  <span className="ft-trace-badge condition">Test logique</span>
                  <code className="ft-tree-raw">{condChild.raw}</code>
                  <span className="ft-trace-arrow">→</span>
                  <span className={`ft-trace-result ${node.conditionResult ? "truthy" : "falsy"}`}>
                    {formatTraceValue(condChild.result)}
                  </span>
                </div>
                {condChild.children && condChild.children.length > 0 && (
                  <div className="ft-tree-children">
                    {condChild.children.map((child, i) => (
                      <TraceNode
                        key={i}
                        node={child}
                        depth={depth + 2}
                        isLast={i === condChild.children.length - 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Branches */}
          {branches.map((branch, bi) => (
            <div key={bi} className="ft-tree-branch">
              <div className="ft-tree-connector" />
              <div className={`ft-tree-branch-content ${branch.active ? "active" : "inactive"}`}>
                <div className={`ft-tree-header si-branch ${branch.active ? "active" : "inactive"}`}>
                  <span className={`ft-trace-badge ${branch.active ? "branch-active" : "branch-inactive"}`}>
                    {branch.label}
                  </span>
                  <code className="ft-tree-raw">{branch.raw}</code>
                  <span className="ft-trace-arrow">→</span>
                  <span className="ft-trace-result">{formatTraceValue(branch.result)}</span>
                  {branch.active && <span className="ft-tree-check">✓</span>}
                </div>
                {branch.children && branch.children.length > 0 && (
                  <div className="ft-tree-children">
                    {branch.children.map((child, i) => (
                      <TraceNode
                        key={i}
                        node={child}
                        depth={depth + 2}
                        isLast={i === branch.children.length - 1}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Function node ──
  if (node.type === "function") {
    const argChildren = node.children?.filter((c) => c.type === "fn-arg") || [];
    return (
      <div className={`ft-tree-node function depth-${Math.min(depth, 4)}`}>
        <div className="ft-tree-header function">
          <span className="ft-trace-badge function">{node.name}</span>
          <span className="ft-trace-arrow">→</span>
          <span className="ft-trace-result function">{formatTraceValue(node.result)}</span>
        </div>
        {argChildren.length > 0 && (
          <div className="ft-tree-children">
            {argChildren.map((arg, ai) => (
              <div key={ai} className="ft-tree-branch">
                <div className="ft-tree-connector" />
                <div className="ft-tree-branch-content">
                  <div className="ft-tree-header fn-arg">
                    <span className="ft-trace-badge arg">#{arg.index + 1}</span>
                    <code className="ft-tree-raw">{arg.raw}</code>
                    <span className="ft-trace-arrow">→</span>
                    <span className="ft-trace-result">{formatTraceValue(arg.result)}</span>
                  </div>
                  {arg.children && arg.children.length > 0 && (
                    <div className="ft-tree-children">
                      {arg.children.map((child, i) => (
                        <TraceNode
                          key={i}
                          node={child}
                          depth={depth + 2}
                          isLast={i === arg.children.length - 1}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Leaf nodes ──
  let badge, badgeClass, displayValue;
  switch (node.type) {
    case "cell":
      badge = "Cellule";
      badgeClass = "cell";
      displayValue = node.displayValue || String(node.value);
      break;
    case "name":
      badge = "Nom";
      badgeClass = "name";
      displayValue = formatTraceValue(node.value);
      break;
    case "range":
      badge = "Plage";
      badgeClass = "range";
      displayValue = formatTraceValue(node.values);
      break;
    case "string":
      badge = "Texte";
      badgeClass = "string";
      displayValue = formatTraceValue(node.value);
      break;
    case "number":
      badge = "Nombre";
      badgeClass = "number";
      displayValue = formatTraceValue(node.value);
      break;
    case "bool":
      badge = "Booléen";
      badgeClass = "bool";
      displayValue = formatTraceValue(node.value);
      break;
    default:
      badge = node.type;
      badgeClass = "";
      displayValue = formatTraceValue(node.result ?? node.value);
  }

  return (
    <div className={`ft-tree-leaf ${badgeClass}`}>
      <span className={`ft-trace-badge ${badgeClass}`}>{badge}</span>
      <code className="ft-tree-raw">{node.raw}</code>
      <span className="ft-trace-arrow">→</span>
      <span className={`ft-trace-result ${badgeClass}`}>{displayValue}</span>
    </div>
  );
}


export function TracePanel({ trace }) {
  if (!trace || trace.length === 0) {
    return (
      <div className="ft-empty-state">
        <div className="ft-empty-icon purple">🔬</div>
        <div className="ft-empty-title dim">Déconstruction</div>
        <div className="ft-empty-desc">
          Entrez une formule commençant par = pour voir l'arborescence d'évaluation
        </div>
      </div>
    );
  }

  return (
    <div className="ft-trace-tree">
      {trace.map((node, i) => (
        <TraceNode key={i} node={node} depth={0} isLast={i === trace.length - 1} />
      ))}
    </div>
  );
}
