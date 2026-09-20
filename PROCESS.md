# Process

## What I built

**SLOP2710 — The Economics of Waiting**, a twelve-week SlopU course exploring how every queue operates according to an ordering rule, and how that rule determines who waits, who gets priority, and whose time carries less value.

The course is structured into twelve lectures across three acts, twelve fieldwork labs, five assessments, and twelve live simulations. Its aim is to make the hidden systems behind everyday waiting visible, exploring how different queuing rules distribute time, access, and cost, and encouraging students to question whether any queue can truly be neutral.

## How I got here

I knew the topic I wanted to pursue was the rules and systems of queuing, but I did not yet have the complete criteria set out. Knowing there have been many papers and reports discussing everyday queueing problems, and that it could be argued that queuing is one of the world's most important hidden systems, I first began writing out the harness to establish the limits of the project.

The evolution of the harness (CLAUDE.md)

### 1. Brainstorming

I started with a quick research and personal brainstorm of themes that were relevant to queuing, regardless of whether they were directly related to each other. I put these together into the harness so Claude could help choreograph the topic selection, pending my approval.

I also established the project's visual priorities. Visual learning is key, so I wanted to iterate towards useful visualisations rather than simply producing neat animations. I also established a workflow policy: understand and plan around topics before generating content, with the aim of creating a coherent structure rather than generating each week independently.

The goal of this stage was for Claude to dive deeper into the topics I had provided, plan animations that could represent the content, and determine which topics could sit coherently together to create a 12-week course structure.

**Commits from this phase:**
- [8ac03ca](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/8ac03caae03b37f409bdfc4f2636f02b3e534eed) Initial claude.md brainstorming setup


### 2. Molding / designing

At this stage, the harness directed Claude to create a skeleton of possible topics and animations around the course themes. Claude was intentionally reserved in its creative role, focusing more on planning and verifying than creating. This was what I wanted at this point.

From here, I could identify where Claude had fallen short and rephrase areas where its confidence or direction was lacking. I began introducing more explicit "must" directions and course-projection language, such as making the course "unfold like a documentary". I also provided real-world examples for Claude to refer to and draw inspiration from, which I have found helpful in previous projects. 
> "visualisation similar to Veritasium and 3Blue1Brown videos"

**Commits from this phase:**
- [d39d70f](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/d39d70f475ed13a7f60c3f6416de5b2f0bf96d24) designing redirection - rephrasing claude.md

### 3. Refinement

In this stage, I focused on the things Claude had done right and narrowed down what each week's topic should be, along with the specific simulation attached to it.

I removed the other possible themes from the brainstorming phase because I wanted Claude to refine the topics and content it had already developed rather than continuing to expand the scope.

There were several refinement iterations where I explored what Claude had achieved, removed remaining brainstorming content, and replaced it with detailed instructions for the course flow. I found this stage particularly important for narrowing down what actually mattered for the course site.

I also found that qualitative direction in the harness was far more useful and impactful than purely quantitative direction.

For example, I thought each week's content was too short. Instead of simply telling Claude that it was "too short", I timed myself reading through it. The current content took approximately 7 minutes, including time to use the simulator, while I was aiming for 15–20 minutes. I then used this measurement to give Claude more useful feedback:

> "... solid topics however lack a bit of depth - current reading time approx 7mins including time to play the simulator - this should be 15 - 20min. Include more depth in the topic or expand to other examples. ... This is a content specific prompt and update, dont spend much time updating visuals in this response."

I provided this as a prompt rather than putting it directly into the harness because saying that the content "currently reads 7 minutes" is too state-dependent for the harness. The harness established the overall direction, while individual prompts responded to what I actually observed in the current state of the site.

**Commits from this phase:**
- [0188125](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/0188125c6af80daa84d79f05d5581cbfea4d590f) Refinement - viusal direction and removing brainstorming foundations

- [4989060](https://github.com/comp4020-agentic-coding-studio/comp4020-ass2-Noah-Martin1/commit/498906024e9241b8e4f13f8a23f78e9241c93dfd) removing brainstorming direction and refining webpage directions (the arc, lecture decks and assessment)