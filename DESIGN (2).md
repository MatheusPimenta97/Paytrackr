# Design System Document: The Sovereign Ledger

## 1. Overview & Creative North Star
**The Creative North Star: "The Architectural Anchor"**
This design system moves away from the frantic, cluttered nature of traditional fintech. Instead, it adopts the persona of a "Sovereign Ledger"—an interface that feels as stable as a vaulted bank but as fluid as modern capital. We achieve this through **Architectural Depth**: a method of layout that favors structural layering and tonal shifts over decorative lines. By utilizing intentional asymmetry and expansive breathing room, we transform financial data from a chore into a curated editorial experience. This is not just a dashboard; it is an authoritative command center.

---

## 2. Colors: Tonal Authority
Our palette is rooted in the "Deep Blue" of stability and the "Forest Green" of organic growth. However, the secret to a premium feel lies in the *absence* of harsh lines.

### The Palette
- **Primary (`#001d44`):** The foundation. Used for high-level navigation and deep-seated brand authority.
- **Secondary (`#1b6d24`):** The "Growth Engine." Used exclusively for positive financial indicators, profit metrics, and success states.
- **Surface & Background (`#f3faff`):** A cool-tinted white that reduces eye strain and feels more sophisticated than a sterile `#ffffff`.

### The "No-Line" Rule
**Borders are prohibited for sectioning.** To define the transition between the sidebar and the main content, or between a card and the background, you must use background color shifts. 
*   *Example:* A `surface-container-low` section sitting on a `surface` background. The change in tone is the boundary.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the hierarchy of `surface-container` tokens to "lift" or "sink" content:
1.  **Base Layer:** `surface` (The canvas).
2.  **Sectional Layer:** `surface-container-low` (Grouping large content areas).
3.  **Active Component Layer:** `surface-container-lowest` (The "Sheet" effect for cards and data tables).

### The "Glass & Gradient" Rule
For floating action panels or top-level navigation, use **Glassmorphism**. Apply `surface` at 80% opacity with a `20px` backdrop-blur. For primary CTAs, use a subtle linear gradient from `primary` to `primary_container` to give the button a "weighted" feel that flat color cannot replicate.

---

## 3. Typography: Editorial Clarity
We pair the structural strength of **Manrope** for displays with the utilitarian perfection of **Inter** for data.

*   **Display & Headlines (Manrope):** These are your "Editorial Markers." Use `display-lg` (3.5rem) for total balance overviews. The wide tracking and geometric builds of Manrope convey modern sophistication.
*   **Body & Labels (Inter):** Inter is used for all transactional data. It is engineered for legibility at small sizes. 
*   **The Hierarchy Strategy:** Use `on-surface-variant` (`#43474f`) for secondary labels to create a clear "Visual Echo"—the eye should hit the bold `title-lg` amount first, then the muted `label-md` category second.

---

## 4. Elevation & Depth: Tonal Layering
In this system, shadow is a last resort, not a default.

*   **The Layering Principle:** Achieve depth by "stacking." Place a `surface-container-lowest` card (Pure White) on a `surface-container-low` section (Light Blue-Grey). This creates a soft, natural lift.
*   **Ambient Shadows:** When a modal or dropdown must float, use a "Shadow of Light." 
    *   *Spec:* `0px 20px 40px rgba(7, 30, 39, 0.06)`. The color is a tint of our `on-surface` token, ensuring the shadow looks like natural ambient occlusion rather than a "dirty" grey smudge.
*   **The "Ghost Border" Fallback:** If a layout feels too loose, you may use a Ghost Border. This is the `outline-variant` token at **15% opacity**. It should be felt, not seen.
*   **Glassmorphism:** Use for "floating" elements like Tooltips or Sticky Headers. It allows the vibrant financial charts underneath to bleed through, maintaining the user's context.

---

## 5. Components: Precision Primitives

### Cards (The Financial Metric Block)
*   **Construction:** Use `surface-container-lowest` with a `lg` (0.5rem / 8px) corner radius. 
*   **Detail:** No borders. Use `spacing-5` (1.1rem) for internal padding to ensure the numbers "breathe."

### Data Tables (The Transaction Ledger)
*   **The Rule:** **Forbid all horizontal and vertical divider lines.**
*   **Separation:** Use `spacing-3` for row height. Alternate row backgrounds using `surface` and `surface-container-low` for high-density data, or simply use vertical white space.
*   **Header:** Use `label-md` in `on-surface-variant`, all-caps with 0.05em tracking for an authoritative, ledger-like feel.

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. `md` (8px) radius. White text.
*   **Secondary:** Ghost style. No background, `outline-variant` ghost border (20% opacity), `primary` text.
*   **Interaction:** On hover, increase the `surface-tint` overlay by 8% to create a "glow" rather than a color change.

### Input Fields
*   **Style:** Minimalist. No bottom line or full box. Use a `surface-container-high` background with an `lg` radius. 
*   **Focus State:** Transition the background to `surface-container-lowest` and apply a 1px `primary` ghost border.

### Vibrant Charts
*   **Visual Philosophy:** Charts should be the "jewelry" of the system. 
*   **Color Application:** Use `secondary` for growth, `error` for loss, and `tertiary_fixed_dim` for neutral projections. Use area gradients (100% to 0% opacity) under line charts to create volume.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical margins (e.g., `spacing-16` on the left, `spacing-8` on the right) to create a custom, editorial feel.
*   **Do** rely on the `spacing-12` and `spacing-16` tokens to separate major modules. Modernity is defined by the luxury of space.
*   **Do** use `secondary_container` for positive "pills" or tags, ensuring the text is `on_secondary_container` for AA accessibility.

### Don't
*   **Don't** use `#000000` for shadows. Always use a tinted `on-surface` value.
*   **Don't** use 1px solid borders to separate the sidebar. Use a tonal shift from `surface-dim` to `surface`.
*   **Don't** crowd data. If a table feels "tight," increase the vertical spacing using the `spacing-4` token. 
*   **Don't** use sharp corners. Every element must adhere to the `lg` (8px) or `md` (6px) rounding to maintain the "Contemporary Stable" aesthetic.