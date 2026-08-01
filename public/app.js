const form = document.querySelector('#reviewForm');
const button = document.querySelector('#submitButton');
const errorBox = document.querySelector('#error');
const empty = document.querySelector('#empty');
const results = document.querySelector('#results');
const finalDocument = document.querySelector('#finalDocument');

async function checkHealth() {
  const badge = document.querySelector('#health');
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    badge.textContent = data.hasOpenRouterKey ? 'Serveur prêt' : 'Clé serveur absente';
    badge.className = `badge ${data.hasOpenRouterKey ? 'ok' : 'warn'}`;
    document.querySelector('#keyDetails').open = !data.hasOpenRouterKey;
  } catch {
    badge.textContent = 'Serveur indisponible';
    badge.className = 'badge warn';
  }
}

function renderAudit(audit) {
  const anomalies = (audit.anomalies || []).map(item => `
    <article class="issue ${String(item.gravite || '').toLowerCase()}">
      <header><strong>${item.gravite || 'Anomalie'}</strong></header>
      <p>${item.probleme || ''}</p>
      <p><b>Correction :</b> ${item.correction_attendue || ''}</p>
    </article>`).join('');

  return `<section class="audit-card">
    <h3>Cycle ${audit.cycle} — score ${audit.score_global ?? '—'}/100</h3>
    <p>${audit.resume || ''}</p>
    ${anomalies || '<p>Aucune anomalie détaillée.</p>'}
  </section>`;
}

function renderArbitration(arbitration) {
  if (!arbitration) return '<p>Aucun arbitrage retourné.</p>';
  const reserves = (arbitration.reserves || []).map(item => `<li>${item}</li>`).join('');
  return `<section class="audit-card">
    <h3>${arbitration.decision || 'Décision indisponible'} — ${arbitration.score_final ?? '—'}/100</h3>
    <p>${arbitration.justification || ''}</p>
    ${reserves ? `<h4>Réserves</h4><ul>${reserves}</ul>` : '<p>Aucune réserve déclarée.</p>'}
    <p><b>Action recommandée :</b> ${arbitration.action_recommandee || '—'}</p>
  </section>`;
}

function renderUsage(calls) {
  if (!calls.length) return '<p>Aucun appel enregistré.</p>';
  return `<div class="table-wrap"><table>
    <thead><tr><th>Rôle</th><th>Modèle</th><th>Entrée</th><th>Sortie</th><th>Coût</th></tr></thead>
    <tbody>${calls.map(call => `<tr>
      <td>${call.role}</td>
      <td>${call.model}</td>
      <td>${call.usage?.prompt_tokens || 0}</td>
      <td>${call.usage?.completion_tokens || 0}</td>
      <td>$${Number(call.usage?.cost || 0).toFixed(4)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  errorBox.hidden = true;
  button.disabled = true;
  button.textContent = 'Boucle en cours…';

  const payload = {
    request: document.querySelector('#request').value,
    claudeModel: document.querySelector('#claudeModel').value.trim(),
    auditorModel: document.querySelector('#auditorModel').value.trim(),
    arbiterModel: document.querySelector('#arbiterModel').value.trim(),
    maxCycles: Number(document.querySelector('#maxCycles').value),
    minScore: Number(document.querySelector('#minScore').value),
    apiKey: document.querySelector('#apiKey').value.trim() || undefined
  };

  try {
    const response = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erreur inattendue.');

    empty.hidden = true;
    results.hidden = false;
    document.querySelector('#status').textContent = data.status || '—';
    document.querySelector('#score').textContent = data.arbitration?.score_final ?? data.audits?.at(-1)?.score_global ?? '—';
    document.querySelector('#calls').textContent = data.calls?.length || 0;
    document.querySelector('#cost').textContent = `$${Number(data.totalCost || 0).toFixed(4)}`;
    finalDocument.textContent = data.finalDocument || '';
    document.querySelector('#audits').innerHTML = (data.audits || []).map(renderAudit).join('') || '<p>Aucun audit.</p>';
    document.querySelector('#arbitration').innerHTML = renderArbitration(data.arbitration);
    document.querySelector('#usage').innerHTML = renderUsage(data.calls || []);
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = 'Lancer la boucle';
  }
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === tab.dataset.tab));
  });
});

document.querySelector('#copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(finalDocument.textContent);
});

checkHealth();
