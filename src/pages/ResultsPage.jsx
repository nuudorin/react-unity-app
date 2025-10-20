import { useGameResult } from "../data/GameResultContext";

export default function ResultPage() {
    const { gameResult } = useGameResult();


    return (
        <div>
            <h1>Game Results</h1>
            {gameResult ? (
                <pre>{JSON.stringify(gameResult, null, 2)}</pre>
            ) : (
                <p>No results yet.</p>
            )}
        </div>
    );
}
