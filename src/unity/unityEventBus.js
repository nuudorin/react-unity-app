import unityApi from './unityApi';

/**
 * eventBus — a tiny in-process event bus for typed Unity messages.
 *
 * Purpose:
 * - Allow application code to subscribe to messages by `type` without writing switch blocks.
 * - Install a single global forwarder with `unityApi.onMessage` so we only register one DOM/global listener.
 *
 * Handler signature:
 * - Per-type handlers are called as (payload, meta).
 * - The global forwarder from the bridge calls into this bus as (type, payload, meta).
 *
 * HMR:
 * - The bus will attempt to uninstall the global forwarder when there are no subscribers and on module dispose.
 */

const subscribers = new Map(); // type -> Set(handler)

/**
 * Ensure a Set exists for the given message type and return it.
 * @param {string} type
 * @returns {Set<function>} set of handlers for the type
 */
function _ensureSet(type) {
    if (!subscribers.has(type)) subscribers.set(type, new Set());
    return subscribers.get(type);
}


/**
 * Global forwarder installed on the bridge; receives (type, payload, meta)
 * and dispatches to per-type subscribers as (payload, meta).
 * @param {string} type
 * @param {any} payload
 * @param {any} meta
 */
function _globalForwarder(type, payload, meta) {
    const s = subscribers.get(type);
    if (!s || s.size === 0) return;
    for (const fn of Array.from(s)) {
        try { fn(payload, meta); } catch (e) { console.error('unityEventBus handler error', e, type, payload); }
    }
}

// Register the single global forwarder with unityApi once
let _installed = false;

/**
 * Install the single global forwarder with the bridge (unityApi.onMessage).
 * This ensures we only register one global observer regardless of subscriber count.
 * Safe to call multiple times; installation is idempotent.
 */
function _install() {
    if (_installed) return;
    try {
        unityApi.onMessage(_globalForwarder);
        _installed = true;
    } catch (e) {
        // If registration fails, ensure we don't mark as installed
        console.error('unityEventBus: failed to install global forwarder', e);
    }
}

/**
 * Count the total number of subscribers across all types.
 * @returns {number}
 */
function _subscriberCount() {
    let count = 0;
    for (const s of subscribers.values()) count += s.size;
    return count;
}

/**
 * Uninstall the global forwarder when no subscribers remain.
 * This helps avoid unnecessary global listeners and keeps HMR clean.
 */
function _maybeUninstall() {
    if (!_installed) return;
    if (_subscriberCount() === 0) {
        try {
            unityApi.offMessage(_globalForwarder);
        } catch (e) {
            // ignore if offMessage is not available or fails
        }
        _installed = false;
    }
}


// HMR: ensure we remove the global forwarder on module dispose to avoid duplicate
// forwarders during hot reloads (Vite). This keeps dev runs clean.
if (typeof import.meta !== 'undefined' && import.meta.hot && typeof import.meta.hot.dispose === 'function') {
    import.meta.hot.dispose(() => {
        try {
            if (_installed) unityApi.offMessage(_globalForwarder);
        } catch (e) { /* ignore */ }
        _installed = false;
        subscribers.clear();
    });
}

/**
 * Subscribe to a typed Unity message.
 * @param {string} type - Unity message type to subscribe to (detail.type)
 * @param {function(any, any):void} handler - Called as (payload, meta)
 * @returns {function():void} unsubscribe function
 */
function subscribe(type, handler) {
    if (typeof handler !== 'function') return () => { };
    _install();
    const s = _ensureSet(type);
    s.add(handler);
    return () => unsubscribe(type, handler);
}

/**
 * Remove a previously registered handler for a given type.
 * @param {string} type
 * @param {function} handler
 */
function unsubscribe(type, handler) {
    const s = subscribers.get(type);
    if (!s) return;
    s.delete(handler);
    // If this removed the last subscriber, uninstall the global forwarder
    if (s.size === 0) subscribers.delete(type);
    _maybeUninstall();
}

/**
 * Subscribe to a single occurrence of a typed message.
 * The handler will be removed after it is invoked once.
 */
function once(type, handler) {
    if (typeof handler !== 'function') return;
    const wrapped = (payload, meta) => {
        try { handler(payload, meta); } finally { unsubscribe(type, wrapped); }
    };
    subscribe(type, wrapped);
}

/**
 * Clear subscribers. If `type` is omitted/null the entire bus is cleared.
 * @param {string?} type
 */
function clear(type) {
    if (type == null) {
        subscribers.clear();
        _maybeUninstall();
    } else {
        subscribers.delete(type);
        _maybeUninstall();
    }
}

export default {
    subscribe,
    unsubscribe,
    once,
    clear,
    getSubscriberCount: _subscriberCount,
};
