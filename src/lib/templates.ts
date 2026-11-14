import type { NoteTemplate } from '../types/workspace';

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: 'tpl-blank',
    name: 'Blank Document',
    category: 'General',
    description: 'Clean, distraction-free page ready for writing.',
    tags: [],
    titlePattern: 'Untitled Note',
    contentHtml: '<p></p>',
  },
  {
    id: 'tpl-meeting',
    name: 'Meeting Notes',
    category: 'Work',
    description: 'Agenda, attendees, discussion decisions, and action checklist.',
    tags: ['meeting', 'work'],
    titlePattern: 'Meeting — {{date}}',
    contentHtml: `<h1>Meeting Notes</h1>
<p><strong>Date:</strong> {{date}} · <strong>Facilitator:</strong> You</p>
<h2>Agenda</h2>
<ul><li><p>Review current milestones and blockers</p></li><li><p>Align on next deliverables</p></li></ul>
<h2>Discussion Notes</h2>
<p>Capture key decisions and context here. Link related specs with [[Project Atlas]].</p>
<h2>Action Items</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Share meeting summary with stakeholders</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Schedule follow-up checkpoint</p></div></li></ul>`,
  },
  {
    id: 'tpl-project',
    name: 'Project Brief',
    category: 'Projects',
    description: 'Structured overview with scope table, milestones, and risks.',
    tags: ['project', 'planning'],
    titlePattern: 'Project Brief — {{date}}',
    contentHtml: `<h1>Project Brief</h1>
<p>Summarize the core objective, target outcome, and why this initiative matters.</p>
<h2>Scope &amp; Milestones</h2>
<table><thead><tr><th>Phase</th><th>Deliverable</th><th>Target</th></tr></thead><tbody><tr><td>01. Discovery</td><td>Architecture &amp; constraints</td><td>Week 1</td></tr><tr><td>02. Build</td><td>Core implementation &amp; tests</td><td>Week 3</td></tr></tbody></table>
<h2>Open Questions</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Confirm acceptance criteria</p></div></li></ul>`,
  },
  {
    id: 'tpl-study',
    name: 'Study & Cornell Notes',
    category: 'Study',
    description: 'Key concepts, detailed synthesis, and self-test recall prompts.',
    tags: ['study', 'learning'],
    titlePattern: 'Study Notes — {{date}}',
    contentHtml: `<h1>Study Session</h1>
<h2>Core Concepts</h2>
<ul><li><p><strong>Concept A:</strong> Concise definition in your own words.</p></li><li><p><strong>Concept B:</strong> How it connects to [[Local-First Principles]].</p></li></ul>
<h2>Detailed Notes</h2>
<p>Elaborate with examples, formulas, or code snippets.</p>
<h2>Recall Questions</h2>
<blockquote><p>What are the failure modes if an assumption breaks?</p></blockquote>`,
  },
  {
    id: 'tpl-research',
    name: 'Research Synthesis',
    category: 'Research',
    description: 'Source metadata, key findings, methodology critique, and citations.',
    tags: ['research', 'reading'],
    titlePattern: 'Research Note — {{date}}',
    contentHtml: `<h1>Research Synthesis</h1>
<p><strong>Source:</strong> Author / Publication · <strong>Year:</strong> 2026</p>
<h2>Key Findings</h2>
<ol><li><p>Primary empirical claim and supporting evidence.</p></li><li><p>Boundary conditions and trade-offs.</p></li></ol>
<h2>Quotes &amp; Excerpts</h2>
<blockquote><p>Paste noteworthy passages or PDF highlights here.</p></blockquote>
<h2>Connections</h2>
<p>Relates to [[Knowledge Architecture]] and [[Reading List]].</p>`,
  },
  {
    id: 'tpl-journal',
    name: 'Daily Journal',
    category: 'Personal',
    description: 'Morning intention, top 3 priorities, and evening reflection.',
    tags: ['journal', 'daily'],
    titlePattern: 'Daily Note — {{date}}',
    contentHtml: `<h1>Daily Note · {{date}}</h1>
<h2>Top Priorities</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Complete highest-leverage deep work block</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Clear Universal Inbox captures</p></div></li></ul>
<h2>Log &amp; Observations</h2>
<p>Write freely about progress, ideas, and reflections.</p>`,
  },
];
