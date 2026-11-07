// Lightweight event bus so game logic can request UI feedback without depending on the UI.
export type FeedbackKind = 'sale' | 'purchase' | 'milestone' | 'job' | 'event' | 'video' | 'achievement' | 'unlock' | 'opp' | 'info' | 'error';

export interface Feedback {
  kind: FeedbackKind;
  text: string;
  amount?: number;
  big?: boolean;
}

type Listener = (f: Feedback) => void;
const listeners = new Set<Listener>();

export const feedback = {
  emit(f: Feedback) {
    for (const l of listeners) l(f);
  },
  on(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
