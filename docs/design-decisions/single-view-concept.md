# Decision
Unify the concept of "View" and "Element" into a single data structure. A "View" is simply a `div` element with `isView: true`.

# Motivation
The codebase previously maintained two conflicting structures: a separate `View` interface and elements with view properties. This caused synchronization bugs, data duplication, and unnecessary complexity in the event reducer.

# Implications
- **Data Structure**: Removed `designState.views`. All items are in `designState.elements`.
- **Storage**: Root elements are stored in `Page.canvasElements`, not `View.elements`.
- **Migration**: Existing data requires migration to convert `viewId` references to `pageId`.

# Alternatives considered
- **Synchronization**: Keeping two structures and syncing them. Rejected due to complexity and risk of state drift.
