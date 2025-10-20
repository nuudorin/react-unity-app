import unityBridge from './unityBridge';

/**
 * Send a message to Unity.
 *
 * This wrapper expects explicit `objectName` and `methodName` parameters to
 * target a specific GameObject method in Unity. If provided, the call is
 * forwarded to the low-level `unityBridge.send` which handles queuing when the
 * instance is not yet available.
 *
 * Note: non-string payloads will be JSON-stringified by the bridge before
 * calling Unity's `SendMessage`.
 *
 * @param {any} payload - The payload to send to Unity (object, string, number, etc.).
 * @param {string} objectName - Unity GameObject name to call.
 * @param {string} methodName - Method name on the Unity object to invoke.
 * @param {boolean} [queue=true] - Whether to queue the message if Unity isn't ready.
 * @returns {boolean} true if the message was sent or queued, false otherwise.
 */
function send(payload, objectName, methodName, queue = true) {
    if (objectName && methodName) {
        return unityBridge.send(objectName, methodName, payload, { queue });
    }
    console.warn('[unity.api] send: no object/method provided.');
    return false;
}

/**
 * Register a typed handler for messages coming from Unity.
 *
 * Handlers receive the normalized payload for matching messages. Returns an
 * unsubscribe function that will remove the handler when called.
 *
 * @param {string} event - The Unity message type to listen for (detail.type).
 * @param {function(any):void} handler - Function called with the message payload.
 * @returns {function():void} unsubscribe function.
 */
function on(event, handler) {
    if (typeof handler !== 'function') {
        try { console.warn('[unity.api] on: handler must be a function'); } catch (e) { }
        return () => { };
    }
    unityBridge.registerHandler(event, handler);
    return () => unityBridge.unregisterHandler(event, handler);
}

/**
 * Unregister a previously registered per-type handler.
 *
 * @param {string} event - The event type the handler was registered for.
 * @param {function(any):void} handler - The same function reference that was passed to `on`.
 * @returns {void}
 */
function off(event, handler) {
    if (typeof handler !== 'function') {
        try { console.warn('[unity.api] off: handler must be a function'); } catch (e) { }
        return;
    }
    return unityBridge.unregisterHandler(event, handler);
}

/**
 * Register a global message observer receiving every Unity message.
 * The handler is called as (type, payload, meta).
 *
 * @param {function(string, any, any):void} handler - (type, payload, meta)
 * @returns {function():void} unsubscribe function.
 */
function onMessage(handler) {
    if (typeof handler !== 'function') {
        try { console.warn('[unity.api] onMessage: handler must be a function'); } catch (e) { }
        return () => { };
    }
    unityBridge.registerGlobalHandler(handler);
    return () => unityBridge.unregisterGlobalHandler(handler);
}


/**
 * Unregister a previously registered global message handler.
 *
 * @param {function(string, any, any):void} handler - The same function reference passed to `onMessage`.
 * @returns {void}
 */
function offMessage(handler) {
    if (typeof handler !== 'function') {
        try { console.warn('[unity.api] offMessage: handler must be a function'); } catch (e) { }
        return;
    }
    return unityBridge.unregisterGlobalHandler(handler);
}


/**
 * Return a promise that resolves when a Unity instance becomes available.
 * If an instance already exists, the returned promise resolves immediately.
 *
 * @returns {Promise<any>} resolves with the Unity instance object (exposes SendMessage).
 */
function whenReady() {
    return unityBridge.whenReady();
}



export default {
    send,
    on,
    off,
    whenReady,
    onMessage,
    offMessage,
};
