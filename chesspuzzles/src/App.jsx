// Import necessary tools and libraries
import { useState, useEffect } from "react"; // React hooks for managing state and lifecycle
import { Chessboard } from "react-chessboard"; // UI component for the chessboard
import { Chess } from "chess.js"; // Chess engine for move validation and game logic
import Papa from "papaparse"; // Library to parse CSV files
import "./App.css"; // Your custom CSS file

// Hook to get live window dimensions
function useWindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}

// Main App Component
export default function App() {
  const { width, height } = useWindowSize();
  const boardWidth = Math.min(width * 0.9, height * 0.9, 800); // Set a max if you want

  const [game, setGame] = useState(null);
  const [fen, setFen] = useState(null);
  const [status, setStatus] = useState("Loading puzzle... One moment please :)");
  const [error, setError] = useState("");
  const [solutionMoves, setSolutionMoves] = useState([]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [puzzleComplete, setPuzzleComplete] = useState(false);
  const [originalPuzzle, setOriginalPuzzle] = useState(null);
  const [solvedCount, setSolvedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [failureRecorded, setFailureRecorded] = useState(false);
  const [difficulty, setDifficulty] = useState("any");

  useEffect(() => {
    loadPuzzle();
  }, [difficulty]);

  const loadPuzzle = () => {
    fetch(`${import.meta.env.BASE_URL}puzzlesBlack.csv`)
      .then((res) => res.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: ({ data }) => {
            let puzzles = data
              .map(({ FEN, Moves, Rating, GameUrl }) => ({
                FEN: FEN?.trim(),
                Moves: Moves?.trim(),
                Rating: Number(Rating),
                GameUrl: GameUrl?.trim(),
              }))
              .filter((p) => p.FEN && p.Moves && !isNaN(p.Rating));

            if (difficulty !== "any") {
              puzzles = puzzles.filter((p) => {
                if (difficulty === "easy") return p.Rating <= 1200;
                if (difficulty === "medium") return p.Rating > 1200 && p.Rating <= 2400;
                if (difficulty === "hard") return p.Rating > 2400;
              });
            }

            if (!puzzles.length) throw new Error("No puzzles found for this difficulty.");

            const puzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
            const moves = puzzle.Moves.split(" ");
            const chess = new Chess(puzzle.FEN);

            chess.move({
              from: moves[0].slice(0, 2),
              to: moves[0].slice(2, 4),
              promotion: "q",
            });

            setGame(chess);
            setFen(chess.fen());
            setSolutionMoves(moves.slice(1));
            setMoveIndex(0);
            setStatus("White to move.");
            setShowSolution(false);
            setPuzzleComplete(false);
            setOriginalPuzzle(puzzle);
            setFailureRecorded(false);
          },
          error: (err) => {
            setError("Failed to parse puzzles.csv");
            console.error(err);
          },
        });
      })
      .catch((err) => {
        setError("Failed to load puzzle.");
        console.error(err);
      });
  };

  const resetPuzzle = () => {
    if (!originalPuzzle) return;

    const chess = new Chess(originalPuzzle.FEN);
    const moves = originalPuzzle.Moves.split(" ");
    chess.move({ from: moves[0].slice(0, 2), to: moves[0].slice(2, 4), promotion: "q" });

    setGame(chess);
    setFen(chess.fen());
    setSolutionMoves(moves.slice(1));
    setMoveIndex(0);
    setStatus("Try again.");
    setShowSolution(false);
    setPuzzleComplete(false);
    setFailureRecorded(false);
  };

  const onDrop = (from, to) => {
    if (!game || puzzleComplete || showSolution || !solutionMoves.length) return false;

    const expectedMove = solutionMoves[moveIndex];
    if (!expectedMove) return false;

    if (from === expectedMove.slice(0, 2) && to === expectedMove.slice(2, 4)) {
      const chess = new Chess(game.fen());
      chess.move({ from, to, promotion: "q" });

      const nextIndex = moveIndex + 1;

      setGame(chess);
      setFen(chess.fen());
      setMoveIndex(nextIndex);

      if (nextIndex < solutionMoves.length) {
        const opponentMove = solutionMoves[nextIndex];
        setTimeout(() => {
          const chessNext = new Chess(chess.fen());
          chessNext.move({
            from: opponentMove.slice(0, 2),
            to: opponentMove.slice(2, 4),
            promotion: "q",
          });

          setGame(chessNext);
          setFen(chessNext.fen());
          setMoveIndex(nextIndex + 1);

          if (chessNext.isCheckmate()) {
            setStatus(`Checkmate! ${chessNext.turn() === "w" ? "Black" : "White"} wins.`);
            setPuzzleComplete(true);
            setSolvedCount((count) => count + 1);
          } else if (chessNext.isStalemate()) {
            setStatus("Stalemate! It's a draw.");
            setPuzzleComplete(true);
            setSolvedCount((count) => count + 1);
          } else {
            setStatus(`${chessNext.turn() === "w" ? "White" : "Black"}'s turn.`);
          }
        }, 500);
      } else {
        setStatus("Correct! Puzzle completed");
        setPuzzleComplete(true);
        setSolvedCount((count) => count + 1);
      }

      return true;
    } else {
      setStatus("Incorrect, please try again.");
      return false;
    }
  };

  const showSolutionMoves = () => {
    if (!failureRecorded) {
      setFailedCount((count) => count + 1);
      setFailureRecorded(true);
    }
    setShowSolution(true);
    setStatus("Solution: " + solutionMoves.slice(moveIndex).join(" "));
    setPuzzleComplete(true);
  };

  const newPuzzle = () => {
    setGame(null);
    setFen(null);
    setStatus("Loading puzzle... One moment please :)");
    setSolutionMoves([]);
    setMoveIndex(0);
    setError("");
    setShowSolution(false);
    setPuzzleComplete(false);
    setOriginalPuzzle(null);
    setFailureRecorded(false);
    loadPuzzle();
  };

  if (error) {
    return (
      <div className="app-container">
        <h2 className="error-text">{error}</h2>
      </div>
    );
  }

  if (!fen || !game) {
    return (
      <div className="app-container">
        <h2>{status}</h2>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="main-layout">
        {/* Chessboard on the left */}
        <div className="left-panel">
          <Chessboard
            position={fen}
            onPieceDrop={onDrop}
            boardWidth={boardWidth}
            boardOrientation="white"
          />
        </div>

        {/* Controls and info panel on the right */}
        <div className="right-panel">
          <h1 className="title">Jaket’s Chess Puzzles</h1>

         <div className="info-card">
  <div className="difficulty-selector">
    <label htmlFor="difficulty">Difficulty:</label>
    <select
      id="difficulty"
      value={difficulty}
      onChange={(e) => setDifficulty(e.target.value)}
    >
      <option value="any">Any</option>
      <option value="easy">Easy (0–1200)</option>
      <option value="medium">Medium (1201–2400)</option>
      <option value="hard">Hard (2401+)</option>
    </select>
  </div>

  <div className="score-tracker">
    <span className="solved">✔ Solved: {solvedCount}</span>
    <span className="failed">✖ Failed: {failedCount}</span>
  </div>
</div>

          <div className="status-card">
            <p>{status}</p>
          </div>

          <div className="button-row">
            <button className="primary" onClick={newPuzzle}>New Puzzle</button>

            {!showSolution && !puzzleComplete && (
              <button className="secondary" onClick={showSolutionMoves}>Show Solution</button>
            )}
            {(showSolution || puzzleComplete) && (
              <button className="secondary" onClick={resetPuzzle}>Try Again</button>
            )}

            {originalPuzzle?.GameUrl && (
              <button
                className="analyze-button"
                onClick={() => window.open(originalPuzzle.GameUrl, "_blank")}
              >
                Analyze on Lichess
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
