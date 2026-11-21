// The worked example on /guide/lessons. It lives here, not in the page, so a
// test can hold it to the claim the guide makes: this document passes
// `normalizeLessonDocument` with no fix.

import type { LessonDocumentJSON } from './lesson-types';

export const LESSON_GUIDE_EXAMPLE: LessonDocumentJSON = {
  format: 'x-flow-lesson',
  version: 1,
  meta: {
    title: 'From a phone to an API',
    summary: 'A phone talks to a REST API; then a GraphQL endpoint joins it.',
    minutes: 4,
    level: 'beginner',
    metrics: [{ id: 'trips', label: 'Round trips' }],
    goals: [
      { text: 'See a client call an API', step: 's1' },
      { text: 'Compare REST and GraphQL', step: 's3' },
    ],
  },
  diagram: {
    nodes: [
      { id: 'phone', type: 'start', title: 'Phone', description: 'Mobile app', position: { x: 120, y: 200 }, icon: 'lucide:smartphone' },
      { id: 'rest', type: 'process', title: 'REST API', description: 'Resources and verbs', position: { x: 440, y: 120 }, icon: 'lucide:server' },
      { id: 'graphql', type: 'process', title: 'GraphQL', description: 'One query, one reply', position: { x: 440, y: 300 }, icon: 'lucide:share-2' },
    ],
    edges: [
      { id: 'e-rest', from: 'phone', to: 'rest', label: 'HTTPS + JSON', effect: 'flow' },
      { id: 'e-graphql', from: 'phone', to: 'graphql', label: 'POST /graphql', effect: 'comet' },
    ],
  },
  presence: {
    // Absent = present in every Lesson step. These two appear from step 3 on.
    graphql: { from: 's3' },
    'e-graphql': { from: 's3' },
  },
  steps: [
    {
      id: 's1',
      short: 'Contract',
      chapter: 'setup',
      title: 'Programs need a contract',
      body: 'A phone app cannot read a server\'s memory. It sends a **request** and waits for a reply.\n\nThe agreed shape of that exchange is the [[API contract]].',
      changes: ['+ A phone and a REST API, talking over HTTPS'],
      metrics: { trips: '1' },
      overrides: {},
    },
    {
      id: 's2',
      short: 'REST',
      chapter: 'technique',
      title: 'REST: resources and verbs',
      body: 'REST treats data as *resources* with URLs. `GET /profile` reads one; `PUT /profile` replaces it.',
      callout: { kind: 'tip', text: 'Return the right status code: `404` for a missing resource, not `200` with an error body.' },
      changes: ['~ The REST API now answers the profile screen'],
      metrics: { trips: '3' },
      overrides: {
        rest: { effect: 'glow', emphasis: true },
        'e-rest': { label: 'GET /profile' },
      },
    },
    {
      id: 's3',
      short: 'GraphQL',
      chapter: 'tradeoff',
      title: 'GraphQL: ask for exactly what you need',
      body: 'A GraphQL endpoint takes one **query** that names every field the screen needs, so the phone makes fewer round trips.',
      callout: { kind: 'warning', text: 'One endpoint hides cost: a deep query can be expensive for the server.' },
      changes: ['+ A GraphQL endpoint beside the REST API', '- The extra round trips for the profile screen'],
      metrics: { trips: '1' },
      overrides: {
        'e-rest': { effect: 'none' },
      },
    },
  ],
};
