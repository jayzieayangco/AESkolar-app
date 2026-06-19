# Aeskolar AI Methodology — Hybrid AES Architecture

**Version:** 2.0 (aligned with AES thesis draft)  
**Components:** `AESkolar-ai-engine/` (Python ML) + `my-react-app/ai-engine/gradingEngine.js` (client adapter)

---

## 1. System Overview (Thesis Alignment)

This implementation follows the **Multilingual Automated Essay Scoring (AES)** methodology described in the AES research draft:

| Thesis Component | Implementation |
|------------------|----------------|
| ASAP 2.0 + Filipino datasets | `datasets/ASAP2_train_sourcetexts.csv`, `datasets/c4_filipino_subset.csv` |
| English preprocessing (lowercase, tokenize, stopwords) | `src/preprocessing.py` |
| Filipino preprocessing (no stopword removal) | `src/preprocessing.py` |
| POS features (noun, verb, adj, adv) | `src/features.py` — spaCy + Calamancy |
| Word2Vec embeddings | `src/embeddings.py` — Gensim |
| LSTM score prediction | `src/models.py` + `src/predict.py` |
| CountVectorizer + LR / SVR / Random Forest | `src/train_classical.py` + `src/classical_predict.py` |
| XLM-RoBERTa cross-lingual layer | `src/models_xlm.py` + `src/train_xlm.py` |
| Hybrid ensemble | `src/ensemble.py` |
| Flask web API | `server.py` |
| Real-time React interface | `DocumentEditor.jsx` + debounced grading |
| 10-point rubric (4/3/2/1) | `src/rubric_mapper.py` |
| Language detection | `src/language_detect.py` |
| **XLM-RoBERTa** | `src/models_xlm.py` — frozen embeddings + Ridge head (optional train) |

### Hybrid Framework (3rd Generation AES)

Per related work (Li & Ng, 2024), modern AES combines:

1. **Linguistic features** — POS counts, structure (Generation 2 ML)
2. **Semantic embeddings** — Word2Vec + cosine prompt relevance
3. **Deep learning** — LSTM on 108-feature vectors
4. **Classical ML** — CountVectorizer + Linear Regression, SVR, Random Forest
5. **Transformer** — XLM-RoBERTa for cross-lingual scoring (ensemble weight 20%)

---

## 2. Technology Stack

### Python ML Backend (`AESkolar-ai-engine/`)

| Package | Purpose |
|---------|---------|
| **Gensim** | Word2Vec training & loading |
| **PyTorch** | LSTM regressor |
| **spaCy** | English POS tagging (`en_core_web_sm`) |
| **Calamancy** | Filipino POS tagging (`tl_calamancy_md`) |
| **NLTK** | Tokenization, English stopwords |
| **scikit-learn** | CountVectorizer + LR / SVR / Random Forest |
| **Transformers** | XLM-RoBERTa embeddings |
| **Flask + flask-cors** | REST API for React |

### JavaScript Client Adapter (`my-react-app/ai-engine/`)

| Module | Purpose |
|--------|---------|
| `gradingEngine.js` | Calls Flask `/api/score`; heuristic fallback offline |
| `DocumentEditor.jsx` | 2s debounce → `gradeEssayWithAI({ content, rubric })` |

**No LLM APIs** (OpenAI/Anthropic) in current production path.

---

## 3. Scoring Pipeline

```
Essay text
    │
    ├─ Language detection (English / Filipino)
    │
    ├─ Preprocessing (language-specific)
    │
    ├─ Feature extraction
    │     • 7 linguistic features (spaCy / Calamancy POS)
    │     • 100-d Word2Vec centroid
    │     • 1 prompt-relevance (cosine similarity)
    │
    ├─ LSTM regression → raw score (English)
    │     OR feature-only fallback (Filipino until LSTM trained)
    │
    ├─ Classical ML (CountVectorizer + LR/SVR/RF) → raw score
    │
    ├─ XLM-RoBERTa embeddings → raw score (cross-lingual)
    │
    ├─ Hybrid ensemble (LSTM 40% + Classical 30% + XLM 20% + features if needed)
    │
    └─ Rubric mapper → 10-point breakdown
          Content (4) + Organization (3) + Language (2) + Mechanics (1)
```

### 10-Point Rubric Distribution

| Criterion | Weight | Primary Signals |
|-----------|--------|-----------------|
| **Content** | 4/10 | Prompt cosine similarity, word depth, noun+verb density |
| **Organization** | 3/10 | Paragraph count, sentence count |
| **Language** | 2/10 | Avg sentence length readability, adj/adv usage |
| **Mechanics** | 1/10 | Punctuation patterns, sentence length penalties |

**Why this distribution:** Thesis prioritizes *deep content and logical flow* — content and organization carry 70% of the weight.

### Content vs Organization

- **Content** uses **semantic alignment** (Word2Vec cosine similarity to prompt) plus lexical richness (POS ratios). This approximates "does the essay address the topic with sufficient development?"
- **Organization** uses **structural features** (paragraphs, sentences) without semantic embedding — approximating "is the essay structured as an academic piece?"

This mirrors the thesis hybrid: semantic + structural analysis.

---

## 4. Training Paradigm

| Approach | Status |
|----------|--------|
| Supervised LSTM on ASAP 2.0 scores | ✅ English (`aeskolar_lstm_english.pth`) |
| CountVectorizer + LR/SVR/RF | ✅ English (`aeskolar_classical_english.joblib`) |
| Unsupervised Word2Vec (Filipino corpus) | ✅ (`aeskolar_v2w_filipino.model`) |
| Filipino LSTM | ⏳ Train via `main.py` with labeled Filipino data |
| XLM-RoBERTa Ridge head | ✅ Optional — `AESKOLAR_TRAIN_XLM=1 python main.py` |
| XLM zero-shot (no Ridge head) | ✅ Prompt–essay embedding similarity fallback |

**Not prompt-based.** No zero-shot/few-shot LLM prompting in the current engine.

---

## 5. Inference Modes

| Mode | When | Engine tag |
|------|------|------------|
| **LSTM + features** | English, models present | `"lstm"` |
| **Feature-only** | Filipino (no LSTM weights) | `"features"` |
| **Heuristic fallback** | Flask offline / fetch error | `"heuristic-fallback"` |

Off-topic detection: prompt cosine similarity < 0.35 → score penalty.

---

## 6. React Integration

All three editors use the **same contract**:

```javascript
import { gradeEssayWithAI } from "@ai-engine/gradingEngine.js";

const result = await gradeEssayWithAI({
  content: essayText,
  rubric: { prompt: assignmentInstructions },
});
// → { totalScore, maxScore: 10, rubricScores, suggestions, metadata }
```

**Files:** `Essay.jsx`, `Student_essay_editor.jsx`, `Teacher_essay_editor.jsx` → `DocumentEditor.jsx`

---

## 7. Running the Full Stack

```bash
# Terminal 1 — ML backend
cd AESkolar-ai-engine
.venv\Scripts\activate
python server.py

# Terminal 2 — React frontend
cd AESkolar/my-react-app
npm run dev
```

Vite proxies `/api` → Flask `:5000`. Optional: `VITE_AI_ENGINE_URL=http://127.0.0.1:5000` in `.env`.

---

## 8. Evaluation Metric (Thesis)

Production evaluation uses **Quadratic Weighted Kappa (QWK)** comparing system scores vs human raters. Implementation of QWK evaluation script is a separate offline tooling task (`src/evaluate.py` — planned).

---

## 9. Limitations (from Thesis Section III-E)

1. Aggressive preprocessing may remove stylistic markers
2. Language/style bias possible across Filipino vs English
3. Rubric gaming / keyword stuffing
4. Lower Filipino performance without sufficient labeled data
5. Human professor review remains required — AES is a **support tool**

---

## 10. Roadmap: XLM-RoBERTa Integration

```python
# Planned: src/models_xlm.py
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_NAME = "xlm-roberta-base"  # or fine-tuned checkpoint

def score_with_xlm_roberta(essay: str, language: str) -> float:
    ...
```

Ensemble plan: `final = 0.5 * lstm_score + 0.3 * xlm_score + 0.2 * feature_rubric`

---

*See also: `AESkolar-ai-engine/README.md` for setup commands.*
