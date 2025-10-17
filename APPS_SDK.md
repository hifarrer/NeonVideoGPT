# Apps SDK

Our framework to build apps for ChatGPT.

Apps SDK is available in preview today for developers to begin building and testing their apps. We will open for app submission later this year.

# MCP

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) is an open specification for connecting large language model clients to external tools and resources. An MCP server exposes **tools** that a model can call during a conversation, and return results given specified parameters. Other resources (metadata) can be returned along with tool results, including the inline html that we can use in the Apps SDK to render an interface.

With Apps SDK, MCP is the backbone that keeps server, model, and UI in sync. By standardising the wire format, authentication, and metadata, it lets ChatGPT reason about your app the same way it reasons about built-in tools.

## Protocol building blocks

A minimal MCP server for Apps SDK implements three capabilities:

1.  **List tools** – your server advertises the tools it supports, including their JSON Schema input and output contracts and optional annotations.
2.  **Call tools** – when a model selects a tool to use, it sends a `call_tool` request with the arguments corresponding to the user intent. Your server executes the action and returns structured content the model can parse.
3.  **Return components** – in addition to structured content returned by the tool, each tool (in its metadata) can optionally point to an [embedded resource](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#embedded-resources) that represents the interface to render in the ChatGPT client.

The protocol is transport agnostic, you can host the server over Server-Sent Events or Streamable HTTP. Apps SDK supports both options, but we recommend Streamable HTTP.

## Why Apps SDK standardises on MCP

Working through MCP gives you several benefits out of the box:

*   **Discovery integration** – the model consumes your tool metadata and surface descriptions the same way it does for first-party connectors, enabling natural-language discovery and launcher ranking. See [Discovery](https://developers.openai.com/apps-sdk/concepts/user-interaction) for details.
*   **Conversation awareness** – structured content and component state flow through the conversation. The model can inspect the JSON result, refer to IDs in follow-up turns, or render the component again later.
*   **Multiclient support** – MCP is self-describing, so your connector works across ChatGPT web and mobile without custom client code.
*   **Extensible auth** – the specification includes protected resource metadata, OAuth 2.1 flows, and dynamic client registration so you can control access without inventing a proprietary handshake.

## Next steps

If you’re new to MCP, we recommend starting with the following resources:

*   [Model Context Protocol specification](https://modelcontextprotocol.io/specification)
*   Official SDKs: [Python SDK (official; includes FastMCP module)](https://github.com/modelcontextprotocol/python-sdk) and [TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)
*   [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) for local debugging

Once you are comfortable with the MCP primitives, you can move on to the [Set up your server](https://developers.openai.com/apps-sdk/build/mcp-server) guide for implementation details.

# User Interaction

## Discovery

Discovery refers to the different ways a user or the model can find out about your app and the tools it provides: natural-language prompts, directory browsing, and proactive [entry points](https://developers.openai.com/apps-sdk/concepts/entry-points). Apps SDK leans on your tool metadata and past usage to make intelligent choices. Good discovery hygiene means your app appears when it should and stays quiet when it should not.

### Named mention

When a user mentions the name of your app at the beginning of a prompt, your app will be surfaced automatically in the response. The user must specify your app name at the beginning of their prompt. If they do not, your app can also appear as a suggestion through in-conversation discovery.

### In-conversation discovery

When a user sends a prompt, the model evaluates:

*   **Conversation context** – the chat history, including previous tool results, memories, and explicit tool preferences
*   **Conversation brand mentions and citations** - whether your brand is explicitly requested in the query or is surfaced as a source/citation in search results.
*   **Tool metadata** – the names, descriptions, and parameter documentation you provide in your MCP server.
*   **User linking state** – whether the user already granted access to your app, or needs to connect it before the tool can run.

You influence in-conversation discovery by:

1.  Writing action-oriented [tool descriptions](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#tool) (“Use this when the user wants to view their kanban board”) rather than generic copy.
2.  Writing clear [component descriptions](https://developers.openai.com/apps-sdk/reference#add-component-descriptions) on the resource UI template metadata.
3.  Regularly testing your golden prompt set in ChatGPT developer mode and logging precision/recall.

If the assistant selects your tool, it handles arguments, displays confirmation if needed, and renders the component inline. If no linked tool is an obvious match, the model will default to built-in capabilities, so keep evaluating and improving your metadata.

### Directory

The directory will give users a browsable surface to find apps outside of a conversation. Your listing in this directory will include:

*   App name and icon
*   Short and long descriptions
*   Tags or categories (where supported)
*   Optional onboarding instructions or screenshots

## Entry points

Once a user links your app, ChatGPT can surface it through several entry points. Understanding each surface helps you design flows that feel native and discoverable.

### In-conversation entry

Linked tools are always on in the model’s context. When the user writes a prompt, the assistant decides whether to call your tool based on the conversation state and metadata you supplied. Best practices:

*   Keep tool descriptions action oriented so the model can disambiguate similar apps.
*   Return structured content that references stable IDs so follow-up prompts can mutate or summarise prior results.
*   Provide `_meta` [hints](https://developers.openai.com/apps-sdk/reference#tool-descriptor-parameters) so the client can streamline confirmation and rendering.

When a call succeeds, the component renders inline and inherits the current theme, composer, and confirmation settings.

### Launcher

The launcher (available from the + button in the composer) is a high-intent entry point where users can explicitly choose an app. Your listing should include a succinct label and icon. Consider:

*   **Deep linking** – include starter prompts or entry arguments so the user lands on the most useful tool immediately.
*   **Context awareness** – the launcher ranks apps using the current conversation as a signal, so keep metadata aligned with the scenarios you support.

# App design guidelines

## Overview

Apps are developer-built experiences that live inside ChatGPT. They extend what users can do without breaking the flow of conversation, appearing through lightweight cards, carousels, fullscreen views, and other display modes that integrate seamlessly into ChatGPT’s interface while maintaining its clarity, trust, and voice.

![Example apps in the ChatGPT mobile interface](https://developers.openai.com/images/apps-sdk/overview.png)

These guidelines will give you everything you need to begin building high-quality, consistent, and user-friendly experiences inside ChatGPT.

## Best practices

Apps are most valuable when they help people accomplish meaningful tasks directly within ChatGPT, without breaking the conversational flow. The goal is to design experiences that feel consistent, useful, and trustworthy while extending ChatGPT in ways that add real value. Good use cases include booking a ride, ordering food, checking availability, or tracking a delivery. These are tasks that are conversational, time bound, and easy to summarize visually with a clear call to action.

Poor use cases include pasting in long form content from a website, requiring complex multi step workflows, or using the space for ads or irrelevant messaging.

### Principles

*   **Conversational**: Experiences should feel like a natural extension of ChatGPT, fitting seamlessly into the conversational flow and UI.
*   **Intelligent**: Tools should be aware of conversation context, supporting and anticipating user intent. Responses and UI should feel individually relevant.
*   **Simple**: Each interaction should focus on a single clear action or outcome. Information and UI should be reduced to the absolute minimum to support the context.
*   **Responsive**: Tools should feel fast and lightweight, enhancing conversation rather than overwhelming it.
*   **Accessible**: Designs must support a wide range of users, including those who rely on assistive technologies.

### Boundaries

ChatGPT controls system-level elements such as voice, chrome, styles, navigation, and composer. Developers provide value by customizing content, brand presence, and actions inside the system framework.

This balance ensures that all apps feel native to ChatGPT while still expressing unique brand value.

### Good use cases

A good app should answer “yes” to most of these questions:

*   **Does this task fit naturally into a conversation?** (for example, booking, ordering, scheduling, quick lookups)
*   **Is it time-bound or action-oriented?** (short or medium duration tasks with a clear start and end)
*   **Is the information valuable in the moment?** (users can act on it right away or get a concise preview before diving deeper)
*   **Can it be summarized visually and simply?** (one card, a few key details, a clear CTA)
*   **Does it extend ChatGPT in a way that feels additive or differentiated?**

### Poor use cases

Avoid designing tools that:

*   Display **long-form or static content** better suited for a website or app.
*   Require **complex multi-step workflows** that exceed the inline or fullscreen display modes.
*   Use the space for **ads, upsells, or irrelevant messaging**.
*   Surface **sensitive or private information** directly in a card where others might see it.
*   **Duplicate ChatGPT’s system functions** (for example, recreating the input composer).

By following these best practices, your tool will feel like a natural extension of ChatGPT rather than a bolt-on experience.

## Display modes

Display modes are the surfaces developers use to create experiences inside ChatGPT. They allow partners to show content and actions that feel native to conversation. Each mode is designed for a specific type of interaction, from quick confirmations to immersive workflows.

Using these consistently helps experiences stay simple and predictable.

### Inline

The inline display mode appears directly in the flow of the conversation. Inline surfaces currently always appear before the generated model response. Every app initially appears inline.

![Examples of inline cards and carousels in ChatGPT](https://developers.openai.com/images/apps-sdk/inline_display_mode.png)

**Layout**

*   **Icon &amp; tool call**: A label with the app name and icon.
*   **Inline display**: A lightweight display with app content embedded above the model response.
*   **Follow-up**: A short, model-generated response shown after the widget to suggest edits, next steps, or related actions. Avoid content that is redundant with the card.

#### Inline card

Lightweight, single-purpose widgets embedded directly in conversation. They provide quick confirmations, simple actions, or visual aids.

![Examples of inline cards](https://developers.openai.com/images/apps-sdk/inline_cards.png)

**When to use**

*   A single action or decision (for example, confirm a booking).
*   Small amounts of structured data (for example, a map, order summary, or quick status).
*   A fully self-contained widget or tool (e.g., an audio player or a score card).

**Layout**

![Diagram of inline cards](https://developers.openai.com/images/apps-sdk/inline_card_layout.png)

*   **Title**: Include a title if your card is document-based or contains items with a parent element, like songs in a playlist.
*   **Expand**: Use to open a fullscreen display mode if the card contains rich media or interactivity like a map or an interactive diagram.
*   **Show more**: Use to disclose additional items if multiple results are presented in a list.
*   **Edit controls**: Provide inline support for ChatGPT responses without overwhelming the conversation.
*   **Primary actions**: Limit to two actions, placed at bottom of card. Actions should perform either a conversation turn or a tool call.

**Interaction**

![Diagram of interaction patterns for inline cards](https://developers.openai.com/images/apps-sdk/inline_card_interaction.png)

Cards support simple direct interaction.

*   **States**: Edits made are persisted.
*   **Simple direct edits**: If appropriate, inline editable text allows users to make quick edits without needing to prompt the model.
*   **Dynamic layout**: Card layout can expand its height to match its contents up to the height of the mobile viewport.

**Rules of thumb**

*   **Limit primary actions per card**: Support up to two actions maximum, with one primary CTA and one optional secondary CTA.
*   **No deep navigation or multiple views within a card.** Cards should not contain multiple drill-ins, tabs, or deeper navigation. Consider splitting these into separate cards or tool actions.
*   **No nested scrolling**. Cards should auto-fit their content and prevent internal scrolling.
*   **No duplicative inputs**. Don’t replicate ChatGPT features in a card.

![Examples of patterns to avoid in inline cards](https://developers.openai.com/images/apps-sdk/inline_card_rules.png)

#### Inline carousel

A set of cards presented side-by-side, letting users quickly scan and choose from multiple options.

![Example of inline carousel](https://developers.openai.com/images/apps-sdk/inline_carousel.png)

**When to use**

*   Presenting a small list of similar items (for example, restaurants, playlists, events).
*   Items have more visual content and metadata than will fit in simple rows.

**Layout**

![Diagram of inline carousel](https://developers.openai.com/images/apps-sdk/inline_carousel_layout.png)

*   **Image**: Items should always include an image or visual.
*   **Title**: Carousel items should typically include a title to explain the content.
*   **Metadata**: Use metadata to show the most important and relevant information about the item in the context of the response. Avoid showing more than two lines of text.
*   **Badge**: Use the badge to show supporting context where appropriate.
*   **Actions**: Provide a single clear CTA per item whenever possible.

**Rules of thumb**

*   Keep to **3–8 items per carousel** for scannability.
*   Reduce metadata to the most relevant details, with three lines max.
*   Each card may have a single, optional CTA (for example, “Book” or “Play”).
*   Use consistent visual hierarchy across cards.

### Fullscreen

Immersive experiences that expand beyond the inline card, giving users space for multi-step workflows or deeper exploration. The ChatGPT composer remains overlaid, allowing users to continue “talking to the app” through natural conversation in the context of the fullscreen view.

![Example of fullscreen](https://developers.openai.com/images/apps-sdk/fullscreen.png)

**When to use**

*   Rich tasks that cannot be reduced to a single card (for example, an explorable map with pins, a rich editing canvas, or an interactive diagram).
*   Browsing detailed content (for example, real estate listings, menus).

**Layout**

![Diagram of fullscreen](https://developers.openai.com/images/apps-sdk/fullscreen_layout.png)

*   **System close**: Closes the sheet or view.
*   **Fullscreen view**: Content area.
*   **Composer**: ChatGPT’s native composer, allowing the user to follow up in the context of the fullscreen view.

**Interaction**

![Interaction patterns for fullscreen](https://developers.openai.com/images/apps-sdk/fullscreen_interaction_a.png)

*   **Chat sheet**: Maintain conversational context alongside the fullscreen surface.
*   **Thinking**: The composer input “shimmers” to show that a response is streaming.
*   **Response**: When the model completes its response, an ephemeral, truncated snippet displays above the composer. Tapping it opens the chat sheet.

**Rules of thumb**

*   **Design your UX to work with the system composer**. The composer is always present in fullscreen, so make sure your experience supports conversational prompts that can trigger tool calls and feel natural for users.
*   **Use fullscreen to deepen engagement**, not to replicate your native app wholesale.

### Picture-in-picture (PiP)

A persistent floating window inside ChatGPT optimized for ongoing or live sessions like games or videos. PiP remains visible while the conversation continues, and it can update dynamically in response to user prompts.

![Example of picture-in-picture](https://developers.openai.com/images/apps-sdk/pip.png)

**When to use**

*   **Activities that run in parallel with conversation**, such as a game, live collaboration, quiz, or learning session.
*   **Situations where the PiP widget can react to chat input**, for example continuing a game round or refreshing live data based on a user request.

**Interaction**

![Interaction patterns for picture-in-picture](https://developers.openai.com/images/apps-sdk/fullscreen_interaction.png)

*   **Activated:** On scroll, the PiP window stays fixed to the top of the viewport
*   **Pinned:** The PiP remains fixed until the user dismisses it or the session ends.
*   **Session ends:** The PiP returns to an inline position and scrolls away.

**Rules of thumb**

*   **Ensure the PiP state can update or respond** when users interact through the system composer.
*   **Close PiP automatically** when the session ends.
*   **Do not overload PiP with controls or static content** better suited for inline or fullscreen.

## Visual design guidelines

A consistent look and feel is what makes partner-built tools feel like a natural part of ChatGPT. Visual guidelines ensure partner experiences remain familiar, accessible, and trustworthy, while still leaving room for brand expression in the right places.

These principles outline how to use color, type, spacing, and imagery in ways that preserve system clarity while giving partners space to differentiate their service.

### Why this matters

Visual and UX consistency protects the overall user experience of ChatGPT. By following these guidelines, partners ensure their tools feel familiar to users, maintain trust in the system, and deliver value without distraction.

### Color

System-defined palettes ensure actions and responses always feel consistent with ChatGPT. Partners can add branding through accents, icons, or inline imagery, but should not redefine system colors.

![Color palette](https://developers.openai.com/images/apps-sdk/color.png)

**Rules of thumb**

*   Use system colors for text, icons, and spatial elements like dividers.
*   Partner brand accents such as logos or icons should not override backgrounds or text colors.
*   Avoid custom gradients or patterns that break ChatGPT’s minimal look.
*   Use brand accent colors on primary buttons inside app display modes.

![Example color usage](https://developers.openai.com/images/apps-sdk/color_usage_1.png)

_Use brand colors on accents and badges. Don’t change text colors or other core component styles._

![Example color usage](https://developers.openai.com/images/apps-sdk/color_usage_2.png)

_Don’t apply colors to backgrounds in text areas._

### Typography

ChatGPT uses platform-native system fonts (SF Pro on iOS, Roboto on Android) to ensure readability and accessibility across devices.

![Typography](https://developers.openai.com/images/apps-sdk/typography.png)

**Rules of thumb**

*   Always inherit the system font stack, respecting system sizing rules for headings, body text, and captions.
*   Use partner styling such as bold, italic, or highlights only within content areas, not for structural UI.
*   Limit variation in font size as much as possible, preferring body and body-small sizes.

![Example typography](https://developers.openai.com/images/apps-sdk/typography_usage.png)

_Don’t use custom fonts, even in full screen modes. Use system font variables wherever possible._

### Spacing &amp; layout

Consistent margins, padding, and alignment keep partner content scannable and predictable inside conversation.

![Spacing &amp; layout](https://developers.openai.com/images/apps-sdk/spacing.png)

**Rules of thumb**

*   Use system grid spacing for cards, collections, and inspector panels.
*   Keep padding consistent and avoid cramming or edge-to-edge text.
*   Respect system specified corner rounds when possible to keep shapes consistent.
*   Maintain visual hierarchy with headline, supporting text, and CTA in a clear order.

### Icons &amp; imagery

System iconography provides visual clarity, while partner logos and images help users recognize brand context.

![Icons](https://developers.openai.com/images/apps-sdk/icons.png)

**Rules of thumb**

*   Use either system icons or custom iconography that fits within ChatGPT’s visual world — monochromatic and outlined.
*   Do not include your logo as part of the response. ChatGPT will always append your logo and app name before the widget is rendered.
*   All imagery must follow enforced aspect ratios to avoid distortion.

![Icons &amp; imagery](https://developers.openai.com/images/apps-sdk/iconography.png)

### Accessibility

Every partner experience should be usable by the widest possible audience. Accessibility is a requirement, not an option.

**Rules of thumb**

*   Text and background must maintain a minimum contrast ratio (WCAG AA).
*   Provide alt text for all images.
*   Support text resizing without breaking layouts.

## Tone &amp; proactivity

Tone and proactivity are critical to how partner tools show up inside ChatGPT. Partners contribute valuable content, but the overall experience must always feel like ChatGPT: clear, helpful, and trustworthy. These guidelines define how your tool should communicate and when it should resurface to users.

### Tone ownership

*   ChatGPT sets the overall **voice**.
*   Partners provide **content** within that framework.
*   The result should feel seamless: partner content adds context and actions without breaking ChatGPT’s natural, conversational tone.

### Content guidelines

*   Keep content **concise and scannable**.
*   Always **context-driven**: content should respond to what the user asked for.
*   Avoid **spam, jargon, or promotional language**.
*   Focus on **helpfulness and clarity** over brand personality.

### Proactivity rules

Proactivity helps users by surfacing the right information at the right time. It should always feel relevant and never intrusive.

*   **Allowed**: contextual nudges or reminders tied to user intent.
    *   Example: “Your order is ready for pickup” or “Your ride is arriving.”
*   **Not allowed**: unsolicited promotions, upsells, or repeated attempts to re-engage without clear context.
    *   Example: “Check out our latest deals” or “Haven’t used us in a while? Come back.”

### Transparency

*   Always show **why and when** your tool is resurfacing.
*   Provide enough context so users understand the purpose of the nudge.
*   Proactivity should feel like a natural continuation of the conversation, not an interruption.

### Why this matters

The way partner tools speak and re-engage defines user trust. A consistent tone and thoughtful proactivity strategy ensure users remain in control, see clear value, and continue to trust ChatGPT as a reliable, helpful interface.

# Research use cases

## Why start with use cases

Every successful Apps SDK app starts with a crisp understanding of what the user is trying to accomplish. Discovery in ChatGPT is model-driven: the assistant chooses your app when your tool metadata, descriptions, and past usage align with the user’s prompt and memories. That only works if you have already mapped the tasks the model should recognize and the outcomes you can deliver.

Use this page to capture your hypotheses, pressure-test them with prompts, and align your team on scope before you define tools or build components.

## Gather inputs

Begin with qualitative and quantitative research:

*   **User interviews and support requests** – capture the jobs-to-be-done, terminology, and data sources users rely on today.
*   **Prompt sampling** – list direct asks (e.g., “show my Jira board”) and indirect intents (“what am I blocked on for the launch?”) that should route to your app.
*   **System constraints** – note any compliance requirements, offline data, or rate limits that will influence tool design later.

Document the user persona, the context they are in when they reach for ChatGPT, and what success looks like in a single sentence for each scenario.

## Define evaluation prompts

Decision boundary tuning is easier when you have a golden set to iterate against. For each use case:

1.  **Author at least five direct prompts** that explicitly reference your data, product name, or verbs you expect the user to say.
2.  **Draft five indirect prompts** where the user states a goal but not the tool (“I need to keep our launch tasks organized”).
3.  **Add negative prompts** that should _not_ trigger your app so you can measure precision.

Use these prompts later in [Optimize metadata](https://developers.openai.com/apps-sdk/guides/optimize-metadata) to hill-climb on recall and precision without overfitting to a single request.

## Scope the minimum lovable feature

For each use case decide:

*   **What information must be visible inline** to answer the question or let the user act.
*   **Which actions require write access** and whether they should be gated behind confirmation in developer mode.
*   **What state needs to persist** between turns—for example, filters, selected rows, or draft content.

Rank the use cases based on user impact and implementation effort. A common pattern is to ship one P0 scenario with a high-confidence component, then expand to P1 scenarios once discovery data confirms engagement.

Once a scenario is in scope, draft the tool contract:

*   Inputs: the parameters the model can safely provide. Keep them explicit, use enums when the set is constrained, and document defaults.
*   Outputs: the structured content you will return. Add fields the model can reason about (IDs, timestamps, status) in addition to what your UI renders.
*   Component intent: whether you need a read-only viewer, an editor, or a multiturn workspace. This influences the [component planning](https://developers.openai.com/apps-sdk/plan/components) and storage model later.

Review these drafts with stakeholders—especially legal or compliance teams—before you invest in implementation. Many integrations require PII reviews or data processing agreements before they can ship to production.

## Prepare for iteration

Even with solid planning, expect to revise prompts and metadata after your first dogfood. Build time into your schedule for:

*   Rotating through the golden prompt set weekly and logging tool selection accuracy.
*   Collecting qualitative feedback from early testers in ChatGPT developer mode.
*   Capturing analytics (tool calls, component interactions) so you can measure adoption.

These research artifacts become the backbone for your roadmap, changelog, and success metrics once the app is live.

# Define tools

In Apps SDK, tools are the contract between your MCP server and the model. They describe what the connector can do, how to call it, and what data comes back. Good tool design makes discovery accurate, invocation reliable, and downstream UX predictable.

Use the checklist below to turn your use cases into well-scoped tools before you touch the SDK.

Start from the user journey defined in your [use case research](https://developers.openai.com/apps-sdk/plan/use-case):

*   **One job per tool** – keep each tool focused on a single read or write action (“fetch\_board”, “create\_ticket”), rather than a kitchen-sink endpoint. This helps the model decide between alternatives.
*   **Explicit inputs** – define the shape of `inputSchema` now, including parameter names, data types, and enums. Document defaults and nullable fields so the model knows what is optional.
*   **Predictable outputs** – enumerate the structured fields you will return, including machine-readable identifiers that the model can reuse in follow-up calls.

If you need both read and write behavior, create separate tools so ChatGPT can respect confirmation flows for write actions.

Discovery is driven almost entirely by metadata. For each tool, draft:

*   **Name** – action oriented and unique inside your connector (`kanban.move_task`).
*   **Description** – one or two sentences that start with “Use this when…” so the model knows exactly when to pick the tool.
*   **Parameter annotations** – describe each argument and call out safe ranges or enumerations. This context prevents malformed calls when the user prompt is ambiguous.
*   **Global metadata** – confirm you have app-level name, icon, and descriptions ready for the directory and launcher.

Later, plug these into your MCP server and iterate using the [Optimize metadata](https://developers.openai.com/apps-sdk/guides/optimize-metadata) workflow.

## Model-side guardrails

Think through how the model should behave once a tool is linked:

*   **Prelinked vs. link-required** – if your app can work anonymously, mark tools as available without auth. Otherwise, make sure your connector enforces linking via the onboarding flow described in [Authentication](https://developers.openai.com/apps-sdk/build/auth).
*   **Read-only hints** – set the [`readOnlyHint` annotation](https://openaidevs-preview-apps-sdk.vercel.app/apps-sdk/reference#tool-descriptor-parameters) for tools that cannot mutate state so ChatGPT can skip confirmation prompts when possible.
*   **Result components** – decide whether each tool should render a component, return JSON only, or both. Setting `_meta["openai/outputTemplate"]` on the tool descriptor advertises the HTML template to ChatGPT.

## Golden prompt rehearsal

Before you implement, sanity-check your tool set against the prompt list you captured earlier:

1.  For every direct prompt, confirm you have exactly one tool that clearly addresses the request.
2.  For indirect prompts, ensure the tool descriptions give the model enough context to select your connector instead of a built-in alternative.
3.  For negative prompts, verify your metadata will keep the tool hidden unless the user explicitly opts in (e.g., by naming your product).

Capture any gaps or ambiguities now and adjust the plan—changing metadata before launch is much cheaper than refactoring code later.

## Handoff to implementation

When you are ready to implement, compile the following into a handoff document:

*   Tool name, description, input schema, and expected output schema.
*   Whether the tool should return a component, and if so which UI component should render it.
*   Auth requirements, rate limits, and error handling expectations.
*   Test prompts that should succeed (and ones that should fail).

Bring this plan into the [Set up your server](https://developers.openai.com/apps-sdk/build/mcp-server) guide to translate it into code with the MCP SDK of your choice.

# Design components

## Why components matter

UI components are the human-visible half of your connector. They let users view or edit data inline, switch to fullscreen when needed, and keep context synchronized between typed prompts and UI actions. Planning them early ensures your MCP server returns the right structured data and component metadata from day one.

## Clarify the user interaction

For each use case, decide what the user needs to see and manipulate:

*   **Viewer vs. editor** – is the component read-only (a chart, a dashboard) or should it support editing and writebacks (forms, kanban boards)?
*   **Single-shot vs. multiturn** – will the user accomplish the task in one invocation, or should state persist across turns as they iterate?
*   **Inline vs. fullscreen** – some tasks are comfortable in the default inline card, while others benefit from fullscreen or picture-in-picture modes. Sketch these states before you implement.

Write down the fields, affordances, and empty states you need so you can validate them with design partners and reviewers.

## Map data requirements

Components should receive everything they need in the tool response. When planning:

*   **Structured content** – define the JSON payload that the component will parse.
*   **Initial component state** – use `window.openai.toolOutput` as the initial render data. On subsequent followups that invoke `callTool`, use the return value of `callTool`. To cache state for re-rendering, you can use `window.openai.setWidgetState`.
*   **Auth context** – note whether the component should display linked-account information, or whether the model must prompt the user to connect first.

Feeding this data through the MCP response is simpler than adding ad-hoc APIs later.

## Design for responsive layouts

Components run inside an iframe on both desktop and mobile. Plan for:

*   **Adaptive breakpoints** – set a max width and design layouts that collapse gracefully on small screens.
*   **Accessible color and motion** – respect system dark mode (match color-scheme) and provide focus states for keyboard navigation.
*   **Launcher transitions** – if the user opens your component from the launcher or expands to fullscreen, make sure navigation elements stay visible.

Document CSS variables, font stacks, and iconography up front so they are consistent across components.

## Define the state contract

Because components and the chat surface share conversation state, be explicit about what is stored where:

*   **Component state** – use the `window.openai.setWidgetState` API to persist state the host should remember (selected record, scroll position, staged form data).
*   **Server state** – store authoritative data in your backend or the built-in storage layer. Decide how to merge server changes back into component state after follow-up tool calls.
*   **Model messages** – think about what human-readable updates the component should send back via `sendFollowupTurn` so the transcript stays meaningful.

Capturing this state diagram early prevents hard-to-debug sync issues later.

## Plan telemetry and debugging hooks

Inline experiences are hardest to debug without instrumentation. Decide in advance how you will:

*   Emit analytics events for component loads, button clicks, and validation errors.
*   Log tool-call IDs alongside component telemetry so you can trace issues end to end.
*   Provide fallbacks when the component fails to load (e.g., show the structured JSON and prompt the user to retry).

Once these plans are in place you are ready to move on to the implementation details in [Build a custom UX](https://developers.openai.com/apps-sdk/build/custom-ux).

# Set up your server

## Overview

Your MCP server is the foundation of every Apps SDK integration. It exposes tools that the model can call, enforces authentication, and packages the structured data plus component HTML that the ChatGPT client renders inline. This guide walks through the core building blocks with examples in Python and TypeScript.

## Choose an SDK

Apps SDK supports any server that implements the MCP specification, but the official SDKs are the fastest way to get started:

*   **Python SDK (official)** – great for rapid prototyping, including the official FastMCP module. See the repo at [`modelcontextprotocol/python-sdk`](https://github.com/modelcontextprotocol/python-sdk). This is distinct from community “FastMCP” projects.
*   **TypeScript SDK (official)** – ideal if your stack is already Node/React. Use `@modelcontextprotocol/sdk`. Docs: [`modelcontextprotocol.io`](https://modelcontextprotocol.io/).

Install the SDK and any web framework you prefer (FastAPI or Express are common choices).

Tools are the contract between ChatGPT and your backend. Define a clear machine name, human-friendly title, and JSON schema so the model knows when—and how—to call each tool. This is also where you wire up per-tool metadata, including auth hints, status strings, and component configuration.

### Point to a component template

In addition to returning structured data, each tool on your MCP server should also reference an HTML UI template in its descriptor. This HTML template will be rendered in an iframe by ChatGPT.

1.  **Register the template** – expose a resource whose `mimeType` is `text/html+skybridge` and whose body loads your compiled JS/CSS bundle. The resource URI (for example `ui://widget/kanban-board.html`) becomes the canonical ID for your component.
2.  **Link the tool to the template** – inside the tool descriptor, set `_meta["openai/outputTemplate"]` to the same URI. Optional `_meta` fields let you declare whether the component can initiate tool calls or display custom status copy.
3.  **Version carefully** – when you ship breaking component changes, register a new resource URI and update the tool metadata in lockstep. ChatGPT caches templates aggressively, so unique URIs (or cache-busted filenames) prevent stale assets from loading.

With the template and metadata in place, ChatGPT hydrates the iframe using the `structuredContent` payload from each tool response.

Here is an example:

```
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync } from "node:fs";

// Create an MCP server
const server = new McpServer({
  name: "kanban-server",
  version: "1.0.0"
});

// Load locally built assets (produced by your component build)
const KANBAN_JS = readFileSync("web/dist/kanban.js", "utf8");
const KANBAN_CSS = (() => {
  try {
    return readFileSync("web/dist/kanban.css", "utf8");
  } catch {
    return ""; // CSS optional
  }
})();

// UI resource (no inline data assignment; host will inject data)
server.registerResource(
  "kanban-widget",
  "ui://widget/kanban-board.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://widget/kanban-board.html",
        mimeType: "text/html+skybridge",
        text: `
&lt;div id="kanban-root">&lt;/div>
${KANBAN_CSS ? `&lt;style>${KANBAN_CSS}&lt;/style>` : ""}
&lt;script type="module">${KANBAN_JS}&lt;/script>
        `.trim(),
      },
    ],
  })
);

server.registerTool(
  "kanban-board",
  {
    title: "Show Kanban Board",
    _meta: {
      "openai/outputTemplate": "ui://widget/kanban-board.html",
      "openai/toolInvocation/invoking": "Displaying the board",
      "openai/toolInvocation/invoked": "Displayed the board"
    },
    inputSchema: { tasks: z.string() }
  },
  async () => {
    return {
      content: [{ type: "text", text: "Displayed the kanban board!" }],
      structuredContent: {}
    };
  }
);
```

Each tool result in the tool response can include three sibling fields that shape how ChatGPT and your component consume the payload:

*   **`structuredContent`** – structured data that is used to hydrate your component, e.g. the tracks for a playlist, the homes for a realtor app, the tasks for a kanban app. ChatGPT injects this object into your iframe as `window.openai.toolOutput`, so keep it scoped to the data your UI needs. The model reads these values and may narrate or summarize them.
*   **`content`** – Optional free-form text (Markdown or plain strings) that the model receives verbatim.
*   **`_meta`** – Arbitrary JSON passed only to the component. Use it for data that should not influence the model’s reasoning, like the full set of locations that backs a dropdown. `_meta` is never shown to the model.

Your component receives all three fields, but only `structuredContent` and `content` are visible to the model. If you are looking to control the text underneath the component, please use [`widgetDescription`](https://developers.openai.com/apps-sdk/build/mcp-server###add-component-descriptions).

Continuing the Kanban example, fetch board data and return the trio of fields so the component hydrates without exposing extra context to the model:

```
async function loadKanbanBoard() {
  const tasks = [
    { id: "task-1", title: "Design empty states", assignee: "Ada", status: "todo" },
    { id: "task-2", title: "Wireframe admin panel", assignee: "Grace", status: "in-progress" },
    { id: "task-3", title: "QA onboarding flow", assignee: "Lin", status: "done" }
  ];

  return {
    columns: [
      { id: "todo", title: "To do", tasks: tasks.filter((task) => task.status === "todo") },
      { id: "in-progress", title: "In progress", tasks: tasks.filter((task) => task.status === "in-progress") },
      { id: "done", title: "Done", tasks: tasks.filter((task) => task.status === "done") }
    ],
    tasksById: Object.fromEntries(tasks.map((task) => [task.id, task])),
    lastSyncedAt: new Date().toISOString()
  };
}

server.registerTool(
  "kanban-board",
  {
    title: "Show Kanban Board",
    _meta: {
      "openai/outputTemplate": "ui://widget/kanban-board.html",
      "openai/toolInvocation/invoking": "Displaying the board",
      "openai/toolInvocation/invoked": "Displayed the board"
    },
    inputSchema: { tasks: z.string() }
  },
  async () => {
    const board = await loadKanbanBoard();

    return {
      structuredContent: {
        columns: board.columns.map((column) => ({
          id: column.id,
          title: column.title,
          tasks: column.tasks.slice(0, 5) // keep payload concise for the model
        }))
      },
      content: [{ type: "text", text: "Here's your latest board. Drag cards in the component to update status." }],
      _meta: {
        tasksById: board.tasksById, // full task map for the component only
        lastSyncedAt: board.lastSyncedAt
      }
    };
  }
);
```

## Build your component

Now that you have the MCP server scaffold set up, follow the instructions on the [Build a custom UX page](https://developers.openai.com/apps-sdk/build/custom-ux) to build your component experience.

## Run locally

1.  Build your component bundle (See instructions on the [Build a custom UX page](https://developers.openai.com/apps-sdk/build/custom-ux#bundle-for-the-iframe) page).
2.  Start the MCP server.
3.  Point [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) to `http://localhost:&lt;port>/mcp`, list tools, and call them.

Inspector validates that your response includes both structured content and component metadata and renders the component inline.

## Expose a public endpoint

ChatGPT requires HTTPS. During development, you can use a tunnelling service such as [ngrok](https://ngrok.com/).

In a separate terminal window, run:

```
ngrok http &lt;port>
# Forwarding: https://&lt;subdomain>.ngrok.app -> http://127.0.0.1:&lt;port>
```

Use the resulting URL when creating a connector in developer mode. For production, deploy to an HTTPS endpoint with low cold-start latency (see [Deploy your app](https://developers.openai.com/apps-sdk/deploy)).

## Layer in authentication and storage

Once the server handles anonymous traffic, decide whether you need user identity or persistence. The [Authentication](https://developers.openai.com/apps-sdk/build/auth) and [Storage](https://developers.openai.com/apps-sdk/build/storage) guides show how to add OAuth 2.1 flows, token verification, and user state management.

With these pieces in place you have a functioning MCP server ready to pair with a component bundle.

## Advanced

### Allow component-initiated tool access

To allow component‑initiated tool access, you should mark tools with `_meta.openai/widgetAccessible: true`:

```
"_meta": { 
  "openai/outputTemplate": "ui://widget/kanban-board.html",
  "openai/widgetAccessible": true 
}
```

### Define component content security policies

Widgets are required to have a strict content security policy (CSP) prior to broad distribution within ChatGPT. As part of the MCP review process, a snapshotted CSP will be inspected.

To declare a CSP, your component resource should include the `openai/widget` meta property with a `csp` subproperty.

```
server.registerResource(
  "html",
  "ui://widget/widget.html",
  {},
  async (req) => ({
    contents: [
      {
        uri: "ui://widget/widget.html",
        mimeType: "text/html",
        text: `
&lt;div id="kitchen-sink-root">&lt;/div>
&lt;link rel="stylesheet" href="https://persistent.oaistatic.com/ecosystem-built-assets/kitchen-sink-2d2b.css">
&lt;script type="module" src="https://persistent.oaistatic.com/ecosystem-built-assets/kitchen-sink-2d2b.js">&lt;/script>
        `.trim(),
        _meta: {
          "openai/widgetCSP": {
            connect_domains: [],
            resource_domains: ["https://persistent.oaistatic.com"],
          }
        },
      },
    ],
  })
);
```

The CSP should define two arrays of URLs: `connect_domains` and `resource_domains`. These URLs ultimately map to the following CSP definition:

```
`script-src 'self' ${resources}`,
`img-src 'self' data: ${resources}`,
`font-src 'self' ${resources}`,
`connect-src 'self' ${connects}`,
```

### Configure component subdomains

Components also support a configurable subdomain. If you have public API keys (for example Google Maps) and need to restrict access to specific origins or referrers, you can set a subdomain to render the component under.

By default, all components are rendered on `https://web-sandbox.oaiusercontent.com`.

```
"openai/widgetDomain": "https://chatgpt.com"
```

Since we can’t support dynamic dual-level subdomains, we convert the origin `chatgpt.com` to `chatgpt-com` so the final component domain is `https://chatgpt-com.web-sandbox.oaiusercontent.com`.

We can promise that these domains will be unique to each partner.

Note that we still will not permit the storage or access to browser cookies, even with dedicated subdomains.

Configuring a component domain also enables the ChatGPT punchout button in the desktop fullscreen view.

### Configure status strings on tool calls

You can also provide short, localized status strings during and after invocation for better UX:

```
"_meta": {
  "openai/outputTemplate": "ui://widget/kanban-board.html",
  "openai/toolInvocation/invoking": "Organizing tasks…",
  "openai/toolInvocation/invoked": "Board refreshed."
}
```

### Serve localized content

ChatGPT surfaces your connector to a global audience, and the client will advertise the user’s preferred locale during the [MCP initialize handshake](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle). Locale tags follow [IETF BCP 47](https://www.rfc-editor.org/rfc/bcp/bcp47.txt) (for example `en-US`, `fr-FR`, `es-419`). When a server does not echo a supported locale, ChatGPT still renders the connector but informs the user that localization is unavailable. Newer clients set `_meta["openai/locale"]`; older builds may still send `_meta["webplus/i18n"]` for backward compatibility.

During `initialize` the client includes the requested locale in `_meta["openai/locale"]`:

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {},
      "elicitation": {}
    },
    "_meta": {
      "openai/locale": "en-GB"
    },
    "clientInfo": {
      "name": "ChatGPT",
      "title": "ChatGPT",
      "version": "1.0.0"
    }
  }
}
```

Servers that support localization should negotiate the closest match using [RFC 4647](https://datatracker.ietf.org/doc/html/rfc4647) lookup rules and respond with the locale they will serve. Echo `_meta["openai/locale"]` with the resolved tag so the client can display accurate UI messaging:

```
"_meta": {
  "openai/outputTemplate": "ui://widget/kanban-board.html",
  "openai/locale": "en"
}
```

Every subsequent MCP request from ChatGPT repeats the requested locale in `_meta["openai/locale"]` (or `_meta["webplus/i18n"]` on older builds). Include the same metadata key on your responses so the client knows which translation the user received. If a locale is unsupported, fall back to the nearest match (for example respond with `es` when the request is `es-419`) and translate only the strings you manage on the server side. Cached structured data, component props, and prompt templates should all respect the resolved locale.

Inside your handlers, persist the resolved locale along with the session or request context. Use it when formatting numbers, dates, currency, and any natural-language responses returned in `structuredContent` or component props. Testing with MCP Inspector plus varied `_meta` values helps verify that your locale-switching logic runs end to end.

### Inspect client context hints

Operation-phase requests can include extra hints under `_meta.openai/*` so servers can fine-tune responses without new protocol fields. ChatGPT currently forwards:

*   `_meta["openai/userAgent"]` – string identifying the client (for example `ChatGPT/1.2025.012`)
*   `_meta["openai/userLocation"]` – coarse location object hinting at country, region, city, timezone, and approximate coordinates

Treat these values as advisory only; never rely on them for authorization. They are primarily useful for tailoring formatting, regional content, or analytics. When logged, store them alongside the resolved locale and sanitize before sharing outside the service perimeter. Clients may omit either field at any time.

### Add component descriptions

Component descriptions will be displayed to the model when a client renders a tool’s component. It will help the model understand what is being displayed to help avoid the model from returning redundant content in its response. Developers should avoid trying to steer the model’s response in the tool payload directly because not all clients of an MCP render tool components. This metadata lets rich-UI clients steer just those experiences while remaining backward compatible elsewhere.

To use this field, set `openai/widgetDescription` on the resource template inside of your MCP server. Examples below:

**Note:** You must refresh actions on your MCP in dev mode for your description to take effect. It can only be reloaded this way.

```
server.registerResource("html", "ui://widget/widget.html", {}, async () => ({
  contents: [
    {
      uri: "ui://widget/widget.html",
      mimeType: "text/html",
      text: componentHtml,
      _meta: {
        "openai/widgetDescription": "Renders an interactive UI showcasing the zoo animals returned by get_zoo_animals.",
      },
    },
  ],
}));

server.registerTool(
  "get_zoo_animals",
  {
    title: "get_zoo_animals",
    description: "Lists zoo animals and facts about them",
    inputSchema: { count: z.number().int().min(1).max(20).optional() },
    annotations: {
      readOnlyHint: true,
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/widget.html",
    },
  },
  async ({ count = 10 }, _extra) => {
    const animals = generateZooAnimals(count);
    return {
      content: [],
      structuredContent: { animals },
    };
  }
);
```

### Opt into component borders

Widgets that are better suited for a “Card” layout can opt into having a border rendered by ChatGPT when appropriate.

To use this field, set `"openai/widgetPrefersBorder": true` on the resource template inside of your MCP server.

# Build a custom UX

## Overview

UI components turn structured tool results into a human-friendly UI. Apps SDK components are typically React components that run inside an iframe, talk to the host via the `window.openai` API, and render inline with the conversation. This guide describes how to structure your component project, bundle it, and wire it up to your MCP server.

You can also check out the [examples repository on GitHub](https://github.com/openai/openai-apps-sdk-examples).

## Understand the `window.openai` API

`window.openai` is the bridge between your frontend and ChatGPT. Use this quick reference to first understand how to wire up data, state, and layout concerns before you dive into component scaffolding.

```
declare global {
  interface Window {
    openai: API &amp; OpenAiGlobals;
  }

  interface WindowEventMap {
    [SET_GLOBALS_EVENT_TYPE]: SetGlobalsEvent;
  }
}

type OpenAiGlobals&lt;
  ToolInput extends UnknownObject = UnknownObject,
  ToolOutput extends UnknownObject = UnknownObject,
  ToolResponseMetadata extends UnknownObject = UnknownObject,
  WidgetState extends UnknownObject = UnknownObject
> = {
  theme: Theme;
  userAgent: UserAgent;
  locale: string;

  // layout
  maxHeight: number;
  displayMode: DisplayMode;
  safeArea: SafeArea;

  // state
  toolInput: ToolInput;
  toolOutput: ToolOutput | null;
  toolResponseMetadata: ToolResponseMetadata | null;
  widgetState: WidgetState | null;
};

type API&lt;WidgetState extends UnknownObject> = {
  /** Calls a tool on your MCP. Returns the full response. */
  callTool: (name: string, args: Record&lt;string, unknown>) => Promise&lt;CallToolResponse>;
  
  /** Triggers a followup turn in the ChatGPT conversation */
  sendFollowUpMessage: (args: { prompt: string }) => Promise&lt;void>;
  
  /** Opens an external link, redirects web page or mobile app */
  openExternal(payload: { href: string }): void;
  
  /** For transitioning an app from inline to fullscreen or pip */
  requestDisplayMode: (args: { mode: DisplayMode }) => Promise&lt;{
    /**
    * The granted display mode. The host may reject the request.
    * For mobile, PiP is always coerced to fullscreen.
    */
    mode: DisplayMode;
  }>;

  setWidgetState: (state: WidgetState) => Promise&lt;void>;
};

// Dispatched when any global changes in the host page
export const SET_GLOBALS_EVENT_TYPE = "openai:set_globals";
export class SetGlobalsEvent extends CustomEvent&lt;{
  globals: Partial&lt;OpenAiGlobals>;
}> {
  readonly type = SET_GLOBALS_EVENT_TYPE;
}

export type CallTool = (
  name: string,
  args: Record&lt;string, unknown>
) => Promise&lt;CallToolResponse>;

export type DisplayMode = "pip" | "inline" | "fullscreen";

export type Theme = "light" | "dark";

export type SafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type SafeArea = {
  insets: SafeAreaInsets;
};

export type DeviceType = "mobile" | "tablet" | "desktop" | "unknown";

export type UserAgent = {
  device: { type: DeviceType };
  capabilities: {
    hover: boolean;
    touch: boolean;
  };
};
```

### useOpenAiGlobal

Many Apps SDK projects wrap `window.openai` access in small hooks so views remain testable. This example hook listens for host `openai:set_globals` events and lets React components subscribe to a single global value:

```
export function useOpenAiGlobal&lt;K extends keyof OpenAiGlobals>(
  key: K
): OpenAiGlobals[K] {
  return useSyncExternalStore(
    (onChange) => {
      const handleSetGlobal = (event: SetGlobalsEvent) => {
        const value = event.detail.globals[key];
        if (value === undefined) {
          return;
        }

        onChange();
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal, {
        passive: true,
      });

      return () => {
        window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);
      };
    },
    () => window.openai[key]
  );
}
```

`useOpenAiGlobal` is an important primitive to make your app reactive to changes in display mode, theme, and “props” via subsequent tool calls.

For example, read the tool input, output, and metadata:

```
export function useToolInput() {
  return useOpenAiGlobal('toolInput')
}

export function useToolOutput() {
  return useOpenAiGlobal('toolOutput')
}

export function useToolResponseMetadata() {
  return useOpenAiGlobal('toolResponseMetadata')
}
```

### Persist component state, expose context to ChatGPT

Widget state can be used for persisting data across user sessions, and exposing data to ChatGPT. Anything you pass to `setWidgetState` will be shown to the model, and hydrated into `window.openai.widgetState`.

Note that currently everything passed to `setWidgetState` is shown to the model. For the best performance, it’s advisable to keep this payload small, and to not exceed more than 4k [tokens](https://platform.openai.com/tokenizer).

### Trigger server actions

`window.openai.callTool` lets the component directly make MCP tool calls. Use this for direct manipulations (refresh data, fetch nearby restaurants). Design tools to be idempotent where possible and return updated structured content that the model can reason over in subsequent turns.

Please note that your tool needs to be marked as [able to be initiated by the component](https://developers.openai.com/apps-sdk/build/mcp-server###allow-component-initiated-tool-access).

```
async function refreshPlaces(city: string) {
  await window.openai?.callTool("refresh_pizza_list", { city });
}
```

### Send conversational follow-ups

Use `window.openai.sendFollowupMessage` to insert a message into the conversation as if the user asked it.

```
await window.openai?.sendFollowupMessage({
  prompt: "Draft a tasting itinerary for the pizzerias I favorited.",
});
```

### Request alternate layouts

If the UI needs more space—like maps, tables, or embedded editors—ask the host to change the container. `window.openai.requestDisplayMode` negotiates inline, PiP, or fullscreen presentations.

```
await window.openai?.requestDisplayMode({ mode: "fullscreen" });
// Note: on mobile, PiP may be coerced to fullscreen
```

### Use host-backed navigation

Skybridge (the sandbox runtime) mirrors the iframe’s history into ChatGPT’s UI. Use standard routing APIs—such as React Router—and the host will keep navigation controls in sync with your component.

Router setup (React Router’s `BrowserRouter`):

```
export default function PizzaListRouter() {
  return (
    &lt;BrowserRouter>
      &lt;Routes>
        &lt;Route path="/" element={&lt;PizzaListApp />}>
          &lt;Route path="place/:placeId" element={&lt;PizzaListApp />} />
        &lt;/Route>
      &lt;/Routes>
    &lt;/BrowserRouter>
  );
}
```

Programmatic navigation:

```
const navigate = useNavigate();

function openDetails(placeId: string) {
  navigate(`place/${placeId}`, { replace: false });
}

function closeDetails() {
  navigate("..", { replace: true });
}
```

## Scaffold the component project

Now that you understand the `window.openai` API, it’s time to scaffold your component project.

As best practice, keep the component code separate from your server logic. A common layout is:

```
app/
  server/            # MCP server (Python or Node)
  web/               # Component bundle source
    package.json
    tsconfig.json
    src/component.tsx
    dist/component.js   # Build output
```

Create the project and install dependencies (Node 18+ recommended):

```
cd app/web
npm init -y
npm install react@^18 react-dom@^18
npm install -D typescript esbuild
```

If your component requires drag-and-drop, charts, or other libraries, add them now. Keep the dependency set lean to reduce bundle size.

Your entry file should mount a component into a `root` element and read initial data from `window.openai.toolOutput` or persisted state.

We have provided some example apps under the [examples page](https://developers.openai.com/apps-sdk/build/examples#pizzaz-list-source), for example, for a “Pizza list” app, which is a list of pizza restaurants. As you can see in the source code, the pizza list React component does the following:

1.  **Mount into the host shell.** The Skybridge HTML template exposes `div#pizzaz-list-root`. The component mounts with `createRoot(document.getElementById("pizzaz-list-root")).render(&lt;PizzaListApp />)` so the entire UI stays encapsulated inside the iframe.
2.  **Subscribe to host globals.** Inside `PizzaListApp`, hooks such as `useOpenAiGlobal("displayMode")` and `useOpenAiGlobal("maxHeight")` read layout preferences directly from `window.openai`. This keeps the list responsive between inline and fullscreen layouts without custom postMessage plumbing.
3.  **Render from tool output.** The component treats `window.openai.toolOutput` as the authoritative source of places returned by your tool. `widgetState` seeds any user-specific state (like favorites or filters) so the UI restores after refreshes.
4.  **Persist state and call host actions.** When a user toggles a favorite, the component updates React state and immediately calls `window.openai.setWidgetState` with the new favorites array. Optional buttons can trigger `window.openai.requestDisplayMode({ mode: "fullscreen" })` or `window.openai.callTool("refresh_pizza_list", { city })` when more space or fresh data is needed.

### Explore the Pizzaz component gallery

We provide a number of example components in the [Apps SDK examples](https://developers.openai.com/apps-sdk/build/examples). Treat them as blueprints when shaping your own UI:

Each example shows how to bundle assets, wire host APIs, and structure state for real conversations. Copy the one closest to your use case and adapt the data layer for your tool responses.

### React helper hooks

Using `useOpenAiGlobal` in a `useWidgetState` hook to keep host-persisted widget state aligned with your local React state:

```
export function useWidgetState&lt;T extends WidgetState>(
  defaultState: T | (() => T)
): readonly [T, (state: SetStateAction&lt;T>) => void];
export function useWidgetState&lt;T extends WidgetState>(
  defaultState?: T | (() => T | null) | null
): readonly [T | null, (state: SetStateAction&lt;T | null>) => void];
export function useWidgetState&lt;T extends WidgetState>(
  defaultState?: T | (() => T | null) | null
): readonly [T | null, (state: SetStateAction&lt;T | null>) => void] {
  const widgetStateFromWindow = useWebplusGlobal("widgetState") as T;

  const [widgetState, _setWidgetState] = useState&lt;T | null>(() => {
    if (widgetStateFromWindow != null) {
      return widgetStateFromWindow;
    }

    return typeof defaultState === "function"
      ? defaultState()
      : defaultState ?? null;
  });

  useEffect(() => {
    _setWidgetState(widgetStateFromWindow);
  }, [widgetStateFromWindow]);

  const setWidgetState = useCallback(
    (state: SetStateAction&lt;T | null>) => {
      _setWidgetState((prevState) => {
        const newState = typeof state === "function" ? state(prevState) : state;

        if (newState != null) {
          window.openai.setWidgetState(newState);
        }

        return newState;
      });
    },
    [window.openai.setWidgetState]
  );

  return [widgetState, setWidgetState] as const;
}
```

The hooks above make it easy to read the latest tool output, layout globals, or widget state directly from React components while still delegating persistence back to ChatGPT.

## Bundle for the iframe

Once you are done writing your React component, you can build it into a single JavaScript module that the server can inline:

```
// package.json
{
  "scripts": {
    "build": "esbuild src/component.tsx --bundle --format=esm --outfile=dist/component.js"
  }
}
```

Run `npm run build` to produce `dist/component.js`. If esbuild complains about missing dependencies, confirm you ran `npm install` in the `web/` directory and that your imports match installed package names (e.g., `@react-dnd/html5-backend` vs `react-dnd-html5-backend`).

## Embed the component in the server response

See the [Set up your server docs](https://developers.openai.com/apps-sdk/build/mcp-server#) for how to embed the component in your MCP server response.

Component UI templates are the recommended path for production.

During development you can rebuild the component bundle whenever your React code changes and hot-reload the server.

# Authentication

## Authenticate your users

Many Apps SDK apps can operate in a read-only, anonymous mode, but anything that exposes customer-specific data or write actions should authenticate users.

You can integrate with your own authorization server when you need to connect to an existing backend or share data between users.

## Custom auth with OAuth 2.1

When you need to talk to an external system—CRM records, proprietary APIs, shared datasets—you can integrate a full OAuth 2.1 flow that conforms to the [MCP authorization spec](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization).

### Components

*   **Resource server** – your MCP server, which exposes tools and verifies access tokens on each request.
*   **Authorization server** – your identity provider (Auth0, Okta, Cognito, or a custom implementation) that issues tokens and publishes discovery metadata.
*   **Client** – ChatGPT acting on behalf of the user. It supports dynamic client registration and PKCE.

### Required endpoints

Your authorization server must provide:

*   `/.well-known/oauth-protected-resource` – lists the authorization servers and required scopes for your MCP endpoint.
*   `/.well-known/openid-configuration` – discovery document. It must include:
    *   `authorization_endpoint`
    *   `token_endpoint` (often `/oauth/token`)
    *   `jwks_uri`
    *   `registration_endpoint`
*   `token_endpoint` – accepts code+PKCE exchanges and returns access tokens.
*   `registration_endpoint` – accepts dynamic client registration requests and returns a `client_id`.

### Flow in practice

1.  ChatGPT queries your MCP server for protected resource metadata. You can configure this with `AuthSettings` in the official Python SDK’s FastMCP module.
2.  ChatGPT registers itself with your authorization server using the `registration_endpoint` and obtains a `client_id`.
3.  When the user first invokes a tool, the ChatGPT client launches the OAuth authorization code + PKCE flow. The user authenticates and consents to the requested scopes.
4.  ChatGPT exchanges the authorization code for an access token and attaches it to subsequent MCP requests (`Authorization: Bearer &lt;token>`).
5.  Your server verifies the token on each request (issuer, audience, expiration, scopes) before executing the tool.

### Implementing verification

The official Python SDK’s FastMCP module ships with helpers for token verification. A simplified example:

File: `server.py`

```
from mcp.server.fastmcp import FastMCP
from mcp.server.auth.settings import AuthSettings
from mcp.server.auth.provider import TokenVerifier, AccessToken

class MyVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> AccessToken | None:
        payload = validate_jwt(token, jwks_url)
        if "user" not in payload.get("permissions", []):
            return None
        return AccessToken(
            token=token,
            client_id=payload["azp"],
            subject=payload["sub"],
            scopes=payload.get("permissions", []),
            claims=payload,
        )

mcp = FastMCP(
    name="kanban-mcp",
    stateless_http=True,
    token_verifier=MyVerifier(),
    auth=AuthSettings(
        issuer_url="https://your-tenant.us.auth0.com",
        resource_server_url="https://example.com/mcp",
        required_scopes=["user"],
    ),
)
```

If verification fails, respond with `401 Unauthorized` and a `WWW-Authenticate` header that points back to your protected-resource metadata. This tells the client to run the OAuth flow again.

[Auth0](https://auth0.com/) is a popular option and supports dynamic client registration, RBAC, and token introspection out of the box. To configure it:

1.  Create an API in the Auth0 dashboard and record the identifier (used as the token audience).
2.  Enable RBAC and add permissions (for example `user`) so they are embedded in the access token.
3.  Turn on OIDC dynamic application registration so ChatGPT can create a client per connector.
4.  Ensure at least one login connection is enabled for dynamically created clients so users can sign in.

Okta, Azure AD, and custom OAuth 2.1 servers can follow the same pattern as long as they expose the required metadata.

## Testing and rollout

*   **Local testing** – start with a development tenant that issues short-lived tokens so you can iterate quickly.
*   **Dogfood** – once authentication works, gate access to trusted testers before rolling out broadly. You can require linking for specific tools or the entire connector.
*   **Rotation** – plan for token revocation, refresh, and scope changes. Your server should treat missing or stale tokens as unauthenticated and return a helpful error message.

With authentication in place you can confidently expose user-specific data and write actions to ChatGPT users.

Different tools often have different access requirements. Listing tools without auth improves discovery and developer ergonomics, but you should enforce authentication at call time for any tool that needs it. Declaring the requirement in metadata helps clients guide the user, while your server remains the source of truth for enforcement.

Our recommendation is to:

*   Keep your server discoverable (no auth required for listing)
*   Enforce auth per tool call

Scope and semantics:

*   Supported scheme types (initial):
    *   “noauth” — callable anonymously
    *   “oauth2” — requires OAuth 2.0; optional scopes
*   Missing field: inherit the server default policy
*   Both “noauth” and “oauth2”: anonymous works, but authenticating in will unlock more behavior
*   Servers must enforce regardless of client hints

You should declare auth requirements in the first-class `securitySchemes` field on each tool. Clients use this to guide users; your server must still validate tokens/scopes on every invocation.

Example (public + optional auth) – TypeScript SDK

```
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

declare const server: McpServer;

server.registerTool(
  "search",
  {
    title: "Public Search",
    description: "Search public documents.",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string" } },
      required: ["q"],
    },
    securitySchemes: [
      { type: "noauth" },
      { type: "oauth2", scopes: ["search.read"] },
    ],
  },
  async ({ input }) => {
    return {
      content: [{ type: "text", text: `Results for ${input.q}` }],
      structuredContent: {},
    };
  }
);
```

Example (auth required) – TypeScript SDK

```
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

declare const server: McpServer;

server.registerTool(
  "create_doc",
  {
    title: "Create Document",
    description: "Make a new doc in your account.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    },
    securitySchemes: [{ type: "oauth2", scopes: ["docs.write"] }],
  },
  async ({ input }) => {
    return {
      content: [{ type: "text", text: `Created doc: ${input.title}` }],
      structuredContent: {},
    };
  }
);
```

# Storage

## Why storage matters

Apps SDK handles conversation state automatically, but most real-world apps also need durable storage. You might cache fetched data, keep track of user preferences, or persist artifacts created inside a component. Choosing the right storage model upfront keeps your connector fast, reliable, and compliant.

## Bring your own backend

If you already run an API or need multi-user collaboration, integrate with your existing storage layer. In this model:

*   Authenticate the user via OAuth (see [Authentication](https://developers.openai.com/apps-sdk/build/auth)) so you can map ChatGPT identities to your internal accounts.
*   Use your backend’s APIs to fetch and mutate data. Keep latency low; users expect components to render in a few hundred milliseconds.
*   Return sufficient structured content so the model can understand the data even if the component fails to load.

When you roll your own storage, plan for:

*   **Data residency and compliance** – ensure you have agreements in place before transferring PII or regulated data.
*   **Rate limits** – protect your APIs against bursty traffic from model retries or multiple active components.
*   **Versioning** – include schema versions in stored objects so you can migrate them without breaking existing conversations.

## Persisting component state

Regardless of where you store authoritative data, design a clear state contract:

*   Use `window.openai.setWidgetState` for ephemeral UI state (selected tab, collapsed sections). This state travels with the conversation and is ideal for restoring context after a follow-up prompt.
*   Persist durable artifacts in your backend or the managed storage layer. Include identifiers in both the structured content and the `widgetState` payload so you can correlate them later.
*   Handle merge conflicts gracefully: if another user updates the underlying data, refresh the component via a follow-up tool call and explain the change in the chat transcript.

## Operational tips

*   **Backups and monitoring** – treat MCP traffic like any other API. Log tool calls with correlation IDs and monitor for error spikes.
*   **Data retention** – set clear policies for how long you keep user data and how users can revoke access.
*   **Dogfood first** – run the storage path with internal testers before launching broadly so you can validate quotas, schema evolutions, and replay scenarios.

With a storage strategy in place you can safely handle read and write scenarios without compromising user trust.

# Deploy your app

## Deployment options

Once you have a working MCP server and component bundle, host them behind a stable HTTPS endpoint. Deployment platforms that work well with Apps SDK include:

*   **Managed containers** – Fly.io, Render, or Railway for quick spin-up and automatic TLS.
*   **Cloud serverless** – Google Cloud Run or Azure Container Apps if you need scale-to-zero, keeping in mind that long cold starts can interrupt streaming HTTP.
*   **Kubernetes** – for teams that already run clusters. Front your pods with an ingress controller that supports server-sent events.

Regardless of platform, make sure `/mcp` stays responsive, supports streaming responses, and returns appropriate HTTP status codes for errors.

## Local development

During development you can expose your local server to ChatGPT using a tunnel such as ngrok:

```
ngrok http 2091
# https://&lt;subdomain>.ngrok.app/mcp → http://127.0.0.1:2091/mcp
```

Keep the tunnel running while you iterate on your connector. When you change code:

1.  Rebuild the component bundle (`npm run build`).
2.  Restart your MCP server.
3.  Refresh the connector in ChatGPT settings to pull the latest metadata.

## Environment configuration

*   **Secrets** – store API keys or OAuth client secrets outside your repo. Use platform-specific secret managers and inject them as environment variables.
*   **Logging** – log tool-call IDs, request latency, and error payloads. This helps debug user reports once the connector is live.
*   **Observability** – monitor CPU, memory, and request counts so you can right-size your deployment.

## Dogfood and rollout

Before launching broadly:

1.  **Gate access** – keep your connector behind developer mode or a Statsig experiment flag until you are confident in stability.
2.  **Run golden prompts** – exercise the discovery prompts you drafted during planning and note precision/recall changes with each release.
3.  **Capture artifacts** – record screenshots or screen captures showing the component in MCP Inspector and ChatGPT for reference.

When you are ready for production, update directory metadata, confirm auth and storage are configured correctly, and publish change notes in [Release Notes](https://developers.openai.com/apps-sdk/release-notes).

## Next steps

*   Connect your deployed endpoint to ChatGPT using the steps in [Connect from ChatGPT](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt).
*   Validate tooling and telemetry with the [Test your integration](https://developers.openai.com/apps-sdk/deploy/testing) guide.
*   Keep a troubleshooting playbook handy via [Troubleshooting](https://developers.openai.com/apps-sdk/deploy/troubleshooting) so on-call responders can quickly diagnose issues.

# Test your integration

## Goals

Testing validates that your connector behaves predictably before you expose it to users. Focus on three areas: tool correctness, component UX, and discovery precision.

*   Exercise each tool function directly with representative inputs. Verify schema validation, error handling, and edge cases (empty results, missing IDs).
*   Include automated tests for authentication flows if you issue tokens or require linking.
*   Keep test fixtures close to your MCP code so they stay up to date as schemas evolve.

## Use MCP Inspector during development

The [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) is the fastest way to debug your server locally:

1.  Run your MCP server.
2.  Launch the inspector: `npx @modelcontextprotocol/inspector@latest`.
3.  Enter your server URL (for example `http://127.0.0.1:2091/mcp`).
4.  Click **List Tools** and **Call Tool** to inspect the raw requests and responses.

Inspector renders components inline and surfaces errors immediately. Capture screenshots for your launch review.

## Validate in ChatGPT developer mode

After your connector is reachable over HTTPS:

*   Link it in **Settings → Connectors → Developer mode**.
*   Toggle it on in a new conversation and run through your golden prompt set (direct, indirect, negative). Record when the model selects the right tool, what arguments it passed, and whether confirmation prompts appear as expected.
*   Test mobile layouts by invoking the connector in the ChatGPT iOS or Android apps.

## Connect via the API Playground

If you need raw logs or want to test without the full ChatGPT UI, open the [API Playground](https://platform.openai.com/playground):

1.  Choose **Tools → Add → MCP Server**.
2.  Provide your HTTPS endpoint and connect.
3.  Issue test prompts and inspect the JSON request/response pairs in the right-hand panel.

## Regression checklist before launch

*   Tool list matches your documentation and unused prototypes are removed.
*   Structured content matches the declared `outputSchema` for every tool.
*   Widgets render without console errors, inject their own styling, and restore state correctly.
*   OAuth or custom auth flows return valid tokens and reject invalid ones with meaningful messages.
*   Discovery behaves as expected across your golden prompts and does not trigger on negative prompts.

Capture findings in a doc so you can compare results release over release. Consistent testing keeps your connector reliable as ChatGPT and your backend evolve.

# Optimize Metadata

ChatGPT decides when to call your connector based on the metadata you provide. Well-crafted names, descriptions, and parameter docs increase recall on relevant prompts and reduce accidental activations. Treat metadata like product copy—it needs iteration, testing, and analytics.

## Gather a golden prompt set

Before you tune metadata, assemble a labelled dataset:

*   **Direct prompts** – users explicitly name your product or data source.
*   **Indirect prompts** – users describe the outcome they want without naming your tool.
*   **Negative prompts** – cases where built-in tools or other connectors should handle the request.

Document the expected behaviour for each prompt (call your tool, do nothing, or use an alternative). You will reuse this set during regression testing.

For each tool:

*   **Name** – pair the domain with the action (`calendar.create_event`).
*   **Description** – start with “Use this when…” and call out disallowed cases (“Do not use for reminders”).
*   **Parameter docs** – describe each argument, include examples, and use enums for constrained values.
*   **Read-only hint** – annotate `readOnlyHint: true` on tools that never mutate state so ChatGPT can streamline confirmation.

At the app level supply a polished description, icon, and any starter prompts or sample conversations that highlight your best use cases.

## Evaluate in developer mode

1.  Link your connector in ChatGPT developer mode.
2.  Run through the golden prompt set and record the outcome: which tool was selected, what arguments were passed, and whether the component rendered.
3.  For each prompt, track precision (did the right tool run?) and recall (did the tool run when it should?).

If the model picks the wrong tool, revise the descriptions to emphasise the intended scenario or narrow the tool’s scope.

## Iterate methodically

*   Change one metadata field at a time so you can attribute improvements.
*   Keep a log of revisions with timestamps and test results.
*   Share diffs with reviewers to catch ambiguous copy before you deploy it.

After each revision, repeat the evaluation. Aim for high precision on negative prompts before chasing marginal recall improvements.

## Production monitoring

Once your connector is live:

*   Review tool-call analytics weekly. Spikes in “wrong tool” confirmations usually indicate metadata drift.
*   Capture user feedback and update descriptions to cover common misconceptions.
*   Schedule periodic prompt replays, especially after adding new tools or changing structured fields.

Treat metadata as a living asset. The more intentional you are with wording and evaluation, the easier discovery and invocation become.

# Connect from ChatGPT

## Before you begin

Connecting your MCP server to ChatGPT requires developer mode access:

1.  Ask your OpenAI partner contact to add you to the connectors developer experiment.
2.  If you are on ChatGPT Enterprise, have your workspace admin enable connector creation for your account.
3.  Toggle **Settings → Connectors → Advanced → Developer mode** in the ChatGPT client.

Once developer mode is active you will see a **Create** button under Settings → Connectors.

## Create a connector

1.  Ensure your MCP server is reachable over HTTPS (for local development, expose it via ngrok).
2.  In ChatGPT, navigate to **Settings → Connectors → Create**.
3.  Provide the metadata for your connector:
    *   **Connector name** – a user-facing title such as _Kanban board_.
    *   **Description** – explain what the connector does and when to use it. The model uses this text during discovery.
    *   **Connector URL** – the public `/mcp` endpoint of your server (for example `https://abc123.ngrok.app/mcp`).
4.  Click **Create**. If the connection succeeds you will see a list of the tools your server advertises. If it fails, use the [Testing](https://developers.openai.com/apps-sdk/deploy/testing) guide to debug with MCP Inspector or the API Playground.

## Enable the connector in a conversation

1.  Open a new chat in ChatGPT.
2.  Click the **+** button near the message composer and choose **Developer mode**.
3.  Toggle on your connector in the list of available tools. Linked tools are now available for the assistant to call automatically.
4.  Prompt the model explicitly while you validate the integration. For example, “Use the Kanban board connector to show my tasks.” Once discovery metadata is dialled in you can rely on indirect prompts.

ChatGPT will display tool-call payloads in the UI so you can confirm inputs and outputs. Write tools will require manual confirmation unless you choose to remember approvals for the conversation.

Whenever you change your tool list or descriptions:

1.  Update your MCP server and redeploy it.
2.  In **Settings → Connectors**, click into your connector and choose **Refresh**.
3.  Verify the tool list updates and try a few prompts to ensure discovery still works.

## Connecting other clients

*   **API Playground** – visit `https://platform.openai.com/playground`, open **Tools → Add → MCP Server**, and paste the same HTTPS endpoint. This is useful when you want raw request/response logs.
*   **Mobile clients** – once the connector is linked on web it is available on ChatGPT mobile apps as well. Test mobile layouts early if your component has custom controls.

With the connector linked you can move on to validation, experiments, and eventual rollout.

# Examples

## Overview

The Pizzaz demo app bundles a handful of UI components so you can see the full tool surface area end-to-end. The following sections walk through the MCP server and the component implementations that power those tools. You can find the “Pizzaz” demo app and other examples in our [examples repository on GitHub](https://github.com/openai/openai-apps-sdk-examples).

Use these examples as blueprints when you assemble your own app.

## MCP Source

This TypeScript server shows how to register multiple tools that share data with pre-built UI resources. Each resource call returns a Skybridge HTML shell, and every tool responds with matching metadata so ChatGPT knows which component to render.

```
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

declare const server: McpServer;

// UI resource (no inline data assignment; host will inject data)
server.registerResource(
  "pizza-map",
  "ui://widget/pizza-map.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://widget/pizza-map.html",
        mimeType: "text/html+skybridge",
        text: `
&lt;div id="pizzaz-root">&lt;/div>
&lt;link rel="stylesheet" href="https://persistent.oaistatic.com/ecosystem-built-assets/pizzaz-0038.css">
&lt;script type="module" src="https://persistent.oaistatic.com/ecosystem-built-assets/pizzaz-0038.js">&lt;/script>
        `.trim(),
      },
    ],
  })
);

server.registerTool(
  "pizza-map",
  {
    title: "Show Pizza Map",
    _meta: {
      "openai/outputTemplate": "ui://widget/pizza-map.html",
      "openai/toolInvocation/invoking": "Hand-tossing a map",
      "openai/toolInvocation/invoked": "Served a fresh map",
    },
    inputSchema: { pizzaTopping: z.string() },
  },
  async () => {
    return {
      content: [{ type: "text", text: "Rendered a pizza map!" }],
      structuredContent: {},
    };
  }
);

server.registerResource(
  "pizza-carousel",
  "ui://widget/pizza-carousel.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://widget/pizzaz-carousel.html",
        mimeType: "text/html+skybridge",
        text: `
&lt;div id="pizzaz-carousel-root">&lt;/div>
&lt;link rel="stylesheet" href="https://persistent.oaistatic.com/ecosystem-built-assets/pizzaz-carousel-0038.css">
&lt;script type="module" src="https://persistent.oaistatic.com/ecosystem-built-assets/pizzaz-carousel-0038.js">&lt;/script>
        `.trim(),
      },
    ],
  })
);

server.registerTool(
  "pizza-carousel",
  {
    title: "Show Pizza Carousel",
    _meta: {
      "openai/outputTemplate": "ui://widget/pizza-carousel.html",
      "openai/toolInvocation/invoking": "Carousel some spots",
      "openai/toolInvocation/invoked": "Served a fresh carousel",
    },
    inputSchema: { pizzaTopping: z.string() },
  },
  async () => {
    return {
      content: [{ type: "text", text: "Rendered a pizza carousel!" }],
      structuredContent: {},
    };
  }
);

server.registerResource(
  "pizza-albums",
  "ui://widget/pizza-albums.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://widget/pizzaz-albums.html",
        mimeType: "text/html+skybridge",
        text: `
&lt;div id="pizzaz-albums-root">&lt;/div>
&lt;link rel="stylesheet" href="https://persistent.oaistatic.com/ecosystem-built-assets/pizzaz-albums-0038.css">
&lt;script type="module" src="https://persistent.oaistatic.com/ecosystem-built-assets/pizzaz-albums-0038.js">&lt;/script>
        `.trim(),
      },
    ],
  })
);

server.registerTool(
  "pizza-albums",
  {
    title: "Show Pizza Album",
    _meta: {
      "openai/outputTemplate": "ui://widget/pizza-albums.html",
      "openai/toolInvocation/invoking": "Hand-tossing an album",
      "openai/toolInvocation/invoked": "Served a fresh album",
    },
    inputSchema: { pizzaTopping: z.string() },
  },
  async () => {
    return {
      content: [{ type: "text", text: "Rendered a pizza album!" }],
      structuredContent: {},
    };
  }
);

server.registerResource(
  "pizza-list",
  "ui://widget/pizza-list.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://widget/pizzaz-list.html",
        mimeType: "text/html+skybridge",
        text: `
&lt;div id="pizzaz-list-root">&lt;/div>
&lt;link rel="stylesheet" href="https://persistent.oaistatic.com/ecosystem-built-assets/pizzaz-list-0038.css">
&lt;script type="module" src="https://persistent.oaistatic.com/ecosystem-built-assets/pizzaz-list-0038.js">&lt;/script>
        `.trim(),
      },
    ],
  })
);

server.registerTool(
  "pizza-list",
  {
    title: "Show Pizza List",
    _meta: {
      "openai/outputTemplate": "ui://widget/pizza-list.html",
      "openai/toolInvocation/invoking": "Hand-tossing a list",
      "openai/toolInvocation/invoked": "Served a fresh list",
    },
    inputSchema: { pizzaTopping: z.string() },
  },
  async () => {
    return {
      content: [{ type: "text", text: "Rendered a pizza list!" }],
      structuredContent: {},
    };
  }
);

server.registerResource(
  "pizza-video",
  "ui://widget/pizza-video.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://widget/pizzaz-video.html",
        mimeType: "text/html+skybridge",
        text: `
&lt;div id="pizzaz-video-root">&lt;/div>
&lt;link rel="stylesheet" href="https://persistent.oaistatic.com/ecosystem-built-assets/pizzaz-video-0038.css">
&lt;script type="module" src="https://persistent.oaistatic.com/ecosystem-built-assets/pizzaz-video-0038.js">&lt;/script>
        `.trim(),
      },
    ],
  })
);

server.registerTool(
  "pizza-video",
  {
    title: "Show Pizza Video",
    _meta: {
      "openai/outputTemplate": "ui://widget/pizza-video.html",
      "openai/toolInvocation/invoking": "Hand-tossing a video",
      "openai/toolInvocation/invoked": "Served a fresh video",
    },
    inputSchema: { pizzaTopping: z.string() },
  },
  async () => {
    return {
      content: [{ type: "text", text: "Rendered a pizza video!" }],
      structuredContent: {},
    };
  }
);
```

## Pizzaz Map Source

![Screenshot of the Pizzaz map component](https://developers.openai.com/images/apps-sdk/pizzaz-map.png)

The map component is a React + Mapbox client that syncs its state back to ChatGPT. It renders marker interactions, inspector routing, and fullscreen handling so you can study a heavier, stateful component example.

```
import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createRoot } from "react-dom/client";
import markers from "./markers.json";
import { AnimatePresence } from "framer-motion";
import Inspector from "./Inspector";
import Sidebar from "./Sidebar";
import { useOpenaiGlobal } from "../use-openai-global";
import { useMaxHeight } from "../use-max-height";
import { Maximize2 } from "lucide-react";
import {
  useNavigate,
  useLocation,
  Routes,
  Route,
  BrowserRouter,
  Outlet,
} from "react-router-dom";

mapboxgl.accessToken =
  "pk.eyJ1IjoiZXJpY25pbmciLCJhIjoiY21icXlubWM1MDRiczJvb2xwM2p0amNyayJ9.n-3O6JI5nOp_Lw96ZO5vJQ";

function fitMapToMarkers(map, coords) {
  if (!map || !coords.length) return;
  if (coords.length === 1) {
    map.flyTo({ center: coords[0], zoom: 12 });
    return;
  }
  const bounds = coords.reduce(
    (b, c) => b.extend(c),
    new mapboxgl.LngLatBounds(coords[0], coords[0])
  );
  map.fitBounds(bounds, { padding: 60, animate: true });
}

export default function App() {
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markerObjs = useRef([]);
  const places = markers?.places || [];
  const markerCoords = places.map((p) => p.coords);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedId = React.useMemo(() => {
    const match = location?.pathname?.match(/(?:^|\/)place\/([^/]+)/);
    return match &amp;&amp; match[1] ? match[1] : null;
  }, [location?.pathname]);
  const selectedPlace = places.find((p) => p.id === selectedId) || null;
  const [viewState, setViewState] = useState(() => ({
    center: markerCoords.length > 0 ? markerCoords[0] : [0, 0],
    zoom: markerCoords.length > 0 ? 12 : 2,
  }));
  const displayMode = useOpenaiGlobal("displayMode");
  const allowInspector = displayMode === "fullscreen";
  const maxHeight = useMaxHeight() ?? undefined;

  useEffect(() => {
    if (mapObj.current) return;
    mapObj.current = new mapboxgl.Map({
      container: mapRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: markerCoords.length > 0 ? markerCoords[0] : [0, 0],
      zoom: markerCoords.length > 0 ? 12 : 2,
      attributionControl: false,
    });
    addAllMarkers(places);
    setTimeout(() => {
      fitMapToMarkers(mapObj.current, markerCoords);
    }, 0);
    // after first paint
    requestAnimationFrame(() => mapObj.current.resize());

    // or keep it in sync with window resizes
    window.addEventListener("resize", mapObj.current.resize);

    return () => {
      window.removeEventListener("resize", mapObj.current.resize);
      mapObj.current.remove();
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!mapObj.current) return;
    const handler = () => {
      const c = mapObj.current.getCenter();
      setViewState({ center: [c.lng, c.lat], zoom: mapObj.current.getZoom() });
    };
    mapObj.current.on("moveend", handler);
    return () => {
      mapObj.current.off("moveend", handler);
    };
  }, []);

  function addAllMarkers(placesList) {
    markerObjs.current.forEach((m) => m.remove());
    markerObjs.current = [];
    placesList.forEach((place) => {
      const marker = new mapboxgl.Marker({
        color: "#F46C21",
      })
        .setLngLat(place.coords)
        .addTo(mapObj.current);
      const el = marker.getElement();
      if (el) {
        el.style.cursor = "pointer";
        el.addEventListener("click", () => {
          navigate(`place/${place.id}`);
          panTo(place.coords, { offsetForInspector: true });
        });
      }
      markerObjs.current.push(marker);
    });
  }

  function getInspectorHalfWidthPx() {
    if (displayMode !== "fullscreen") return 0;
    if (typeof window === "undefined") return 0;
    const isLgUp =
      window.matchMedia &amp;&amp; window.matchMedia("(min-width: 1024px)").matches;
    if (!isLgUp) return 0;
    const el = document.querySelector(".pizzaz-inspector");
    const w = el ? el.getBoundingClientRect().width : 360;
    return Math.round(w / 2);
  }

  function panTo(
    coord,
    { offsetForInspector } = { offsetForInspector: false }
  ) {
    if (!mapObj.current) return;
    const halfInspector = offsetForInspector ? getInspectorHalfWidthPx() : 0;
    const flyOpts = {
      center: coord,
      zoom: 14,
      speed: 1.2,
      curve: 1.6,
    };
    if (halfInspector) {
      flyOpts.offset = [-halfInspector, 0];
    }
    mapObj.current.flyTo(flyOpts);
  }

  useEffect(() => {
    if (!mapObj.current) return;
    addAllMarkers(places);
  }, [places]);

  // Pan the map when the selected place changes via routing
  useEffect(() => {
    if (!mapObj.current || !selectedPlace) return;
    panTo(selectedPlace.coords, { offsetForInspector: true });
  }, [selectedId]);

  // Ensure Mapbox resizes when container maxHeight/display mode changes
  useEffect(() => {
    if (!mapObj.current) return;
    mapObj.current.resize();
  }, [maxHeight, displayMode]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &amp;&amp;
      window.oai &amp;&amp;
      typeof window.oai.widget.setState === "function"
    ) {
      window.oai.widget.setState({
        center: viewState.center,
        zoom: viewState.zoom,
        markers: markerCoords,
      });
    }
  }, [viewState, markerCoords]);

  return (
    &lt;div
      style={{
        maxHeight,
        height: displayMode === "fullscreen" ? maxHeight : 480,
      }}
      className={
        "relative antialiased w-full min-h-[480px] overflow-hidden " +
        (displayMode === "fullscreen"
          ? "rounded-none border-0"
          : "border border-black/10 dark:border-white/10 rounded-2xl sm:rounded-3xl")
      }
    >
      &lt;Outlet />
      {displayMode !== "fullscreen" &amp;&amp; (
        &lt;button
          aria-label="Enter fullscreen"
          className="absolute top-4 right-4 z-30 rounded-full bg-white text-black shadow-lg ring ring-black/5 p-2.5 pointer-events-auto"
          onClick={() => {
            if (selectedId) {
              navigate("..", { replace: true });
            }
            if (window?.openai?.requestDisplayMode) {
              window.openai.requestDisplayMode({ mode: "fullscreen" });
            }
          }}
        >
          &lt;Maximize2
            strokeWidth={1.5}
            className="h-4.5 w-4.5"
            aria-hidden="true"
          />
        &lt;/button>
      )}
      {/* Sidebar */}
      &lt;Sidebar
        places={places}
        selectedId={selectedId}
        onSelect={(place) => {
          navigate(`place/${place.id}`);
          panTo(place.coords, { offsetForInspector: true });
        }}
      />

      {/* Inspector (right) */}
      &lt;AnimatePresence>
        {allowInspector &amp;&amp; selectedPlace &amp;&amp; (
          &lt;Inspector
            key={selectedPlace.id}
            place={selectedPlace}
            onClose={() => navigate("..")}
          />
        )}
      &lt;/AnimatePresence>

      {/* Map */}
      &lt;div
        className={
          "absolute inset-0 overflow-hidden" +
          (displayMode === "fullscreen"
            ? " md:left-[340px] md:right-4 md:top-4 md:bottom-4 border border-black/10 md:rounded-3xl"
            : "")
        }
      >
        &lt;div
          ref={mapRef}
          className="w-full h-full relative absolute bottom-0 left-0 right-0"
          style={{
            maxHeight,
            height: displayMode === "fullscreen" ? maxHeight : undefined,
          }}
        />
      &lt;/div>
    &lt;/div>
  );
}

function RouterRoot() {
  return (
    &lt;Routes>
      &lt;Route path="*" element={&lt;App />}>
        &lt;Route path="place/:placeId" element={&lt;>&lt;/>} />
      &lt;/Route>
    &lt;/Routes>
  );
}

createRoot(document.getElementById("pizzaz-root")).render(
  &lt;BrowserRouter>
    &lt;RouterRoot />
  &lt;/BrowserRouter>
);
```

## Pizzaz Carousel Source

![Screenshot of the Pizzaz carousel component](https://developers.openai.com/images/apps-sdk/pizzaz-carousel.png)

This carousel demonstrates how to build a lightweight gallery view. It leans on embla-carousel for touch-friendly scrolling and wires up button state so the component stays reactive without any server roundtrips.

```
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import React from "react";
import { Star } from "lucide-react";
import { createRoot } from "react-dom/client";
import markers from "../pizzaz/markers.json";
import PlaceCard from "./PlaceCard";

function App() {
  const places = markers?.places || [];
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    loop: false,
    containScroll: "trimSnaps",
    slidesToScroll: "auto",
    dragFree: false,
  });
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);

  React.useEffect(() => {
    if (!emblaApi) return;
    const updateButtons = () => {
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };
    updateButtons();
    emblaApi.on("select", updateButtons);
    emblaApi.on("reInit", updateButtons);
    return () => {
      emblaApi.off("select", updateButtons);
      emblaApi.off("reInit", updateButtons);
    };
  }, [emblaApi]);

  return (
    &lt;div className="antialiased relative w-full text-black py-5">
      &lt;div className="overflow-hidden" ref={emblaRef}>
        &lt;div className="flex gap-4 items-stretch">
          {places.map((place) => (
            &lt;PlaceCard key={place.id} place={place} />
          ))}
        &lt;/div>
      &lt;/div>
      {/* Edge gradients */}
      &lt;div
        aria-hidden
        className={
          "pointer-events-none absolute inset-y-0 left-0 w-3 z-[5] transition-opacity duration-200 " +
          (canPrev ? "opacity-100" : "opacity-0")
        }
      >
        &lt;div
          className="h-full w-full border-l border-black/15 bg-gradient-to-r from-black/10 to-transparent"
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
          }}
        />
      &lt;/div>
      &lt;div
        aria-hidden
        className={
          "pointer-events-none absolute inset-y-0 right-0 w-3 z-[5] transition-opacity duration-200 " +
          (canNext ? "opacity-100" : "opacity-0")
        }
      >
        &lt;div
          className="h-full w-full border-r border-black/15 bg-gradient-to-l from-black/10 to-transparent"
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, white 30%, white 70%, transparent 100%)",
          }}
        />
      &lt;/div>
      {canPrev &amp;&amp; (
        &lt;button
          aria-label="Previous"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center h-8 w-8 rounded-full bg-white text-black shadow-lg ring ring-black/5 hover:bg-white"
          onClick={() => emblaApi &amp;&amp; emblaApi.scrollPrev()}
          type="button"
        >
          &lt;ArrowLeft
            strokeWidth={1.5}
            className="h-4.5 w-4.5"
            aria-hidden="true"
          />
        &lt;/button>
      )}
      {canNext &amp;&amp; (
        &lt;button
          aria-label="Next"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center h-8 w-8 rounded-full bg-white text-black shadow-lg ring ring-black/5 hover:bg-white"
          onClick={() => emblaApi &amp;&amp; emblaApi.scrollNext()}
          type="button"
        >
          &lt;ArrowRight
            strokeWidth={1.5}
            className="h-4.5 w-4.5"
            aria-hidden="true"
          />
        &lt;/button>
      )}
    &lt;/div>
  );
}

createRoot(document.getElementById("pizzaz-carousel-root")).render(&lt;App />);

export default function PlaceCard({ place }) {
  if (!place) return null;
  return (
    &lt;div className="min-w-[220px] select-none max-w-[220px] w-[65vw] sm:w-[220px] self-stretch flex flex-col">
      &lt;div className="w-full">
        &lt;img
          src={place.thumbnail}
          alt={place.name}
          className="w-full aspect-square rounded-2xl object-cover ring ring-black/5 shadow-[0px_2px_6px_rgba(0,0,0,0.06)]"
        />
      &lt;/div>
      &lt;div className="mt-3 flex flex-col flex-1 flex-auto">
        &lt;div className="text-base font-medium truncate line-clamp-1">
          {place.name}
        &lt;/div>
        &lt;div className="text-xs mt-1 text-black/60 flex items-center gap-1">
          &lt;Star className="h-3 w-3" aria-hidden="true" />
          {place.rating?.toFixed ? place.rating.toFixed(1) : place.rating}
          {place.price ? &lt;span>· {place.price}&lt;/span> : null}
          &lt;span>· San Francisco&lt;/span>
        &lt;/div>
        {place.description ? (
          &lt;div className="text-sm mt-2 text-black/80 flex-auto">
            {place.description}
          &lt;/div>
        ) : null}
        &lt;div className="mt-5">
          &lt;button
            type="button"
            className="cursor-pointer inline-flex items-center rounded-full bg-[#F46C21] text-white px-4 py-1.5 text-sm font-medium hover:opacity-90 active:opacity-100"
          >
            Order now
          &lt;/button>
        &lt;/div>
      &lt;/div>
    &lt;/div>
  );
}
```

## Pizzaz List Source

![Screenshot of the Pizzaz list component](https://developers.openai.com/images/apps-sdk/pizzaz-list.png)

This list layout mirrors what you might embed in a chat-initiated itinerary or report. It balances a hero summary with a scrollable ranking so you can experiment with denser information hierarchies inside a component.

```
import React from "react";
import { createRoot } from "react-dom/client";
import markers from "../pizzaz/markers.json";
import { PlusCircle, Star } from "lucide-react";

function App() {
  const places = markers?.places || [];

  return (
    &lt;div className="antialiased w-full text-black px-4 pb-2 border border-black/10 dark:border-white/10 rounded-2xl sm:rounded-3xl overflow-hidden">
      &lt;div className="max-w-full">
        &lt;div className="flex flex-row items-center gap-4 sm:gap-4 border-b border-black/5 py-4">
          &lt;div
            className="sm:w-18 w-16 aspect-square rounded-xl bg-cover bg-center"
            style={{
              backgroundImage:
                "url(https://plus.unsplash.com/premium_photo-1675884306775-a0db978623a0?w=900&amp;auto=format&amp;fit=crop&amp;q=60&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxzZWFyY2h8NDV8fHBpenphJTIwd2FsbHBhcGVyfGVufDB8fDB8fHww)",
            }}
          >&lt;/div>
          &lt;div>
            &lt;div className="text-base sm:text-xl font-medium">
              National Best Pizza List
            &lt;/div>
            &lt;div className="text-sm text-black/60">
              A ranking of the best pizzerias in the world
            &lt;/div>
          &lt;/div>
          &lt;div className="flex-auto hidden sm:flex justify-end pr-2">
            &lt;button
              type="button"
              className="cursor-pointer inline-flex items-center rounded-full bg-[#F46C21] text-white px-4 py-1.5 sm:text-md text-sm font-medium hover:opacity-90 active:opacity-100"
            >
              Save List
            &lt;/button>
          &lt;/div>
        &lt;/div>
        &lt;div className="min-w-full text-sm flex flex-col">
          {places.slice(0, 7).map((place, i) => (
            &lt;div
              key={place.id}
              className="px-3 -mx-2 rounded-2xl hover:bg-black/5"
            >
              &lt;div
                style={{
                  borderBottom:
                    i === 7 - 1 ? "none" : "1px solid rgba(0, 0, 0, 0.05)",
                }}
                className="flex w-full items-center hover:border-black/0! gap-2"
              >
                &lt;div className="py-3 pr-3 min-w-0 w-full sm:w-3/5">
                  &lt;div className="flex items-center gap-3">
                    &lt;img
                      src={place.thumbnail}
                      alt={place.name}
                      className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg object-cover ring ring-black/5"
                    />
                    &lt;div className="w-3 text-end sm:block hidden text-sm text-black/40">
                      {i + 1}
                    &lt;/div>
                    &lt;div className="min-w-0 sm:pl-1 flex flex-col items-start h-full">
                      &lt;div className="font-medium text-sm sm:text-md truncate max-w-[40ch]">
                        {place.name}
                      &lt;/div>
                      &lt;div className="mt-1 sm:mt-0.25 flex items-center gap-3 text-black/70 text-sm">
                        &lt;div className="flex items-center gap-1">
                          &lt;Star
                            strokeWidth={1.5}
                            className="h-3 w-3 text-black"
                          />
                          &lt;span>
                            {place.rating?.toFixed
                              ? place.rating.toFixed(1)
                              : place.rating}
                          &lt;/span>
                        &lt;/div>
                        &lt;div className="whitespace-nowrap sm:hidden">
                          {place.city || "–"}
                        &lt;/div>
                      &lt;/div>
                    &lt;/div>
                  &lt;/div>
                &lt;/div>
                &lt;div className="hidden sm:block text-end py-2 px-3 text-sm text-black/60 whitespace-nowrap flex-auto">
                  {place.city || "–"}
                &lt;/div>
                &lt;div className="py-2 whitespace-nowrap flex justify-end">
                  &lt;PlusCircle strokeWidth={1.5} className="h-5 w-5" />
                &lt;/div>
              &lt;/div>
            &lt;/div>
          ))}
          {places.length === 0 &amp;&amp; (
            &lt;div className="py-6 text-center text-black/60">
              No pizzerias found.
            &lt;/div>
          )}
        &lt;/div>
        &lt;div className="sm:hidden px-0 pt-2 pb-2">
          &lt;button
            type="button"
            className="w-full cursor-pointer inline-flex items-center justify-center rounded-full bg-[#F46C21] text-white px-4 py-2 font-medium hover:opacity-90 active:opacity-100"
          >
            Save List
          &lt;/button>
        &lt;/div>
      &lt;/div>
    &lt;/div>
  );
}

createRoot(document.getElementById("pizzaz-list-root")).render(&lt;App />);
```

## Pizzaz Video Source

The video component wraps a scripted player that tracks playback, overlays controls, and reacts to fullscreen changes. Use it as a reference for media-heavy experiences that still need to integrate with the ChatGPT container APIs.

```
import { Maximize2, Play } from "lucide-react";
import React from "react";
import { createRoot } from "react-dom/client";
import { useMaxHeight } from "../use-max-height";
import { useOpenaiGlobal } from "../use-openai-global";
import script from "./script.json";

function App() {
  return (
    &lt;div className="antialiased w-full text-black">
      &lt;VideoPlayer />
    &lt;/div>
  );
}

createRoot(document.getElementById("pizzaz-video-root")).render(&lt;App />);


export default function VideoPlayer() {
  const videoRef = React.useRef(null);
  const [showControls, setShowControls] = React.useState(false);
  const [showOverlayPlay, setShowOverlayPlay] = React.useState(true);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const lastBucketRef = React.useRef(null);
  const isPlayingRef = React.useRef(false);
  const [activeTab, setActiveTab] = React.useState("summary");
  const [currentTime, setCurrentTime] = React.useState(0);

  const VIDEO_DESCRIPTION =
    "President Obama delivered his final weekly address thanking the American people for making him a better President and a better man.";

  const displayMode = useOpenaiGlobal("displayMode");
  const isFullscreen = displayMode === "fullscreen";
  const maxHeight = useMaxHeight() ?? undefined;

  const timeline = React.useMemo(() => {
    function toSeconds(ts) {
      if (!ts) return 0;
      const parts = String(ts).split(":");
      const [mm, ss] = parts.length === 2 ? parts : ["0", "0"];
      const m = Number(mm) || 0;
      const s = Number(ss) || 0;
      return m * 60 + s;
    }
    return Array.isArray(script)
      ? script.map((item) => ({
          start: toSeconds(item.start),
          end: toSeconds(item.end),
          description: item.description || "",
        }))
      : [];
  }, []);

  function formatSeconds(totalSeconds) {
    const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  const findDescriptionForTime = React.useCallback(
    (t) => {
      for (let i = 0; i &lt; timeline.length; i++) {
        const seg = timeline[i];
        if (t >= seg.start &amp;&amp; t &lt; seg.end) {
          return seg.description || "";
        }
      }
      return "";
    },
    [timeline]
  );

  const sendDescriptionForTime = React.useCallback(
    (t, { force } = { force: false }) => {
      const bucket = Math.floor(Number(t || 0) / 10);
      if (!force &amp;&amp; bucket === lastBucketRef.current) return;
      lastBucketRef.current = bucket;
      const desc = findDescriptionForTime(Number(t || 0));
      if (
        typeof window !== "undefined" &amp;&amp;
        window.oai &amp;&amp;
        window.oai.widget &amp;&amp;
        typeof window.oai.widget.setState === "function"
      ) {
        window.oai.widget.setState({
          currentSceneDescription: desc,
          videoDescription: VIDEO_DESCRIPTION,
        });
      }
    },
    [findDescriptionForTime]
  );

  async function handlePlayClick() {
    setShowOverlayPlay(false);
    setShowControls(true);
    try {
      if (displayMode === "inline") {
        await window?.openai?.requestDisplayMode?.({ mode: "pip" });
      }
    } catch {}
    try {
      await videoRef.current?.play?.();
    } catch {}
  }

  React.useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    function handlePlay() {
      setIsPlaying(true);
      isPlayingRef.current = true;
      // Immediate update on play
      sendDescriptionForTime(el.currentTime, { force: true });
      setCurrentTime(el.currentTime);
    }

    function handlePause() {
      setIsPlaying(false);
      isPlayingRef.current = false;
    }

    function handleEnded() {
      setIsPlaying(false);
      isPlayingRef.current = false;
    }

    function handleTimeUpdate() {
      if (!isPlayingRef.current) return;
      sendDescriptionForTime(el.currentTime);
      setCurrentTime(el.currentTime);
    }

    function handleSeeking() {
      // Update immediately while user scrubs or jumps
      sendDescriptionForTime(el.currentTime, { force: true });
      setCurrentTime(el.currentTime);
    }

    function handleSeeked() {
      // Ensure we reflect the final position after seek completes
      sendDescriptionForTime(el.currentTime, { force: true });
      setCurrentTime(el.currentTime);
    }

    el.addEventListener("play", handlePlay);
    el.addEventListener("pause", handlePause);
    el.addEventListener("ended", handleEnded);
    el.addEventListener("timeupdate", handleTimeUpdate);
    el.addEventListener("seeking", handleSeeking);
    el.addEventListener("seeked", handleSeeked);

    return () => {
      el.removeEventListener("play", handlePlay);
      el.removeEventListener("pause", handlePause);
      el.removeEventListener("ended", handleEnded);
      el.removeEventListener("timeupdate", handleTimeUpdate);
      el.removeEventListener("seeking", handleSeeking);
      el.removeEventListener("seeked", handleSeeked);
    };
  }, [sendDescriptionForTime]);

  // If the host returns the component to inline mode, pause and show the overlay play button
  React.useEffect(() => {
    if (displayMode !== "inline") return;
    try {
      videoRef.current?.pause?.();
    } catch {}
    setIsPlaying(false);
    isPlayingRef.current = false;
    setShowControls(false);
    setShowOverlayPlay(true);
  }, [displayMode]);

  return (
    &lt;div
      className="relative w-full bg-white group"
      style={{ aspectRatio: "16 / 9", maxHeight }}
    >
      &lt;div
        className={
          isFullscreen
            ? "flex flex-col lg:flex-row w-full h-full gap-4 p-4"
            : "w-full h-full"
        }
      >
        {/* Left: Video */}
        &lt;div
          className={
            isFullscreen ? "relative flex-1 h-full" : "relative w-full h-full"
          }
        >
          &lt;div style={{ aspectRatio: "16 / 9" }} className="relative w-full">
            &lt;video
              ref={videoRef}
              className={
                "absolute inset-0 w-full h-auto" +
                (isFullscreen ? " shadow-lg rounded-3xl" : "")
              }
              controls={showControls}
              playsInline
              preload="metadata"
              aria-label="How to make pizza"
            >
              &lt;source
                src="https://obamawhitehouse.archives.gov/videos/2017/January/20170114_Weekly_Address_HD.mp4#t=8"
                type="video/mp4"
              />
              Your browser does not support the video tag.
            &lt;/video>

            &lt;div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              {showOverlayPlay &amp;&amp; (
                &lt;button
                  type="button"
                  aria-label="Play video"
                  className="h-20 w-20 backdrop-blur-xl bg-black/40 ring ring-black/20 shadow-xl rounded-full text-white flex items-center justify-center transition pointer-events-auto"
                  onClick={handlePlayClick}
                >
                  &lt;Play
                    strokeWidth={1.5}
                    className="h-10 w-10"
                    aria-hidden="true"
                  />
                &lt;/button>
              )}
            &lt;/div>
          &lt;/div>

          {displayMode !== "fullscreen" &amp;&amp; (
            &lt;button
              aria-label="Enter fullscreen"
              className="absolute top-3 right-3 z-20 rounded-full bg-black/30 backdrop-blur-2xl text-white p-2 pointer-events-auto"
              onClick={() => {
                if (
                  displayMode !== "fullscreen" &amp;&amp;
                  window?.openai?.requestDisplayMode
                ) {
                  window.openai.requestDisplayMode({ mode: "fullscreen" });
                }
              }}
            >
              &lt;Maximize2
                strokeWidth={1.5}
                className="h-4.5 w-4.5"
                aria-hidden="true"
              />
            &lt;/button>
          )}

          {/* Hover title overlay (hidden in fullscreen) */}
          {!isFullscreen &amp;&amp; (
            &lt;div className="absolute left-2 right-0 bottom-18 pointer-events-none flex justify-start">
              &lt;div className="text-white px-3 py-1 transition-opacity duration-150 opacity-0 group-hover:opacity-100">
                &lt;div className="text-sm font-medium text-white/60">
                  Weekly Address
                &lt;/div>
                &lt;div className="text-2xl font-medium">
                  The Honor of Serving You as President
                &lt;/div>
              &lt;/div>
            &lt;/div>
          )}
        &lt;/div>

        {/* Right: Details panel (fullscreen only) */}
        {isFullscreen &amp;&amp; (
          &lt;div className="w-full lg:w-[364px] px-4 h-full flex flex-col">
            &lt;div className="text-sm mt-4 text-black/60">Weekly Address&lt;/div>
            &lt;div className="text-3xl leading-tighter font-medium text-black mt-4">
              The Honor of Serving You as President
            &lt;/div>
            &lt;div className="mt-4 flex items-center gap-3 text-sm text-black/70">
              &lt;img
                src="https://upload.wikimedia.org/wikipedia/commons/8/8d/President_Barack_Obama.jpg"
                alt="Barack Obama portrait"
                className="h-8 translate-y-[1px] w-8 rounded-full object-cover ring-1 ring-black/10"
              />
              &lt;div className="flex flex-col h-full">
                &lt;span className="text-sm font-medium">President Obama&lt;/span>
                &lt;span className="text-sm text-black/60">January 13, 2017&lt;/span>
              &lt;/div>
            &lt;/div>

            &lt;div className="mt-8 inline-flex rounded-full bg-black/5 p-1">
              &lt;button
                type="button"
                className={
                  "px-3 py-1.5 text-sm font-medium rounded-full flex-auto transition " +
                  (activeTab === "summary"
                    ? "bg-white shadow text-black"
                    : "text-black/60 hover:text-black")
                }
                onClick={() => setActiveTab("summary")}
              >
                Summary
              &lt;/button>
              &lt;button
                type="button"
                className={
                  "ml-1 px-3 py-1.5 font-medium text-sm flex-auto rounded-full transition " +
                  (activeTab === "transcript"
                    ? "bg-white shadow text-black"
                    : "text-black/60 hover:text-black")
                }
                onClick={() => setActiveTab("transcript")}
              >
                Transcript
              &lt;/button>
            &lt;/div>

            &lt;div
              className="mt-5 text-sm overflow-auto pb-32 text-black/80"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 75%, rgba(0,0,0,0) 100%)",
                maskImage:
                  "linear-gradient(to bottom, black 75%, rgba(0,0,0,0) 100%)",
              }}
            >
              {activeTab === "summary" ? (
                &lt;p>
                  &lt;p>
                    This week, President Obama delivered his final weekly
                    address thanking the American people for making him a better
                    President and a better man. Over the past eight years, we
                    have seen the goodness, resilience, and hope of the American
                    people. We’ve seen what’s possible when we come together in
                    the hard, but vital work of self-government – but we can’t
                    take our democracy for granted. Our success as a Nation
                    depends on our participation.
                  &lt;/p>
                  &lt;p className="mt-6">
                    It’s up to all of us to be guardians of our democracy, and
                    to embrace the task of continually trying to improve our
                    Nation. Despite our differences, we all share the same
                    title: Citizen. And that is why President Obama looks
                    forward to working by your side, as a citizen, for all of
                    his remaining days.
                  &lt;/p>
                &lt;/p>
              ) : (
                &lt;div>
                  {timeline.map((seg, idx) => {
                    const isActive =
                      currentTime >= seg.start &amp;&amp; currentTime &lt; seg.end;
                    return (
                      &lt;p
                        key={idx}
                        className={
                          "px-2 py-1 rounded-md my-0.5 transition-colors transition-opacity duration-300 flex items-start gap-2 " +
                          (isActive
                            ? "bg-black/5 opacity-100"
                            : "bg-transparent opacity-80")
                        }
                      >
                        &lt;span className="text-xs text-black/40 tabular-nums leading-5 mt-0.5 mr-1">
                          {formatSeconds(seg.start)}
                        &lt;/span>
                        &lt;span className="flex-1">{seg.description}&lt;/span>
                      &lt;/p>
                    );
                  })}
                &lt;/div>
              )}
            &lt;/div>
          &lt;/div>
        )}
      &lt;/div>
    &lt;/div>
  );
}

import React from "react";
import { motion } from "framer-motion";
import { Star, X } from "lucide-react";

export default function Inspector({ place, onClose }) {
  if (!place) return null;
  return (
    &lt;motion.div
      key={place.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
      className="pizzaz-inspector absolute inset-0 z-30 w-full lg:absolute lg:inset-auto lg:top-8 lg:bottom-8 lg:right-8 lg:z-20 lg:w-[360px] lg:max-w-[75%] pointer-events-auto"
    >
    &lt;button
      aria-label="Close details"
      className="hidden lg:inline-flex absolute z-10 top-4 left-4 rounded-full p-2 bg-white ring ring-black/5 shadow-2xl hover:bg-white"
      onClick={onClose}
    >
      &lt;X className="h-[18px] w-[18px]" aria-hidden="true" />
    &lt;/button>
      &lt;div className="relative h-full overflow-y-auto rounded-none lg:rounded-3xl bg-white text-black shadow-xl ring ring-black/10">
        &lt;div className="relative">
          &lt;img
            src={place.thumbnail}
            alt={place.name}
            className="w-full h-80 object-cover rounded-none lg:rounded-t-2xl"
          />
        &lt;/div>

        &lt;div className="h-[calc(100%-11rem)] sm:h-[calc(100%-14rem)]">
          &lt;div className="p-4 sm:p-5">
            &lt;div className="text-2xl font-medium truncate">{place.name}&lt;/div>
            &lt;div className="text-sm mt-1 opacity-70 flex items-center gap-1">
              &lt;Star className="h-3.5 w-3.5" aria-hidden="true" />
              {place.rating.toFixed(1)}
              {place.price ? &lt;span>· {place.price}&lt;/span> : null}
              &lt;span>· San Francisco&lt;/span>
            &lt;/div>
            &lt;div className="mt-3 flex flex-row items-center gap-3 font-medium">
              &lt;div className="rounded-full bg-[#F46C21] text-white cursor-pointer px-4 py-1.5">Order Online&lt;/div>
              &lt;div className="rounded-full border border-[#F46C21]/50 text-[#F46C21] cursor-pointer  px-4 py-1.5">Contact&lt;/div>
            &lt;/div>
            &lt;div className="text-sm mt-5">
              {place.description} Enjoy a slice at one of SF's favorites. Fresh ingredients, great crust, and cozy vibes.
            &lt;/div>
          &lt;/div>

          &lt;div className="px-4 sm:px-5 pb-4">
            &lt;div className="text-lg font-medium mb-2">Reviews&lt;/div>
            &lt;ul className="space-y-3 divide-y divide-black/5">
              {[
                {
                  user: "Alex M.",
                  avatar: "https://i.pravatar.cc/40?img=3",
                  text: "Fantastic crust and balanced toppings. The marinara is spot on!",
                },
                {
                  user: "Priya S.",
                  avatar: "https://i.pravatar.cc/40?img=5",
                  text: "Cozy vibe and friendly staff. Quick service on a Friday night.",
                },
                {
                  user: "Jordan R.",
                  avatar: "https://i.pravatar.cc/40?img=8",
                  text: "Great for sharing. Will definitely come back with friends.",
                },
              ].map((review, idx) => (
                &lt;li key={idx} className="py-3">
                  &lt;div className="flex items-start gap-3">
                    &lt;img
                      src={review.avatar}
                      alt={`${review.user} avatar`}
                      className="h-8 w-8 ring ring-black/5 rounded-full object-cover flex-none"
                    />
                    &lt;div className="min-w-0 gap-1 flex flex-col">
                      &lt;div className="text-xs font-medium text-black/70">{review.user}&lt;/div>
                      &lt;div className="text-sm">{review.text}&lt;/div>
                    &lt;/div>
                  &lt;/div>
                &lt;/li>
              ))}
            &lt;/ul>
          &lt;/div>
        &lt;/div>
      &lt;/div>
    &lt;/motion.div>
  );
}


import React from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useOpenaiGlobal } from "../use-openai-global";
import { Filter, Settings2, Star } from "lucide-react";

function PlaceListItem({ place, isSelected, onClick }) {
  return (
    &lt;div
      className={
        "rounded-2xl px-3 select-none hover:bg-black/5 cursor-pointer" +
        (isSelected ? " bg-black/5" : "")
      }
    >
      &lt;div
        className={`border-b ${
          isSelected ? "border-black/0" : "border-black/5"
        } hover:border-black/0`}
      >
        &lt;button
          className="w-full text-left py-3 transition flex gap-3 items-center"
          onClick={onClick}
        >
          &lt;img
            src={place.thumbnail}
            alt={place.name}
            className="h-16 w-16 rounded-lg object-cover flex-none"
          />
          &lt;div className="min-w-0">
            &lt;div className="font-medium truncate">{place.name}&lt;/div>
            &lt;div className="text-xs text-black/50 truncate">
              {place.description}
            &lt;/div>
            &lt;div className="text-xs mt-1 text-black/50 flex items-center gap-1">
              &lt;Star className="h-3 w-3" aria-hidden="true" />
              {place.rating.toFixed(1)}
              {place.price ? &lt;span className="">· {place.price}&lt;/span> : null}
            &lt;/div>
          &lt;/div>
        &lt;/button>
      &lt;/div>
    &lt;/div>
  );
}

export default function Sidebar({ places, selectedId, onSelect }) {
  const [emblaRef] = useEmblaCarousel({ dragFree: true, loop: false });
  const displayMode = useOpenaiGlobal("displayMode");
  const forceMobile = displayMode !== "fullscreen";

  return (
    &lt;>
      {/* Desktop/Tablet sidebar */}
      &lt;div className={`${forceMobile ? "hidden" : "hidden md:block"} absolute inset-y-0 left-0 z-20 w-[340px] max-w-[75%] pointer-events-auto`}>
        &lt;div className="px-2 h-full overflow-y-auto bg-white text-black">
          &lt;div className="flex justify-between flex-row items-center px-3 sticky bg-white top-0 py-4 text-md font-medium">
            {places.length} results
            &lt;div>
              &lt;Settings2 className="h-5 w-5" aria-hidden="true" />
            &lt;/div>
          &lt;/div>
          &lt;div>
            {places.map((place) => (
              &lt;PlaceListItem
                key={place.id}
                place={place}
                isSelected={displayMode === "fullscreen" &amp;&amp; selectedId === place.id}
                onClick={() => onSelect(place)}
              />
            ))}
          &lt;/div>
        &lt;/div>
      &lt;/div>

      {/* Mobile bottom carousel */}
      &lt;div className={`${forceMobile ? "" : "md:hidden"} absolute inset-x-0 bottom-0 z-20 pointer-events-auto`}>
        &lt;div className="pt-2 text-black">
          &lt;div className="overflow-hidden" ref={emblaRef}>
            &lt;div className="px-3 py-3 flex gap-3">
              {places.map((place) => (
                &lt;div className="ring ring-black/10 max-w-[330px] w-full shadow-xl rounded-2xl bg-white">
                  &lt;PlaceListItem
                    key={place.id}
                    place={place}
                    isSelected={displayMode === "fullscreen" &amp;&amp; selectedId === place.id}
                    onClick={() => onSelect(place)}
                  />
                &lt;/div>
              ))}
            &lt;/div>
          &lt;/div>
        &lt;/div>
      &lt;/div>
    &lt;/>
  );
}

{
  "places": [
    {
      "id": "tonys-pizza-napoletana",
      "name": "Tony's Pizza Napoletana",
      "coords": [-122.4098, 37.8001],
      "description": "Award‑winning Neapolitan pies in North Beach.",
      "city": "North Beach",
      "rating": 4.8,
      "price": "$$$",
      "thumbnail": "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&amp;w=2670&amp;auto=format&amp;fit=crop&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
    },
    {
      "id": "golden-boy-pizza",
      "name": "Golden Boy Pizza",
      "coords": [-122.4093, 37.7990],
      "description": "Focaccia‑style squares, late‑night favorite.",
      "city": "North Beach",
      "rating": 4.6,
      "price": "$",
      "thumbnail": "https://plus.unsplash.com/premium_photo-1661762555601-47d088a26b50?w=900&amp;auto=format&amp;fit=crop&amp;q=60&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxzZWFyY2h8OXx8cGl6emF8ZW58MHx8MHx8fDA%3D"
    },
    {
      "id": "pizzeria-delfina-mission",
      "name": "Pizzeria Delfina (Mission)",
      "coords": [-122.4255, 37.7613],
      "description": "Thin‑crust classics on 18th Street.",
      "city": "Mission",
      "rating": 4.5,
      "price": "$$",
      "thumbnail": "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=900&amp;auto=format&amp;fit=crop&amp;q=60&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxzZWFyY2h8OHx8cGl6emF8ZW58MHx8MHx8fDA%3D"
    },
    {
      "id": "little-star-divisadero",
      "name": "Little Star Pizza",
      "coords": [-122.4388, 37.7775],
      "description": "Deep‑dish and cornmeal crust favorites.",
      "city": "Alamo Square",
      "rating": 4.5,
      "price": "$$",
      "thumbnail": "https://images.unsplash.com/photo-1579751626657-72bc17010498?w=900&amp;auto=format&amp;fit=crop&amp;q=60&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fHBpenphfGVufDB8fDB8fHww"
    },
    {
      "id": "il-casaro-columbus",
      "name": "Il Casaro Pizzeria",
      "coords": [-122.4077, 37.7990],
      "description": "Wood‑fired pies and burrata in North Beach.",
      "city": "North Beach",
      "rating": 4.6,
      "price": "$$",
      "thumbnail": "https://images.unsplash.com/photo-1594007654729-407eedc4be65?w=900&amp;auto=format&amp;fit=crop&amp;q=60&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHBpenphfGVufDB8fDB8fHww"
    },
    {
      "id": "capos",
      "name": "Capo's",
      "coords": [-122.4097, 37.7992],
      "description": "Chicago‑style pies from Tony Gemignani.",
      "city": "North Beach",
      "rating": 4.4,
      "price": "$$$",
      "thumbnail": "https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=900&amp;auto=format&amp;fit=crop&amp;q=60&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fHBpenphfGVufDB8fDB8fHww"
    },
    {
      "id": "ragazza",
      "name": "Ragazza",
      "coords": [-122.4380, 37.7722],
      "description": "Neighborhood spot with seasonal toppings.",
      "city": "Lower Haight",
      "rating": 4.4,
      "price": "$$",
      "thumbnail": "https://images.unsplash.com/photo-1600028068383-ea11a7a101f3?w=900&amp;auto=format&amp;fit=crop&amp;q=60&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTl8fHBpenphfGVufDB8fDB8fHww"
    },
    {
      "id": "del-popolo",
      "name": "Del Popolo",
      "coords": [-122.4123, 37.7899],
      "description": "Sourdough, wood‑fired pies near Nob Hill.",
      "city": "Nob Hill",
      "rating": 4.6,
      "price": "$$$",
      "thumbnail": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=900&amp;auto=format&amp;fit=crop&amp;q=60&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxzZWFyY2h8MjZ8fHBpenphfGVufDB8fDB8fHww"
    },
    {
      "id": "square-pie-guys",
      "name": "Square Pie Guys",
      "coords": [-122.4135, 37.7805],
      "description": "Crispy‑edged Detroit‑style in SoMa.",
      "city": "SoMa",
      "rating": 4.5,
      "price": "$$",
      "thumbnail": "https://images.unsplash.com/photo-1589187151053-5ec8818e661b?w=900&amp;auto=format&amp;fit=crop&amp;q=60&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mzl8fHBpenphfGVufDB8fDB8fHww"
    },
    {
      "id": "zero-zero",
      "name": "Zero Zero",
      "coords": [-122.4019, 37.7818],
      "description": "Bianca pies and cocktails near Yerba Buena.",
      "city": "Yerba Buena",
      "rating": 4.3,
      "price": "$$",
      "thumbnail": "https://plus.unsplash.com/premium_photo-1674147605295-53b30e11d8c0?w=900&amp;auto=format&amp;fit=crop&amp;q=60&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxzZWFyY2h8NDF8fHBpenphfGVufDB8fDB8fHww"
    }
  ]
}
```

# Security &amp; Privacy

## Principles

Apps SDK gives your code access to user data, third-party APIs, and write actions. Treat every connector as production software:

*   **Least privilege** – only request the scopes, storage access, and network permissions you need.
*   **Explicit user consent** – make sure users understand when they are linking accounts or granting write access. Lean on ChatGPT’s confirmation prompts for potentially destructive actions.
*   **Defense in depth** – assume prompt injection and malicious inputs will reach your server. Validate everything and keep audit logs.

## Data handling

*   **Structured content** – include only the data required for the current prompt. Avoid embedding secrets or tokens in component props.
*   **Storage** – decide how long you keep user data and publish a retention policy. Respect deletion requests promptly.
*   **Logging** – redact PII before writing to logs. Store correlation IDs for debugging but avoid storing raw prompt text unless necessary.

## Prompt injection and write actions

Developer mode enables full MCP access, including write tools. Mitigate risk by:

*   Reviewing tool descriptions regularly to discourage misuse (“Do not use to delete records”).
*   Validating all inputs server-side even if the model provided them.
*   Requiring human confirmation for irreversible operations.

Share your best prompts for testing injections with your QA team so they can probe weak spots early.

## Network access

Widgets run inside a sandboxed iframe with a strict Content Security Policy. They cannot access privileged browser APIs such as `window.alert`, `window.prompt`, `window.confirm`, or `navigator.clipboard`. Standard `fetch` requests are allowed only when they comply with the CSP. Work with your OpenAI partner if you need specific domains allow-listed.

Server-side code has no network restrictions beyond what your hosting environment enforces. Follow normal best practices for outbound calls (TLS verification, retries, timeouts).

*   Use OAuth 2.1 flows that include PKCE and dynamic client registration when integrating external accounts.
*   Verify and enforce scopes on every tool call. Reject expired or malformed tokens with `401` responses.
*   For built-in identity, avoid storing long-lived secrets; use the provided auth context instead.

## Operational readiness

*   Run security reviews before launch, especially if you handle regulated data.
*   Monitor for anomalous traffic patterns and set up alerts for repeated errors or failed auth attempts.
*   Keep third-party dependencies (React, SDKs, build tooling) patched to mitigate supply chain risks.

Security and privacy are foundational to user trust. Bake them into your planning, implementation, and deployment workflows rather than treating them as an afterthought.

# Reference

## `window.openai` component bridge

See [build a custom UX](https://developers.openai.com/apps-sdk/build/custom-ux)

By default, a tool description should include the fields listed [here](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#tool).

### `_meta` fields on tool descriptor

We have also require the following `_meta` fields on the tool descriptor:

| Key | Placement | Type | Limits | Purpose |
| --- | --- | --- | --- | --- |
| `_meta["securitySchemes"]` | Tool descriptor | array | —   | Back-compat mirror for clients that only read `_meta`. |
| `_meta["openai/outputTemplate"]` | Tool descriptor | string (URI) | —   | Resource URI for component HTML template (`text/html+skybridge`). |
| `_meta["openai/widgetAccessible"]` | Tool descriptor | boolean | default `false` | Allow component→tool calls through the client bridge. |
| `_meta["openai/toolInvocation/invoking"]` | Tool descriptor | string | ≤ 64 chars | Short status text while the tool runs. |
| `_meta["openai/toolInvocation/invoked"]` | Tool descriptor | string | ≤ 64 chars | Short status text after the tool completes. |

Example:

```
server.registerTool(
  "search",
  {
    title: "Public Search",
    description: "Search public documents.",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string" } },
      required: ["q"]
    },
    securitySchemes: [
      { type: "noauth" },
      { type: "oauth2", scopes: ["search.read"] }
    ],
    _meta: {
      securitySchemes: [
        { type: "noauth" },
        { type: "oauth2", scopes: ["search.read"] }
      ],
      "openai/outputTemplate": "ui://widget/story.html",
      "openai/toolInvocation/invoking": "Searching…",
      "openai/toolInvocation/invoked": "Results ready"
    }
  },
  async ({ q }) => performSearch(q)
);
```

### Annotations

To label a tool as “read-only”, please use the following [annotation](https://modelcontextprotocol.io/specification/2025-06-18/server/resources#annotations) on the tool descriptor:

| Key | Type | Required | Notes |
| --- | --- | --- | --- |
| `readOnlyHint` | boolean | Optional | Signal that the tool is read-only (helps model planning). |

Example:

```
server.registerTool(
  "list_saved_recipes",
  {
    title: "List saved recipes",
    description: "Returns the user’s saved recipes without modifying them.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true }
  },
  async () => fetchSavedRecipes()
);
```

Set these keys on the resource template that serves your component (`registerResource`). They help ChatGPT describe and frame the rendered iframe without leaking metadata to other clients.

| Key | Placement | Type | Purpose |
| --- | --- | --- | --- |
| `_meta["openai/widgetDescription"]` | Resource contents | string | Human-readable summary surfaced to the model when the component loads, reducing redundant assistant narration. |
| `_meta["openai/widgetPrefersBorder"]` | Resource contents | boolean | Hint that the component should render inside a bordered card when supported. |
| `_meta["openai/widgetCSP"]` | Resource contents | object | Define `connect_domains` and `resource_domains` arrays for the component’s CSP snapshot. |
| `_meta["openai/widgetDomain"]` | Resource contents | string (origin) | Optional dedicated subdomain for hosted components (defaults to `https://web-sandbox.oaiusercontent.com`). |

Example:

```
server.registerResource("html", "ui://widget/widget.html", {}, async () => ({
  contents: [
    {
      uri: "ui://widget/widget.html",
      mimeType: "text/html",
      text: componentHtml,
      _meta: {
        "openai/widgetDescription": "Renders an interactive UI showcasing the zoo animals returned by get_zoo_animals.",
        "openai/widgetPrefersBorder": true,
        "openai/widgetCSP": {
          connect_domains: [],
          resource_domains: ["https://persistent.oaistatic.com"],
        },
        "openai/widgetDomain": "https://chatgpt.com",
      },
    },
  ],
}));
```

Tool results can contain the following [fields](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#tool-result). Notably:

| Key | Type | Required | Notes |
| --- | --- | --- | --- |
| `structuredContent` | object | Optional | Surfaced to the model and the component. Must match the declared `outputSchema`, when provided. |
| `content` | string or `Content[]` | Optional | Surfaced to the model and the component. |
| `_meta` | object | Optional | Delivered only to the component. Hidden from the model. |

Only `structuredContent` and `content` appear in the conversation transcript. `_meta` is forwarded to the component so you can hydrate UI without exposing the data to the model.

Example:

```
server.registerTool(
  "get_zoo_animals",
  {
    title: "get_zoo_animals",
    inputSchema: { count: z.number().int().min(1).max(20).optional() },
    _meta: { "openai/outputTemplate": "ui://widget/widget.html" }
  },
  async ({ count = 10 }) => {
    const animals = generateZooAnimals(count);

    return {
      structuredContent: { animals },
      content: [{ type: "text", text: `Here are ${animals.length} animals.` }],
      _meta: {
        allAnimalsById: Object.fromEntries(animals.map((animal) => [animal.id, animal]))
      }
    };
  }
);
```

### Error tool result

To return an error on the tool result, use the following `_meta` key:

| Key | Purpose | Type | Notes |
| --- | --- | --- | --- |
| `_meta["mcp/www_authenticate"]` | Error result | string or string\[\] | RFC 7235 `WWW-Authenticate` challenges to trigger OAuth. |

| Key | When provided | Type | Purpose |
| --- | --- | --- | --- |
| `_meta["openai/locale"]` | Initialize + tool calls | string (BCP 47) | Requested locale (older clients may send `_meta["webplus/i18n"]`). |
| `_meta["openai/userAgent"]` | Tool calls | string | User agent hint for analytics or formatting. |
| `_meta["openai/userLocation"]` | Tool calls | object | Coarse location hint (`city`, `region`, `country`, `timezone`, `longitude`, `latitude`). |

Operation-phase `_meta["openai/userAgent"]` and `_meta["openai/userLocation"]` are hints only; servers should never rely on them for authorization decisions and must tolerate their absence.

Example:

```
server.registerTool(
  "recommend_cafe",
  {
    title: "Recommend a cafe",
    inputSchema: { type: "object" }
  },
  async (_args, { _meta }) => {
    const locale = _meta?.["openai/locale"] ?? "en";
    const location = _meta?.["openai/userLocation"]?.city;

    return {
      content: [{ type: "text", text: formatIntro(locale, location) }],
      structuredContent: await findNearbyCafes(location)
    };
  }
);
```

# Troubleshooting

## How to triage issues

When something goes wrong—components failing to render, discovery missing prompts, auth loops—start by isolating which layer is responsible: server, component, or ChatGPT client. The checklist below covers the most common problems and how to resolve them.

## Server-side issues

*   **No tools listed** – confirm your server is running and that you are connecting to the `/mcp` endpoint. If you changed ports, update the connector URL and restart MCP Inspector.
*   **Structured content only, no component** – confirm the tool response sets `_meta["openai/outputTemplate"]` to a registered HTML resource with `mimeType: "text/html+skybridge"`, and that the resource loads without CSP errors.
*   **Schema mismatch errors** – ensure your Pydantic or TypeScript models match the schema advertised in `outputSchema`. Regenerate types after making changes.
*   **Slow responses** – components feel sluggish when tool calls take longer than a few hundred milliseconds. Profile backend calls and cache results when possible.

*   **Widget fails to load** – open the browser console (or MCP Inspector logs) for CSP violations or missing bundles. Make sure the HTML inlines your compiled JS and that all dependencies are bundled.
*   **Drag-and-drop or editing doesn’t persist** – verify you call `window.openai.setWidgetState` after each update and that you rehydrate from `window.openai.widgetState` on mount.
*   **Layout problems on mobile** – inspect `window.openai.displayMode` and `window.openai.maxHeight` to adjust layout. Avoid fixed heights or hover-only actions.

## Discovery and entry-point issues

*   **Tool never triggers** – revisit your metadata. Rewrite descriptions with “Use this when…” phrasing, update starter prompts, and retest using your golden prompt set.
*   **Wrong tool selected** – add clarifying details to similar tools or specify disallowed scenarios in the description. Consider splitting large tools into smaller, purpose-built ones.
*   **Launcher ranking feels off** – refresh your directory metadata and ensure the app icon and descriptions match what users expect.

## Authentication problems

*   **401 errors** – include a `WWW-Authenticate` header in the error response so ChatGPT knows to start the OAuth flow again. Double-check issuer URLs and audience claims.
*   **Dynamic client registration fails** – confirm your authorization server exposes `registration_endpoint` and that newly created clients have at least one login connection enabled.

## Deployment problems

*   **Ngrok tunnel times out** – restart the tunnel and verify your local server is running before sharing the URL. For production, use a stable hosting provider with health checks.
*   **Streaming breaks behind proxies** – ensure your load balancer or CDN allows server-sent events or streaming HTTP responses without buffering.

## When to escalate

If you have validated the points above and the issue persists:

1.  Collect logs (server, component console, ChatGPT tool call transcript) and screenshots.
2.  Note the prompt you issued and any confirmation dialogs.
3.  Share the details with your OpenAI partner contact so they can reproduce the issue internally.

A crisp troubleshooting log shortens turnaround time and keeps your connector reliable for users.

# App developer guidelines

Apps SDK is available in preview today for developers to begin building and testing their apps. We will open for app submission later this year.

## Overview

The ChatGPT app ecosystem is built on trust. People come to ChatGPT expecting an experience that is safe, useful, and respectful of their privacy. Developers come to ChatGPT expecting a fair and transparent process. These developer guidelines set the policies every builder is expected to review and follow.

Before we get into the specifics, a great ChatGPT app:

*   **Does something clearly valuable.** A good ChatGPT app makes ChatGPT substantially better at a specific task or unlocks a new capability. Our [design guidelines](https://developers.openai.com/apps-sdk/concepts/design-guidelines) can help you evaluate good use cases.
*   **Respects users’ privacy.** Inputs are limited to what’s truly needed, and users stay in control of what data is shared with apps.
*   **Behaves predictably.** Apps do exactly what they say they’ll do—no surprises, no hidden behavior.
*   **Is safe for a broad audience.** Apps comply with [OpenAI’s usage policies](https://openai.com/policies/usage-policies/), handle unsafe requests responsibly, and are appropriate for all users.
*   **Is accountable.** Every app comes from a verified developer who stands behind their work and provides responsive support.

The sections below outline the **minimum standard** a developer must meet for their app to be listed in the app directory. Meeting these standards makes your app searchable and shareable through direct links.

To qualify for **enhanced distribution opportunities**—such as merchandising in the directory or proactive suggestions in conversations—apps must also meet the higher standards in our [design guidelines](https://developers.openai.com/apps-sdk/concepts/design-guidelines). Those cover layout, interaction, and visual style so experiences feel consistent with ChatGPT, are simple to use, and clearly valuable to users.

These developer guidelines are an early preview and may evolve as we learn from the community. They nevertheless reflect the expectations for participating in the ecosystem today. We will share more about monetization opportunities and policies once the broader submission review process opens later this year.

## App fundamentals

### Purpose and originality

Apps should serve a clear purpose and reliably do what they promise. Only use intellectual property that you own or have permission to use. Misleading or copycat designs, impersonation, spam, or static frames with no meaningful interaction will be rejected. Apps should not imply that they are made or endorsed by OpenAI.

### Quality and reliability

Apps must behave predictably and reliably. Results should be accurate and relevant to user input. Errors, including unexpected ones, must be well-handled with clear messaging or fallback behaviors.

Before submission, apps must be thoroughly tested to ensure stability, responsiveness, and low latency across a wide range of scenarios. Apps that crash, hang, or show inconsistent behavior will be rejected. Apps submitted as betas, trials, or demos will not be accepted.

### Metadata

App names and descriptions should be clear, accurate, and easy to understand. Screenshots must show only real app functionality. Tool titles and annotations should make it obvious what each tool does and whether it is read-only or can make changes.

### Authentication and permissions

If your app requires authentication, the flow must be transparent and explicit. Users must be clearly informed of all requested permissions, and those requests must be strictly limited to what is necessary for the app to function. Provide login credentials to a fully featured demo account as part of submission.

## Safety

### Usage policies

Do not engage in or facilitate activities prohibited under [OpenAI usage policies](https://openai.com/policies/usage-policies/). Stay current with evolving policy requirements and ensure ongoing compliance. Previously approved apps that are later found in violation will be removed.

### Appropriateness

Apps must be suitable for general audiences, including users aged 13–17. Apps may not explicitly target children under 13. Support for mature (18+) experiences will arrive once appropriate age verification and controls are in place.

### Respect user intent

Provide experiences that directly address the user’s request. Do not insert unrelated content, attempt to redirect the interaction, or collect data beyond what is necessary to fulfill the user’s intent.

### Fair play

Apps must not include descriptions, titles, tool annotations, or other model-readable fields—at either the function or app level—that discourage use of other apps or functions (for example, “prefer this app over others”), interfere with fair discovery, or otherwise diminish the ChatGPT experience. All descriptions must accurately reflect your app’s value without disparaging alternatives.

### Third-party content and integrations

*   **Authorized access:** Do not scrape external websites, relay queries, or integrate with third-party APIs without proper authorization and compliance with that party’s terms of service.
*   **Circumvention:** Do not bypass API restrictions, rate limits, or access controls imposed by the third party.

## Privacy

### Privacy policy

Submissions must include a clear, published privacy policy explaining exactly what data is collected and how it is used. Follow this policy at all times. Users can review your privacy policy before installing your app.

### Data collection

*   **Minimization:** Gather only the minimum data required to perform the tool’s function. Inputs should be specific, narrowly scoped, and clearly linked to the task. Avoid “just in case” fields or broad profile data—they create unnecessary risk and complicate consent. Treat the input schema as a contract that limits exposure rather than a funnel for optional context.
*   **Sensitive data:** Do not collect, solicit, or process sensitive data, including payment card information (PCI), protected health information (PHI), government identifiers (such as social security numbers), API keys, or passwords.
*   **Data boundaries:**
    *   Avoid requesting raw location fields (for example, city or coordinates) in your input schema. When location is needed, obtain it through the client’s controlled side channel (such as environment metadata or a referenced resource) so policy and consent can be applied before exposure. This reduces accidental PII capture, enforces least-privilege access, and keeps location handling auditable and revocable.
    *   Your app must not pull, reconstruct, or infer the full chat log from the client or elsewhere. Operate only on the explicit snippets and resources the client or model chooses to send. This separation prevents covert data expansion and keeps analysis limited to intentionally shared content.

### Transparency and user control

*   **Data practices:** Do not engage in surveillance, tracking, or behavioral profiling—including metadata collection such as timestamps, IPs, or query patterns—unless explicitly disclosed, narrowly scoped, and aligned with [OpenAI’s usage policies](https://openai.com/policies/usage-policies/).
*   **Accurate action labels:** Mark any tool that changes external state (create, modify, delete) as a write action. Read-only tools must be side-effect-free and safe to retry. Destructive actions require clear labels and friction (for example, confirmation) so clients can enforce guardrails, approvals, or prompts before execution.
*   **Preventing data exfiltration:** Any action that sends data outside the current boundary (for example, posting messages, sending emails, or uploading files) must be surfaced to the client as a write action so it can require user confirmation or run in preview mode. This reduces unintentional data leakage and aligns server behavior with client-side security expectations.

## Developer verification

### Verification

All submissions must come from verified individuals or organizations. Once the submission process opens broadly, we will provide a straightforward way to confirm your identity and affiliation with any represented business. Repeated misrepresentation, hidden behavior, or attempts to game the system will result in removal from the program.

### Support contact details

Provide customer support contact details where end users can reach you for help. Keep this information accurate and up to date.

## After submission

### Reviews and checks

We may perform automated scans or manual reviews to understand how your app works and whether it may conflict with our policies. If your app is rejected or removed, you will receive feedback and may have the opportunity to appeal.

### Maintenance and removal

Apps that are inactive, unstable, or no longer compliant may be removed. We may reject or remove any app from our services at any time and for any reason without notice, such as for legal or security concerns or policy violations.

### Re-submission for changes

Once your app is listed in the directory, tool names, signatures, and descriptions are locked. To change or add tools, you must resubmit the app for review.

We believe apps for ChatGPT will unlock entirely new, valuable experiences and give you a powerful way to reach and delight a global audience. We’re excited to work together and see what you build.