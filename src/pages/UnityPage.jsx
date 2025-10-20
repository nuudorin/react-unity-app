import { useEffect, useCallback } from 'react';
import UnityGame from "../components/unity/UnityGame";
import unityApi from "../unity/unityApi";
import { useGameResult } from '../data/GameResultContext';
import eventBus from '../unity/unityEventBus';

export default function UnityPage() {

    // -------------------------------------------------------------
    // Example: send initial data to Unity when ready

    // Example payload to send to Unity
    const payload = {
        timestamp: Date.now(),
        action: 'startRound',
        data: { difficulty: 'easy' },
        userData: {
            userId: "user-123",
            userName: "User"
        }
    };
    // Send user data once Unity is ready. Use an effect so we don't return a Promise from render.
    useEffect(() => {
        let mounted = true;
        unityApi.whenReady()
            .then(() => {
                if (!mounted) return;

                // Send to Unity object 'JSEventManager', method 'OnStartRound' (these are defined in Unity)
                unityApi.send(payload, "JSEventManager", "OnStartRound");
            })
            .catch((err) => {
                console.error('whenReady failed', err);
            });
        return () => { mounted = false; };
    }, []);


    // -------------------------------------------------------------
    // Example: handle game result event from Unity

    const { setGameResult } = useGameResult();

    const handleUnityGameResult = useCallback((payload) => {
        try {
            setGameResult(payload);
        } catch (e) {}
    }, [setGameResult]);

    // Subscribe to Unity typed events via the eventBus
    useEffect(() => {
        const unsub = eventBus.subscribe('GameResult', handleUnityGameResult);
        return () => { unsub(); };
    }, [handleUnityGameResult]);


    // -------------------------------------------------------------

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                textAlign: "center"
            }}
        >
            <h1>Game View</h1>
            <UnityGame
                dataUrl="/Build/UnityGame.data"
                frameworkUrl="/Build/UnityGame.framework.js"
                codeUrl="/Build/UnityGame.wasm"
                loaderSrc="/Build/UnityGame.loader.js"
            />
        </div>
    );
}
