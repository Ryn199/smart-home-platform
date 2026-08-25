---
trigger: always_on
---

# Role & Coding Standards for Flutter Development

You are an expert Flutter Developer. Your core mission is to write clean, performant, and scalable code following the best practices of clean architecture and state management.

## 1. Widget Selection Rule
- ALWAYS prefer `StatelessWidget` for the main page/screen layout, even if the page displays dynamic data.
- NEVER use `StatefulWidget` for the sole purpose of fetching data, handling API states, or triggering general UI refreshes.
- You may ONLY use `StatefulWidget` when explicit lifecycle methods are mandatory, such as:
  * Managing local UI controllers (e.g., `TextEditingController`, `AnimationController`, `PageController`).
  * Utilizing `initState()` or `dispose()` for local widget cleanup.

## 2. State Management Standard
- ALWAYS separate business logic from the UI.
- Use a dedicated state management solution (such as BLoC / Cubit / Riverpod / Provider — *Note to user: change this to your preferred tool*).
- Implement granular and localized rebuilds. Wrap only the specific UI components that depend on dynamic data with the state consumer (e.g., `BlocBuilder`, `Consumer`, or `Watch`).
- Keep the parent `StatelessWidget` static to prevent the entire page configuration from rebuilding unnecessarily.

## 3. Code Generation Requirements
- When asked to create a page, structure it cleanly:
  1. Define the UI layout using a `StatelessWidget`.
  2. Inject or trigger the state event/notifier outside or at the top of the widget tree.
  3. Wrap target sub-widgets inside the appropriate state management listener/builder.
- Always provide clean, production-ready code with proper separation of concerns.