# Onboarding Components

## WelcomeModal

A first-time user onboarding modal that appears after a user's first login to EMTChat.

### Features

- **One-time display**: Shows only once per browser using localStorage
- **3-step guide**: Introduces users to core features with icons
- **Dark theme support**: Compatible with app's theme system
- **Non-intrusive**: 500ms delay before showing for better UX
- **User control**: "Don't show again" checkbox option

### Usage

The component is automatically rendered in the chat page (`/app/chat/page.tsx`):

```tsx
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';

// Inside your component
<WelcomeModal />
```

### LocalStorage Key

The component uses the key `emtchat_onboarding_complete` to track whether the user has seen the modal.

To manually reset for testing:
```javascript
localStorage.removeItem('emtchat_onboarding_complete');
```

### Steps Shown

1. **Upload your protocols**: Upload your EMS protocols or documents
2. **Ask questions**: Ask questions about your protocols in natural language
3. **Get instant answers**: Receive accurate, instant answers backed by your protocols

### Customization

To modify the content:
- Edit the text in `WelcomeModal.tsx`
- Change icons by importing different icons from `lucide-react`
- Adjust timing by modifying the `setTimeout` delay value (currently 500ms)

### Components Used

- `Dialog` family from `@/components/ui/dialog`
- `Button` from `@/components/ui/button`
- `Label` from `@/components/ui/label`
- Icons from `lucide-react` (FileUp, MessageSquare, Zap)
