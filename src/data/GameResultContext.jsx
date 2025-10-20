import { createContext, useState, useContext } from "react";

const GameResultContext = createContext();

// Simple way to store game result data received from Unity
// Replace with proper backend integration as needed
export const GameResultProvider = ({ children }) => {
  const [gameResult, setGameResult] = useState(null);

  return (
    <GameResultContext.Provider value={{ gameResult, setGameResult }}>
      {children}
    </GameResultContext.Provider>
  );
};

export const useGameResult = () => useContext(GameResultContext);
