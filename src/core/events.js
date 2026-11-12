/* ================================================================
   events.js — tiny publish/subscribe bus.
   Used to decouple core/ from ui/, three/, and llm/.
   Modules never import each other directly for notifications;
   they emit and subscribe by string name.
   ================================================================ */

const listeners = new Map();

export const events = {
  /**
   * Subscribe to an event.
   * @param {string} name
   * @param {(payload: any) => void} handler
   * @returns {() => void} unsubscribe function
   */
  on(name, handler) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(handler);
    return () => events.off(name, handler);
  },

  /**
   * Unsubscribe a previously attached handler.
   */
  off(name, handler) {
    const set = listeners.get(name);
    if (set) {
      set.delete(handler);
      if (set.size === 0) listeners.delete(name);
    }
  },

  /**
   * Subscribe for exactly one emission.
   */
  once(name, handler) {
    const wrapper = (payload) => {
      events.off(name, wrapper);
      handler(payload);
    };
    return events.on(name, wrapper);
  },

  /**
   * Emit an event. Handler errors are isolated so one listener
   * can't break the others.
   */
  emit(name, payload) {
    const set = listeners.get(name);
    if (set) {
      // Copy to array so handlers that unsubscribe mid-emit are safe
      for (const handler of Array.from(set)) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[events] handler for "${name}" threw:`, err);
        }
      }
    }

    // Optional wildcard listeners for debugging
    const wildcards = listeners.get('*');
    if (wildcards) {
      for (const handler of Array.from(wildcards)) {
        try {
          handler({ name, payload });
        } catch (err) {
          console.error(`[events] wildcard handler threw:`, err);
        }
      }
    }
  },

  /** Remove all listeners (used by tests / hard reset). */
  reset() {
    listeners.clear();
  },
};