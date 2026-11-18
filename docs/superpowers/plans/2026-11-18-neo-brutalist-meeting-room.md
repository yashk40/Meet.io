# Neo-Brutalist Meeting Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the in-meeting room view (`/r/:roomId`, rendered via `public/room.html` and styled in `public/css/style.css`) into the exact dark Neo-Brutalist aesthetic from the user's reference design (`media_1794983314491_b3d46e9a.jpg`), featuring high-contrast white borders, lavender-purple (`#A78BFA`) offset 3D plates, electric lime (`#D4FF00`) accents, rounded-square dark controls, and responsive layouts across desktop, tablet, and mobile.

**Architecture:** Pure CSS styling grounded in Neo-Brutalist design tokens applied to existing HTML markup in `public/room.html`. Existing WebRTC, Socket.IO, Lucide icons, and state classes (`.speaking`, `.is-pinned`, `.active`, `.active-off`) are preserved intact without modifying business logic.

**Tech Stack:** Vanilla CSS3 (Custom Properties, Flexbox, CSS Grid, 3D layered box-shadows, media queries), Vanilla JS (DOM manipulation & WebRTC), Lucide Icons.

**Spec:** User reference design `media_1794983314491_b3d46e9a.jpg` and previous turn design agreement.

## Global Constraints

- Background canvas: Deep dark studio `#0D0E15` / `#0E0F16`.
- Accent colors: Lavender Purple `#A78BFA`, Electric Neon Lime `#D4FF00`, Coral Red `#FF4D4D`, Pure Black `#000000`, Pure White `#FFFFFF`.
- 3D Offset Plates: Solid layered shadows (`box-shadow: Xpx Ypx 0 0 #A78BFA, Xpx Ypx 0 2px #000;`) - NO soft blurred drop shadows.
- Border widths: Crisp 2px to 2.5px solid borders.
- Interactive states: Tactile press translation on click/active (`transform: translate(2px, 2px); box-shadow: reduced;`).
- Responsiveness: Flawless scaling on phones (`<= 768px`) and tablets (`<= 1024px`) without horizontal overflow or clipped buttons.
- No regression: All existing WebRTC media streaming, mic/camera toggles, screen sharing PIP, in-call chat, and participant list functionality must continue working without errors.

## Review Focus

1. **Header Pill Offsets**: In-meeting top pills (Room ID, Timer, Layout CTA) maintain crisp lavender backing plates and align cleanly on all screen widths.
2. **Video Stage Multi-Tile Scaling**: When 2+ participants join, `.video-tile` 3D shadows and borders scale smoothly in CSS grid without overlapping or causing overflow.
3. **Footer Island Button Sizing**: Control buttons are rounded squares (`12px` border radius) with solid dark backgrounds (`#1E2130`), red coral end-call button, and lime participant badge.
4. **Side Drawer & Modal Neo-Brutalism**: Chat drawer, participants list, and layout modal use dark backgrounds, white 2px borders, and purple offset backing shadows.
5. **Mobile Viewport Breathing Room**: On mobile devices (`<= 768px`), controls, header pills, and video tiles stay within the safe area with appropriate touch targets.

---

### Task 1: Dark Neo-Brutalist Theme Variables & Top Header Redesign

**Files:**
- Modify: `public/css/style.css:1152-1295`
- Test: Manual visual inspection of `http://localhost:3000/r/test-meeting` in browser

**Interfaces:**
- Consumes: `#displayRoomId`, `#btnCopyInvite`, `#callTimer`, `#btnLayoutMenu`, `#btnHeaderPeople`, `.live-pulse` in `public/room.html`
- Produces: Scoped Neo-Brutalist styles for the top navigation bar and floating header chips

- [ ] **Step 1: Inspect and update `.room-body` and `.room-header` in `public/css/style.css`**
  - Set `.room-body` background to `#0D0E15`.
  - Set `.room-header` background to `transparent` (remove backdrop blur border line) with `padding: 14px 20px; height: auto;`.

- [ ] **Step 2: Style Room Pill (`.room-pill`) and Timer Pill (`.timer-chip`)**
  - Background: `#000000`.
  - Border: `2px solid #FFFFFF`.
  - Border-radius: `12px`.
  - Color: `#FFFFFF`, font-weight: `700`.
  - Box-shadow: `0 5px 0 0 #A78BFA, 0 5px 0 2px #000000`.
  - Active/hover: Subtle hover lift, live pulse dot in neon green (`#10B981` or `#D4FF00`).
  - Copy button: Crisp white icon, hover effect.

- [ ] **Step 3: Style Layout Button (`#btnLayoutMenu`) & Mobile Header People Button (`#btnHeaderPeople`)**
  - `#btnLayoutMenu`: Background `#D4FF00` (electric lime), color `#000000`, font-weight `800`, border `2px solid #000000`, border-radius `12px`, box-shadow `0 5px 0 0 #A78BFA, 0 5px 0 2px #000000`.
  - `#btnHeaderPeople`: Background `#000000`, color `#FFFFFF`, border `2px solid #FFFFFF`, border-radius `12px`, box-shadow `0 5px 0 0 #A78BFA, 0 5px 0 2px #000000`.

- [ ] **Step 4: Verify top header appearance**
  - Verify header elements match `media_1794983314491_b3d46e9a.jpg` with the 3 top pills cleanly positioned and styled.

---

### Task 2: Neo-Brutalist Video Stage & Tiles Redesign

**Files:**
- Modify: `public/css/style.css:1296-1500`
- Test: Manual visual inspection of `http://localhost:3000/r/test-meeting` with live camera and fallback avatar

**Interfaces:**
- Consumes: `.stage-container`, `.video-grid`, `.video-tile`, `.tile-bottom-bar`, `.participant-name`, `.tile-status`, `.avatar-fallback`
- Produces: Thick white-bordered video containers with lavender offset backing plates and neo-brutalist participant labels

- [ ] **Step 1: Update `.room-main` and `.stage-container` layout and spacing**
  - Ensure `.room-main` provides sufficient padding (`padding: 12px 18px 84px 18px;`) for the 3D offset shadow and floating footer island.

- [ ] **Step 2: Style `.video-tile` container with Neo-Brutalist 3D backing plate**
  - Background: `#000000`.
  - Border: `2.5px solid #FFFFFF`.
  - Border-radius: `22px`.
  - Box-shadow: `8px 10px 0 0 #A78BFA, 8px 10px 0 2.5px #000000`.
  - Ensure `overflow: hidden;` keeps video feed within the rounded corners.

- [ ] **Step 3: Style Active Speaker (`.video-tile.speaking`) & Pinned State (`.video-tile.is-pinned`)**
  - Speaking: Border `2.5px solid #D4FF00` and box-shadow `8px 10px 0 0 #D4FF00, 8px 10px 0 2.5px #000000`.
  - Pinned: Border `2.5px solid #A78BFA` and box-shadow `8px 10px 0 0 #A78BFA, 8px 10px 0 2.5px #000000`.

- [ ] **Step 4: Style Participant Name Tag (`.tile-bottom-bar`)**
  - Position: Absolute bottom-left (`bottom: 14px; left: 14px;`).
  - Background: `#000000`.
  - Border: `1.5px solid #FFFFFF`.
  - Border-radius: `10px`.
  - Padding: `6px 12px`.
  - Box-shadow: `2px 2px 0 0 #A78BFA, 2px 2px 0 1px #000000`.
  - Text: `#FFFFFF`, font-weight `700`, font-size `0.82rem`.
  - Status icons (mic, hand): Crisp white / warning yellow.

- [ ] **Step 5: Verify Video Tile in Single and Multi-tile grid**
  - Confirm video feed renders with rounded corners, 3D lavender plate, and crisp bottom participant tag.

---

### Task 3: Neo-Brutalist Floating Studio Island Footer Redesign

**Files:**
- Modify: `public/css/style.css:1675-1805`
- Test: Manual visual inspection of footer controls in `http://localhost:3000/r/test-meeting`

**Interfaces:**
- Consumes: `.room-footer`, `.control-group`, `.control-btn`, `.btn-danger`, `#footerPeopleBadge`, `#btnReactionTrigger`, `#reactionPicker`
- Produces: Floating dark studio island with rounded square dark buttons, red leave button, and neon-lime participants badge

- [ ] **Step 1: Style `.room-footer` container**
  - Background: `#141622` (dark studio charcoal).
  - Border: `2px solid #FFFFFF`.
  - Border-radius: `18px`.
  - Padding: `8px 14px`.
  - Height: `auto`.
  - Box-shadow: `4px 7px 0 0 #A78BFA, 4px 7px 0 2px #000000`.
  - Remove vertical dividing lines between control groups (`.control-group::after { display: none !important; }`).

- [ ] **Step 2: Style standard control buttons (`.control-btn`) as rounded squares**
  - Dimensions: `width: 46px; height: 46px; min-width: 46px; min-height: 46px;`.
  - Border-radius: `12px` (rounded square, matching reference image).
  - Background: `#1E2130`.
  - Border: `1.5px solid #2B2F42`.
  - Box-shadow: `2px 2px 0 0 #000000`.
  - Color: `#FFFFFF`.
  - Hover: Background `#2A2F45`, border `#FFFFFF`, `transform: translateY(-2px); box-shadow: 2px 4px 0 0 #000000;`.
  - Active: `transform: translate(1px, 1px); box-shadow: 1px 1px 0 0 #000000;`.

- [ ] **Step 3: Style Muted/Warning/Active button states**
  - Muted/Off (`.active-off`): Background `#3B1C22`, border `1.5px solid #EF4444`, color `#EF4444`.
  - Active/On (`.active`): Background `#1E293B`, border `1.5px solid #38BDF8`, color `#38BDF8`.
  - Hand Raised (`.active-warning`): Background `#3B2E14`, border `1.5px solid #F59E0B`, color `#F59E0B`.

- [ ] **Step 4: Style End Call Danger Button (`.btn-danger`)**
  - Dimensions: `width: 46px; height: 46px; min-width: 46px; min-height: 46px;`.
  - Background: `#FF4D4D` (vibrant coral red).
  - Border: `2px solid #000000`.
  - Border-radius: `12px`.
  - Color: `#FFFFFF`.
  - Box-shadow: `2px 2px 0 0 #000000`.
  - Hover: Background `#FF3333`, `transform: translateY(-2px); box-shadow: 2px 4px 0 0 #000000;`.

- [ ] **Step 5: Style Participant Count Badge (`#footerPeopleBadge`)**
  - Background: `#D4FF00` (neon lime yellow).
  - Color: `#000000`.
  - Border: `2px solid #000000`.
  - Font-weight: `800`.
  - Border-radius: `50%`.
  - Position: `top: -4px; right: -4px;`.

- [ ] **Step 6: Style Emoji Reaction Picker (`.reaction-picker`)**
  - Background: `#141622`.
  - Border: `2px solid #FFFFFF`.
  - Border-radius: `14px`.
  - Box-shadow: `4px 6px 0 0 #A78BFA, 4px 6px 0 2px #000000`.
  - Emoji buttons with smooth hover bounce.

---

### Task 4: Neo-Brutalist Side Drawers, Modals & Notification Popups

**Files:**
- Modify: `public/css/style.css:1875-2360`
- Test: Open Chat drawer, People drawer, and Layout modal in browser

**Interfaces:**
- Consumes: `#chatDrawer`, `#peopleDrawer`, `#layoutModal`, `.modal-card`, `.layout-card`, `.ios-notification-banner`, `.toast`
- Produces: Dark Neo-Brutalist styling for drawers, modals, input forms, and toast alerts

- [ ] **Step 1: Style Side Drawers (`.side-drawer`)**
  - Background: `#141622`.
  - Border: `2px solid #FFFFFF`.
  - Border-radius: `18px`.
  - Box-shadow: `-6px 8px 0 0 #A78BFA, -6px 8px 0 2px #000000`.
  - Drawer header: Border-bottom `1.5px solid #2B2F42`, bold white title.
  - Chat input form: Dark input field (`#1E2130`), `1.5px solid #2B2F42`, white text; neon lime or purple send button with black border and offset shadow.

- [ ] **Step 2: Style Layout Modal (`.modal-card`)**
  - Background: `#141622`.
  - Border: `2.5px solid #FFFFFF`.
  - Border-radius: `20px`.
  - Box-shadow: `8px 10px 0 0 #A78BFA, 8px 10px 0 2.5px #000000`.
  - Layout cards (`.layout-card`): Dark background `#1E2130`, border `1.5px solid #2B2F42`, `border-radius: 12px`.
  - Active layout card (`.layout-card.active`): Border `2px solid #D4FF00`, background `rgba(212, 255, 0, 0.08)`, box-shadow `2px 2px 0 0 #D4FF00`.

- [ ] **Step 3: Style Apple Chat Notification Banner & Toasts**
  - `#iosChatNotification`: Background `#141622`, border `2px solid #FFFFFF`, border-radius `14px`, box-shadow `0 6px 0 0 #A78BFA, 0 6px 0 2px #000000`.
  - `.toast`: Background `#141622`, border `2px solid #FFFFFF`, border-radius `12px`, box-shadow `2px 3px 0 0 #A78BFA, 2px 3px 0 1.5px #000000`.

---

### Task 5: Mobile & Tablet Responsiveness Optimization & Final Verification

**Files:**
- Modify: `public/css/style.css:2400-2650`
- Test: Responsive mode testing in browser at 375px (mobile), 768px (tablet), and 1280px (desktop)

**Interfaces:**
- Consumes: Media queries `@media (max-width: 768px)` and `@media (max-width: 1024px)`
- Produces: Pixel-perfect, comfortable touch layouts on mobile and tablet without horizontal scrollbars or clipping

- [ ] **Step 1: Refine Mobile Header (`@media (max-width: 768px)`)**
  - Reduce header padding (`padding: 8px 12px;`).
  - Scale pill fonts and padding appropriately.
  - Ensure Room Pill, Timer Chip, and Layout/People buttons fit side-by-side gracefully.

- [ ] **Step 2: Refine Mobile Video Grid & Tiles**
  - Set `.video-tile` 3D shadow on mobile to `4px 6px 0 0 #A78BFA, 4px 6px 0 2px #000000` to prevent viewport clipping.
  - Set `.video-tile` border-radius to `16px`.

- [ ] **Step 3: Refine Mobile Footer Island**
  - Control button size: `42px x 42px`, `border-radius: 10px`.
  - Ensure the footer island stays centered and fits within `calc(100vw - 20px)` with adequate thumb spacing.
  - Drawer converts smoothly into mobile bottom sheet (`bottom: 0; left: 0; right: 0; width: 100%; border-radius: 20px 20px 0 0;`).

- [ ] **Step 4: End-to-End Verification across Desktop and Mobile**
  - Verify meeting room `/r/test-neo-meet` on desktop.
  - Verify meeting room on mobile viewport emulation.
  - Test joining from second tab or device to confirm 2-participant grid styling and audio/video controls.
