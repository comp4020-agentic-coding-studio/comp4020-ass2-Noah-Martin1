# Your harness


## principle rules:
- commit very frequently
- dont rush animations - visual learning is key is this course
- dont sumbit viusals that havent been checked - aim for a consistent style and take screenshots to improve / check this.
  

## Course

Design and build a complete SlopU university course about the **economics of queueing**.

Working idea:

> **Why do we wait, and how could we wait better?**

The course should treat queues as both a mathematical/system problem and an economic/design problem. Students should encounter queues in everyday life, understand why they form, learn how different queueing systems behave, and consider the trade-offs involved in designing them.

The course should feel like a real university course rather than a collection of pages about queues.

---

## Core principle

Build the course around a progression of ideas rather than twelve disconnected topics.

Each week should introduce something that gives students a new way to understand queues, and later weeks should build on earlier ideas. Each week should be animated - a designed sim so the user can interact whereever possible - and animated with play pause reset options whereever sim isnt possible (simulation preferred).

Prefer:

**observation → model → experiment → consequence → design decision**

over:

**definition → explanation → definition → explanation**

The course should repeatedly ask:

- Why does this queue exist?
- What determines how long people wait?
- Who benefits from a particular queueing system?
- Who bears the cost of waiting?
- Could the system be designed differently?
- What happens when we optimise one part of the system?
- Is the "fairest" queue necessarily the most efficient?

---

## Visual direction

Colour theme:
follow the colour pallete of the slop university colours, to create a baseline for the course website - so information appears regular and ordered - like its been created solely for the course. 

We want to use a few colours to highlight important and regular features of a lecture site - Light pink to highlight main concepts - where the student should really pay attention / remember the fraise. Forest Green for animations - and continuous colour accent in the animations to make them feel a little separated from the page. Find the appropriate feature for the sim / animation to colour green. e.g. cafe example: pot plants in the cafe are coloured this green. 

## Course structure

Before generating large amounts of content, propose a coherent semester structure.

The twelve weeks should have a clear narrative arc. The structure is:

Wk: 1
Topic: The Queue You Didn't Notice
Argued from: Campus coffee shop
Visual: CafeLayouts
Type: Static, 3 panels
What it depicts: The same café three ways — one line along the window, two lines/two tills, order-here/collect-there. One
till drawn dashed and idle beside a full lane. Same room, same staff, different throughput.

Animate the viusal, the diagram needs to be bringing the reader in - drawing curiosity to gather their focus - fuel their learning. Continue with a aesthetic cafe look. accent green plants - neat anmation with shading and smooth animated features.
────────────────────────────────────────
Wk: 2
Topic: Variability, Not Busyness
Argued from: Drive-through window
Visual: TwoSystems
Type: Static, 2 panels
What it depicts: Arrival ticks + service blocks + queue-length trace, for two systems with identical load. Left:
clockwork, trace never rises above the one in service. Right: irregular, peaks at 4.

As we progress through the webpage we want to reference this visual - doing so by snippiting animated part of it rather than referring to it as "figure X". Acrtuallt make the visual depict cars on highway to show what its referring to - rather than just plain diagram dots.

────────────────────────────────────────
Wk: 3
Topic: Little's Law
Argued from: Airport security
Visual: LittlesLawArea
Type: Static, 2 panels
What it depicts: The area argument. Eight customer bars on a time axis; panel one cuts vertically (3 present at minute 8 →
L), panel two cuts horizontally (one 6-minute stay → W). Same 35 person-minutes, two directions.

again make sure the visuals are animated or user controlled sim - use accent green where visually needed - make sure the diagram depicts the real world situation.
────────────────────────────────────────
Wk: 4
Topic: The Cost of Waiting
Argued from: Passport office
Visual: WaitBill
Type: Static, 2 panels
What it depicts: Two bars at the same scale. Left: the office's $6.0m budget, solid and stacked. Right: the queue's
$12.0m, drawn as a dashed empty outline because it appears in no account.

Make sure this isnt a static visual - create characters for the visual and link real world data to the scene. the reader is meant to know what the aniamtion is about kust by looking at it rather than reading the detailed context.

Act II — Who goes first

Wk: 5
Topic: First Come, First Served
Argued from: Bank branch
Visual: QueueSim variant="lanes"
Type: Live sim
What it depicts: Same arrival stream into two configurations: one line/four servers above, four lines/one server below.
Load slider. Readout shows pooled / separate side by side for L, W, W₉₀.

Dont make the visual too broad - narate the visual with a scene - a common occurance where this happens - common-sense context helps bring the reader up to speed.
────────────────────────────────────────
Wk: 6
Topic: Shortest Job First
Argued from: Express checkout
Visual: GanttCompare
Type: Static, 2 panels
What it depicts: Five jobs (1,2,3,4,10 min), one server. Grey = waiting, gold = served, pale = the 10-minute job. 20
person-minutes of grey vs 60 — visible at a glance.

Bring context and goodlooking visual direction - simulate with user control.
────────────────────────────────────────
Wk: 7
Topic: Triage — order by need
Argued from: Emergency department
Visual: TriageOrder
Type: Static, 2 panels
What it depicts: Six patients, one room. Panel one in arrival order (chest pain starts at minute 70); panel two by urgency
(minute 0). The critical block outlined gold in both.

Create a situation a script where the queue is important - the delivery of the queue outcome should spark the interest into how it works 
────────────────────────────────────────
Wk: 8
Topic: Pay to Skip — order by price
Argued from: Theme park pass
Visual: QueueSim variant="express"
Type: Live sim
What it depicts: Gold priority queue above, standard below, sharing two servers. Slider for share buying priority (0–80%).
W reported as priority / standard so the transfer is visible while the mean sits still.

link to real world data - disney fast pass - real world data brings importance and relevance to the topic. create the visuals around the topic to give visual context.
────────────────────────────────────────
Wk: 9
Topic: Don't Queue At All
Argued from: Restaurant reservations
Visual: WaitMoved
Type: Static, 2 panels
What it depicts: One person, one appointment, two timelines. Gold bracket marks the window the service counts — most of
the walk-in bar, a sliver of the booked one.

Stoires are the heart of this course - history brings context to why these queues exist and why some dont work - visually - make the animation / sim undeniably a resturant reservation.

Act III — Systems that fight back

Wk: 10
Topic: Queues in Networks
Argued from: Aircraft boarding
Visual: QueueSim variant="boarding"
Type: Live sim
What it depicts: 3-3 cabin, 12 rows, 72 passengers, seen from above. Walkers are hollow dots; gold means stowing and
blocking. Seats fill as people sit. Strategy selector: back-to-front / random / outside-in / Steffen, with
ticks-to-board and % vs baseline.

Provide strong visual queues that the animation / sim isnt just a diagrams of dots - use accent tones and provide neat clear and well shaded animation of the plane - its important that not only inside of the animation is relevant and created with effort but the outside too. Create snippets where possible and when refferring to the animation.
────────────────────────────────────────
Wk: 11
Topic: Queues That Know You're Waiting
Argued from: Call centre
Visual: FeedbackLoop
Type: Static, 1 panel
What it depicts: A four-node cycle with arrowed arcs: queue grows → sign updates → people leave → queue shrinks → the sign
is now wrong because it was shown. Numbered key beside it.

To setup the animation provide a short non-replayable intro animation to the scene - almost like a load screen for context - only seen on refresh - gives a interactive story feel to the animation. 
────────────────────────────────────────
Wk: 12
Topic: There Is No Neutral Queue
Argued from: Organ transplant list
Visual: ObjectiveMatrix
Type: Static table
What it depicts: Five rules × four objectives (mean / worst case / fairness / revenue), filled-half-empty circles, with
each rule's cost under its name. Read any row: no rule has four filled circles.

This is where the aniamtions need to come together - this can be a longer page with snippets to each where needed. A final effort with very high quaility visuals.

Improve it by connecting themes together to form a fluid course. Prioritise viusal explanation over textbook style learning.



---

## Examples to explore

Use concrete systems throughout the course.

Potential examples include:

- Airplane boarding
- Airport security
- Elevators
- Supermarket checkout lines
- Restaurants and reservation systems
- Theme park queues
- Hospitals and emergency departments
- Traffic intersections and highways
- Toll roads
- Coffee shops
- Call centres
- Banks
- Post offices
- Public transport
- Server request queues
- Internet traffic
- Computer CPU scheduling
- Printers
- Cloud computing
- Customer support ticket systems
- Online waiting rooms
- Concert/event entry
- Ambulance dispatch
- Manufacturing lines
- Drive-through restaurants

Do not use examples simply because they are familiar. Each example should introduce a meaningful queueing problem, trade-off, algorithm or economic question.

---

## Interactive and visual teaching

The website and lecture decks should make queueing behaviour visible.

Prefer simulations, animations and interactive explanations where they genuinely improve understanding.

Potential visualisations include:

- People joining and leaving queues
- Different arrival rates
- Different service rates
- One queue versus multiple queues
- First-come-first-served
- Priority queues
- Shortest-job-first
- Batching
- Randomised ordering
- Appointment systems
- Virtual queues
- Express lanes
- Queue jumping and its economic consequences
- Congestion increasing non-linearly
- Different airplane boarding strategies
- Different elevator scheduling strategies
- Traffic merging and bottlenecks
- Computer/server request queues

Animations should demonstrate an idea rather than simply decorate the page.

For example, an airplane boarding animation could show:

**real-world boarding → observed bottleneck → alternative boarding algorithm → simulation → comparison**

The same system can then be revisited later when discussing efficiency, fairness and optimisation.

---

## Lecture decks

Lecture slides are part of the course website, not separate documents.

Each lecture deck must contain a simulation. simulations must be aesthetic - not a textbook demo but more so a viusalisation similar to those shown in veritasium and 3blue1brown videos - beautiful animations telling a story. 

When creating a lecture deck:

1. Establish the question being investigated.
2. Show a concrete situation.
3. Introduce the model or concept.
4. Use an animation, simulation or visualisation where useful.
5. Compare alternative approaches.
6. End with a consequence or question that leads into the next idea.

Slides should be visually driven where appropriate.

Avoid turning decks into walls of explanatory text.

---

## Course coherence

Every major page should contribute to the same course idea.

When creating a new week, check:

- What new idea does this week introduce?
- What previous idea does it build upon?
- What real-world system demonstrates it?
- What economic trade-off does it expose?
- What should students now be able to reason about that they could not before?

Avoid repeating the same generic explanation of queues across multiple weeks.

---

## Assessments

Assessments should test the central ideas of the course rather than simply recall terminology.

Potential assessment formats include:

- analysing an existing queue
- designing a queueing system
- comparing competing queueing algorithms
- running a simulation
- measuring waiting time and throughput
- evaluating fairness versus efficiency
- redesigning a real-world queue
- defending a queue design against an alternative

Assessment tasks should connect to the progression of the semester.

---

## Agent workflow

Before making substantial changes:

1. Inspect the existing template and content model.
2. Identify what is fixed by SlopU and what can be changed.
3. Understand the existing page structure and components.
4. Propose a plan before implementing a large section.
5. Keep the course structure coherent across weeks.
6. create new components when they improve the course.
1. Check that new content agrees with existing content.
2. Run the available checks after meaningful changes.

Do not invent a new structure when the template already provides an appropriate one.

---

## Course voice

The writing should be:

- clear
- curious
- slightly playful
- academically credible
- concrete rather than abstract
- focused on real decisions and trade-offs

Avoid generic "AI university course" language.

The course should have a distinct point of view about waiting, queues and system design.

---

## Design philosophy

The site should make students want to investigate queues. - the course should unfold like a documentary on queues - elaborate understanding but beautiful visually and inspiring thought experiments.

Prefer questions over declarations.

Prefer experiments over long explanations.

Prefer concrete systems over generic examples.

Prefer showing a queue behaving badly over merely explaining that queues can be inefficient.

The goal is not to teach everything about queueing theory.

The goal is to explore **why queues behave the way they do, what waiting costs, and how changing the rules changes the outcome.**

---

## Important

Do not treat the initial syllabus or examples in this file as final.

When there is an opportunity to make the course more coherent, distinctive or interesting, propose the change and explain why it strengthens the course.

The course designer makes the final decisions about curriculum, tone, content and direction.

The site must not follow a textbook style - info dump - detailed explanation. The site and course is to use students experiences and everyday life interactions to fuel curiosity - binded with simulation and explanation.

Themes/ topics / simulations / real world references shouldnt be just mentioned once and forgotten - we are building on knowledge - its ok/ encouraged to (whereever natural) to refernce to topics mentioned in previous lectures to help build this process

## Testing 

The lectures webpages and the course in general is a very viusal learning experience . Take screenshots to refine the animations and simulations - and the fluidity of the webpages. Iterate this process until viusally stunning and capturing the whole concept of the topic. 