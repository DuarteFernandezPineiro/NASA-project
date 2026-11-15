# Use of Super Intelligence (SI)

The application uses OpenAI text-embedding-3-small (256 dimensions) to index NASA report passages and trial evidence and, where available, retrieve semantically related passages for a question. The Node.js worker uses the OpenAI Responses API with GPT-4.1 mini as the default answer model. It requests structured claims with evidence IDs, verifies those IDs and resolves them to NASA PDF pages. The document-search mode uses local evidence and keyword ranking when answer generation is unavailable.

OpenAI Codex assisted with writing and reviewing code for data ingestion, the browser interface, retrieval, evaluation scripts, documentation and deployment. The NASA CSV and PDF inputs are source data. Python scripts process the metadata and link trials to report notes. The indexed embeddings are AI-derived metadata. The work used Codex to summarize documents and cross-check candidate statements against original NASA sources. It was also used for drafting, layout, browser verification and render review of the submission deck.

The demo uses original NASA experimental material and captures of the deployed interface. The deck contains no SI-generated imagery, video or audio. Model answers visible in the interface are labeled “AI Response.” The team should add any tools used independently by its members before confirming the disclosure.
