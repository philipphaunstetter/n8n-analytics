# Font Size Audit - Elova n8n Analytics

This document tracks all font sizes used across the application for future typography standardization work.

## Current Font Size Usage

### Text Sizes (Tailwind Classes)

#### text-xs (0.75rem / 12px)
- **Components:**
  - Badge labels
  - Table cell content
  - Helper text / hints
  - Timestamps
  - Metadata information
  - Copy button labels
  - Dropdown menu items
  - Input helper text
  - Toast messages (secondary)
  - Execution timeline timestamps
  - Node output counts
  - Duration indicators

- **Files:**
  - `src/app/executions/[id]/page.tsx` (timeline dates, metadata)
  - `src/app/executions/page.tsx` (table data, badges)
  - `src/app/workflows/page.tsx` (metadata)
  - `src/app/history/page.tsx` (sync details)
  - `src/components/badge.tsx`
  - `src/components/dropdown.tsx`
  - `src/components/input.tsx`

#### text-sm (0.875rem / 14px)
- **Components:**
  - Body text
  - Form labels
  - Button text
  - Card descriptions
  - List items
  - Navigation items
  - Secondary headings
  - Error messages
  - Success messages
  - Table headers
  - Stats card labels
  - Node names in execution timeline

- **Files:**
  - `src/app/executions/[id]/page.tsx` (node names, descriptions)
  - `src/app/executions/page.tsx` (filters, body text)
  - `src/app/workflows/[id]/page.tsx` (stats, metadata)
  - `src/app/dashboard/page.tsx` (descriptions)
  - `src/components/button.tsx`
  - `src/components/select.tsx`
  - `src/components/table.tsx`
  - `src/components/fieldset.tsx`
  - `src/components/sidebar.tsx`

#### text-base (1rem / 16px)
- **Components:**
  - Primary body text
  - Main content
  - Form inputs (default)
  - Larger list items
  - Important descriptions

- **Files:**
  - `src/components/text.tsx` (default)
  - `src/components/input.tsx`
  - `src/components/textarea.tsx`
  - Default browser base size

#### text-lg (1.125rem / 18px)
- **Components:**
  - Section headings
  - Card titles
  - Stats values
  - Important metrics
  - Modal titles
  - Workflow stats

- **Files:**
  - `src/app/workflows/[id]/page.tsx` (stats values, section titles)
  - `src/app/executions/[id]/page.tsx` (stats values)
  - `src/app/dashboard/page.tsx` (metric values)
  - `src/components/heading.tsx`
  - `src/components/dialog.tsx`

#### text-xl (1.25rem / 20px)
- **Components:**
  - Minor page titles
  - Important section headings
  - Featured stats

- **Usage:** Limited, mostly for emphasis

#### text-2xl (1.5rem / 24px)
- **Components:**
  - Page titles (h1)
  - Primary headings
  - Hero sections
  - Main workflow/execution titles

- **Files:**
  - `src/app/workflows/[id]/page.tsx` (page title)
  - `src/app/executions/[id]/page.tsx` (page title)
  - `src/app/executions/page.tsx` (page title)
  - `src/app/workflows/page.tsx` (page title)
  - `src/app/dashboard/page.tsx` (page title)
  - `src/app/history/page.tsx` (page title)
  - `src/components/heading.tsx`

#### text-3xl (1.875rem / 30px)
- **Usage:** Rare, only for special emphasis or hero sections

#### text-4xl (2.25rem / 36px)
- **Usage:** Very rare, marketing/landing pages only

## Recommendations for Standardization

### Suggested Typography Scale

```
text-xs   (12px) - Metadata, timestamps, badges
text-sm   (14px) - Body text, labels, buttons (PRIMARY)
text-base (16px) - Form inputs, important body text
text-lg   (18px) - Section headings, stat values
text-xl   (20px) - Page subtitles
text-2xl  (24px) - Page titles (h1)
text-3xl+ (30px+) - Reserved for marketing/special cases
```

### Issues to Address

1. **Inconsistent Body Text**: Mix of `text-sm` and `text-base` across pages
2. **Stats Inconsistency**: Some use `text-lg`, others use `text-xl` for similar metrics
3. **Button Sizes**: Multiple font sizes for buttons depending on context
4. **Timeline Density**: Recently adjusted, but should verify against other list views
5. **Table Text**: Mix of `text-xs` and `text-sm` in different tables

### Areas Needing Review

- [ ] All page titles (ensure consistent `text-2xl`)
- [ ] All stat cards (standardize to `text-lg` for values)
- [ ] All body text (pick either `text-sm` or `text-base` as default)
- [ ] All table content (consistent sizing)
- [ ] All button text (unified sizing)
- [ ] All form labels (consistent sizing)
- [ ] All metadata/helper text (consistent `text-xs`)
- [ ] Navigation items (consistent sizing)

## Files to Review for Standardization

### High Priority (User-Facing Pages)
1. `src/app/dashboard/page.tsx`
2. `src/app/executions/page.tsx`
3. `src/app/executions/[id]/page.tsx` ✓ (recently updated)
4. `src/app/workflows/page.tsx`
5. `src/app/workflows/[id]/page.tsx`
6. `src/app/analytics/page.tsx`
7. `src/app/history/page.tsx`

### Medium Priority (Setup/Admin)
8. `src/app/setup/wizard/page.tsx`
9. `src/app/setup/admin/page.tsx`
10. `src/app/profile/page.tsx`
11. `src/app/providers/page.tsx`

### Low Priority (Components)
12. `src/components/table.tsx`
13. `src/components/badge.tsx`
14. `src/components/button.tsx`
15. `src/components/heading.tsx`

## Next Steps

1. **Define Typography System**: Create a design system document with clear rules
2. **Component Audit**: Review each component for font size consistency
3. **Page Standardization**: Apply consistent sizing across all pages
4. **Create Variants**: Define clear component variants (small, medium, large)
5. **Documentation**: Update component docs with proper size usage guidelines

---

*Last Updated: 2025-10-30*
*Created for typography standardization effort*
