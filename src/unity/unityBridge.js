const handlers = new Map(); // eventName -> Set(fn)
const globalHandlers = new Set(); // handlers that receive every message: (type, payload, meta)
// centralize the DOM event name so it can be changed in one place
const UNITY_MESSAGE_EVENT = 'UnityMessage';
let unityInstance = null;
let queuedSends = [];
let _readyPromise = null;
let _readyResolve = null;
let _globalListenerInstalled = false;
// store the actual window listener so it can be removed on HMR/module dispose
let _windowUnityMessageListener = null;

function _ensureReadyPromise() {
    if (!_readyPromise) {
        _readyPromise = new Promise((resolve) => { _readyResolve = resolve; });
    }
    return _readyPromise;
}


function registerHandler(eventName, fn) {
    if (!handlers.has(eventName)) handlers.set(eventName, new Set());
    handlers.get(eventName).add(fn);
}

function unregisterHandler(eventName, fn) {
    const s = handlers.get(eventName);
    if (s) {
        s.delete(fn);
        if (s.size === 0) handlers.delete(eventName);
    }
}

function emitToHandlers(eventName, payload) {
    const s = handlers.get(eventName);
    if (!s) return;
    for (const fn of Array.from(s)) {
        try { fn(payload); } catch (e) { console.error('unityBridge handler error', e); }
    }
}

function registerGlobalHandler(fn) {
    if (typeof fn === 'function') globalHandlers.add(fn);
}

function unregisterGlobalHandler(fn) {
    if (globalHandlers.has(fn)) globalHandlers.delete(fn);
}

function emitToGlobalHandlers(type, payload, meta) {
    for (const fn of Array.from(globalHandlers)) {
        try { fn(type, payload, meta); } catch (e) { console.error('unityBridge global handler error', e); }
    }
}

function setInstance(instance) {
    unityInstance = instance;
    // flush queued sends
    if (unityInstance && queuedSends.length > 0) {
        for (const item of queuedSends) {
            try { doSend(item.objectName, item.methodName, item.payload); } catch (e) { /* swallow */ }
        }
        queuedSends = [];
    }
    // resolve any pending whenReady promise
    if (_readyResolve) {
        try { _readyResolve(unityInstance); } catch (e) { /* ignore */ }
        _readyPromise = null;
        _readyResolve = null;
    }
}

function clearInstance() {
    unityInstance = null;
    queuedSends = [];
    // reset ready promise so callers can await next instance
    _readyPromise = null;
    _readyResolve = null;
}

function doSend(objectName, methodName, payload) {
    if (!unityInstance || typeof unityInstance.SendMessage !== 'function') return false;
    let arg = payload;
    if (payload !== undefined && typeof payload !== 'string') {
        try { arg = JSON.stringify(payload); } catch (e) { arg = String(payload); }
    }
    try {
        unityInstance.SendMessage(objectName, methodName, arg);
        return true;
    } catch (err) {
        console.error('unityBridge SendMessage failed', err);
        return false;
    }
}

function send(objectName, methodName, payload, { queue = true } = {}) {
    if (unityInstance && typeof unityInstance.SendMessage === 'function') {
        return doSend(objectName, methodName, payload);
    }
    if (queue) {
        queuedSends.push({ objectName, methodName, payload });
        return true;
    }
    return false;
}

function whenReady() {
    if (unityInstance) return Promise.resolve(unityInstance);
    return _ensureReadyPromise();
}

// Wire global window events to emitToHandlers. Consumers still need to register handlers.
function _initGlobalListener() {
    if (typeof window === 'undefined') return;
    // Avoid double-installing the same listener (HMR / re-imports)
    if (_globalListenerInstalled) return;
    _globalListenerInstalled = true;

    // Single 'UnityMessage' event carrying { type, payload, meta }
    _windowUnityMessageListener = (e) => {
        const detail = e && 'detail' in e ? e.detail : undefined;
        if (!detail || typeof detail !== 'object') return;
        const { type, payload } = detail;
        // only skip if type is null/undefined; allow 0 or empty-string if ever used
        if (type === undefined || type === null) return;
        // normalize payload: if Unity sent a JSON string, parse it so handlers receive
        // an object when possible (backwards-compatible with non-JSON strings)
        let normalized = payload;
        if (typeof payload === 'string') {
            try {
                normalized = JSON.parse(payload);
            } catch (err) {
                // keep original string if it isn't valid JSON
            }
        }
        // route typed message to handlers registered under the type name
        emitToHandlers(type, normalized);
        // also call any global handlers that want to observe all messages
        emitToGlobalHandlers(type, normalized, detail && detail.meta);
    };
    window.addEventListener(UNITY_MESSAGE_EVENT, _windowUnityMessageListener);
}


_initGlobalListener();

// HMR: remove the listener on module dispose to avoid duplicate listeners
if (typeof import.meta !== 'undefined' && import.meta.hot && typeof import.meta.hot.dispose === 'function') {
    import.meta.hot.dispose(() => {
        try {
                if (_windowUnityMessageListener && typeof window !== 'undefined') {
                window.removeEventListener(UNITY_MESSAGE_EVENT, _windowUnityMessageListener);
            }
        } catch (e) {
            // ignore
        }
        _windowUnityMessageListener = null;
        _globalListenerInstalled = false;
    });
}

export default {
    registerHandler,
    unregisterHandler,
    registerGlobalHandler,
    unregisterGlobalHandler,
    setInstance,
    clearInstance,
    send,
    whenReady,
};
