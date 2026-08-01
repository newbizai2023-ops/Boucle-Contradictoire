import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "public")));

const writerSystem = `Tu es le rédacteur principal d'une étude professionnelle. Produis un document clair, structuré et exploitable. Distingue systématiquement faits vérifiés, hypothèses, estimations et recommandations. Cite des sources identifiables. N'invente jamais une source, un tarif ou une fonctionnalité. Lorsque tu ne peux pas vérifier une information, écris exactement : « Je ne peux pas confirmer cette information ».`;

const auditorSystem = `Tu es un auditeur contradictoire indépendant. Vérifie les faits, sources, dates, calculs, unités, hypothèses et conclusions. Cherche les erreurs de logique, les omissions et les formulations excessivement affirmatives. Réponds uniquement en JSON avec les champs score_global, decision, resume, anomalies et nouveau_cycle_requis. Chaque anomalie contient gravite, probleme et correction_attendue.`;

const arbiterSystem = `Tu es l'arbitre final d'une boucle contradictoire. Tu n'es ni le rédacteur ni l'auditeur. Examine la demande initiale, le document final et l'historique des audits. Décide si le document peut être livré. Ne cherche pas un compromis artificiel : tranche selon la solidité des preuves, la cohérence des calculs et la proportionnalité des conclusions. Réponds uniquement en JSON avec les champs decision, score_final, justification, reserves et action_recommandee. decision doit être l'une des valeurs APPROUVE, APPROUVE_AVEC_RESERVES ou REJETE.`;

function validateModel(value, label) {
  if (typeof value !== "string" || !/^[~a-zA-Z0-9_.:/-]{3,160}$/.test(value)) {
    throw new Error(`${label} invalide.`);
  }
  return value;
}

async function callOpenRouter({ apiKey, model, system, user, json = false }) {
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature: 0.1,
    max_completion_tokens: 6000
  };

  if (json) body.response_format = { type: "json_object" };

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || `http://localhost:${PORT}`,
      "X-OpenRouter-Title": "Boucle Contradictoire"
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180000)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Erreur OpenRouter ${response.status}`);

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Réponse vide du modèle ${model}.`);

  return {
    content,
    model: payload.model || model,
    provider: payload.provider || null,
    usage: payload.usage || {}
  };
}

function parseJson(content, label) {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`${label} n'est pas un JSON valide.`);
    return JSON.parse(match[0]);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY),
    hasFirecrawlKey: Boolean(process.env.FIRECRAWL_API_KEY)
  });
});

app.post("/api/review", async (req, res) => {
  try {
    const request = String(req.body?.request || "").trim();
    if (request.length < 20) return res.status(400).json({ error: "La demande doit contenir au moins 20 caractères." });

    const apiKey = process.env.OPENROUTER_API_KEY || req.body?.apiKey;
    if (!apiKey) return res.status(400).json({ error: "Clé OpenRouter absente." });

    const claudeModel = validateModel(req.body?.claudeModel, "Modèle rédacteur");
    const auditorModel = validateModel(req.body?.auditorModel, "Modèle auditeur");
    const arbiterModel = validateModel(req.body?.arbiterModel, "Modèle arbitre");
    const maxCycles = Math.min(5, Math.max(1, Number(req.body?.maxCycles || 3)));
    const minScore = Math.min(100, Math.max(50, Number(req.body?.minScore || 90)));

    const result = { versions: [], audits: [], calls: [], totalCost: 0, status: "incomplete", arbitration: null };

    const first = await callOpenRouter({ apiKey, model: claudeModel, system: writerSystem, user: request });
    let document = first.content;
    result.versions.push({ cycle: 0, content: document });
    result.calls.push({ role: "redaction", model: first.model, provider: first.provider, usage: first.usage });
    result.totalCost += Number(first.usage?.cost || 0);

    for (let cycle = 1; cycle <= maxCycles; cycle += 1) {
      const auditCall = await callOpenRouter({
        apiKey,
        model: auditorModel,
        system: auditorSystem,
        user: `DEMANDE INITIALE:\n${request}\n\nDOCUMENT À AUDITER:\n${document}`,
        json: true
      });
      const audit = parseJson(auditCall.content, "L'audit");
      result.audits.push({ cycle, ...audit });
      result.calls.push({ role: "audit", model: auditCall.model, provider: auditCall.provider, usage: auditCall.usage });
      result.totalCost += Number(auditCall.usage?.cost || 0);

      const severe = (audit.anomalies || []).some(a => ["critique", "elevee", "élevée"].includes(String(a.gravite || "").toLowerCase()));
      if (Number(audit.score_global || 0) >= minScore && !severe && audit.nouveau_cycle_requis !== true) {
        result.status = "ready_for_arbitration";
        result.stopReason = "Critères d'audit atteints ; passage à l'arbitrage final.";
        break;
      }

      if (cycle === maxCycles) {
        result.status = "ready_for_arbitration";
        result.stopReason = "Nombre maximal de cycles atteint ; passage à l'arbitrage final.";
        break;
      }

      const correction = await callOpenRouter({
        apiKey,
        model: claudeModel,
        system: writerSystem,
        user: `Corrige intégralement le document en tenant compte de cet audit.\n\nDEMANDE:\n${request}\n\nDOCUMENT:\n${document}\n\nAUDIT:\n${JSON.stringify(audit, null, 2)}`
      });
      document = correction.content;
      result.versions.push({ cycle, content: document });
      result.calls.push({ role: "correction", model: correction.model, provider: correction.provider, usage: correction.usage });
      result.totalCost += Number(correction.usage?.cost || 0);
    }

    const arbitrationCall = await callOpenRouter({
      apiKey,
      model: arbiterModel,
      system: arbiterSystem,
      user: `DEMANDE INITIALE:\n${request}\n\nDOCUMENT FINAL:\n${document}\n\nHISTORIQUE DES AUDITS:\n${JSON.stringify(result.audits, null, 2)}`,
      json: true
    });
    const arbitration = parseJson(arbitrationCall.content, "L'arbitrage");
    result.arbitration = arbitration;
    result.calls.push({ role: "arbitrage", model: arbitrationCall.model, provider: arbitrationCall.provider, usage: arbitrationCall.usage });
    result.totalCost += Number(arbitrationCall.usage?.cost || 0);

    const decision = String(arbitration.decision || "").toUpperCase();
    if (decision === "APPROUVE") result.status = "validated";
    else if (decision === "APPROUVE_AVEC_RESERVES") result.status = "validated_with_reservations";
    else result.status = "rejected_by_arbiter";

    result.finalDocument = document;
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Erreur interne." });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Boucle Contradictoire disponible sur le port ${PORT}`);
});
