# FlowMind grounding benchmark

`npm run bench` drives a running FlowMind server through the same client code the browser uses and scores
each part of the agent pipeline on the bundled sample lecture (`public/samples/Neural-Networks-Lecture-4.pdf`,
4 pages). The gold data lives in [`dataset.json`](./dataset.json); raw results are written to `results/`.

```bash
npm run dev                     # terminal 1 (needs OPENROUTER_API_KEY or MISTRAL_API_KEY in .env.local)
BASE=http://localhost:3000 npm run bench   # terminal 2
```

## What is measured

| Area | Metric | How |
| --- | --- | --- |
| Ingestion | Gold concept recall | 30 concepts a student must know, matched by name/alias against extracted concepts |
| Ingestion | Gold link recall | 10 expected links (either direction) between gold concepts |
| Retrieval | Answer-bearing passage hit@8 | Do the passages sent to the tutor contain the gold answer? Keyword-only vs. hybrid |
| Tutor | Answer accuracy | 14 answerable questions, deterministic keyword checks on the final answer |
| Tutor | Abstention / fabrication | 5 questions the lecture does not cover; LLM judge decides if the tutor declined or invented facts |
| Tutor | Citations | Share of answers with `[n]` citations, and share whose citations all point to passages that were supplied |
| Tutor | Critic loop | First-draft pass rate, final verified rate, share of answers that needed a revision, mean critic score |
| Tutor | Multilingual | Sinhala (script check) and Spanish (keyword check) answers |
| Quiz | Validity | 4 unique options and a valid key; LLM judge checks each answer key against the passages |

## Results — 30 Sep 2026, OpenRouter `stealth/space-bunny-alpha`, embeddings `nvidia/nemotron-3-embed-1b:free`

Run 1 is the first version of the pipeline; run 2 is after the fixes it motivated (denser concept extraction,
LaTeX-safe JSON parsing, a critic pass over quiz answer keys).

| Metric | Run 1 | Run 2 |
| --- | ---: | ---: |
| Concepts / links extracted | 16 / 20 | 48 / 55 |
| Gold concept recall | 56.7 % | **93.3 %** |
| Gold link recall | 30 % | **60 %** |
| Retrieval hit@8, keyword only | 100 % | 100 % |
| Retrieval hit@8, hybrid | 100 % | 100 % |
| Tutor answer accuracy (14) | 92.9 % ¹ | **100 %** |
| Answers with citations | 92.9 % | 100 % |
| Citations pointing at supplied passages | 100 % | 100 % |
| Out-of-scope questions declined (5) | 100 % | 100 % |
| Fabricated answers to out-of-scope questions | 0 % | 0 % |
| Answers in the requested language | 100 % | 100 % |
| Critic: first draft passed | 75 % | 61.9 % |
| Critic: final answer verified | 100 % | 100 % |
| Answers revised after critic feedback | 25 % | 38.1 % |
| Mean critic score | 96 | 97 |
| Tutor latency p50 / p90 | 16.4 s / 25.5 s | 27.4 s / 46.2 s |
| Quiz answer keys judged correct | 83.3 % | **100 %** |
| Ingestion time (4-page PDF) | 33.5 s | 37.9 s |

¹ The single miss in run 1 was a crash, not a wrong answer: the model wrote LaTeX (`\partial`) inside JSON,
which is invalid JSON. `parseJson` now repairs LaTeX escapes (see `tests/llm.test.ts`).

## Reading the numbers honestly

- The sample is small (4 pages, 10 passages), so retrieval saturates: keyword and hybrid retrieval both hit 100 %.
  The hybrid path matters more on long, multi-source libraries; this benchmark does not show that difference.
- The LLM judge and the critic use the same model as the tutor, so abstention and quiz-key scores can be optimistic.
  Answer accuracy uses deterministic keyword checks.
- Revisions rose in run 2 because the richer concept map gives the critic more to check; that also explains the
  higher latency. Every final answer passed the critic in both runs.
- Free OpenRouter models share a daily quota (50 requests/day without credits). When the embedding quota runs out,
  FlowMind falls back to keyword + graph retrieval instead of failing.
- 20–30 questions on one lecture is a smoke-level benchmark, not a research result. Add documents and questions
  to `dataset.json` to widen it.
